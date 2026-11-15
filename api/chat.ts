import { GoogleGenAI } from '@google/genai';
import {
    CHAT_TOP_K_CHUNKS,
    GEMINI_FREE_TIER_FALLBACK_MODELS,
    MAX_CHAT_REQUEST_BYTES,
    SYSTEM_INSTRUCTION,
    buildCitationsFromMatches,
    buildEvidenceNotice,
    buildGroundedPrompt,
    buildInsufficientEvidenceReply,
    buildRetrievalQuery,
    validateChatRequest,
    type ChatApiErrorResponse,
    type ChatApiSuccessResponse,
} from '../src/chat/chatContract.ts';
import { searchKnowledgeChunks } from '../src/chat/knowledgeRetriever.ts';

const DEFAULT_RATE_LIMIT_MAX = 12;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;
const PER_MODEL_ATTEMPT_BUDGET_MS: Record<string, number> = {
    'gemini-3.8-flash': 6_000,
    'gemini-3.6-flash': 13_500,
    'gemini-3.5-flash-lite': 10_500,
};
const MAX_TRACKED_CLIENT_BUCKETS = 512;

export interface RateLimiterResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

export interface RateLimiter {
    consume(clientKey: string, nowMs?: number): RateLimiterResult;
}

export interface GenerateChatReplyArgs {
    apiKey: string;
    model: string;
    systemInstruction: string;
    prompt: string;
    signal: AbortSignal;
    timeoutMs: number;
}

export interface ChatHandlerDeps {
    getApiKey?: () => string | undefined;
    getAllowedHosts?: () => string[];
    generateReply?: (args: GenerateChatReplyArgs) => Promise<string>;
    rateLimiter?: RateLimiter;
    timeoutMs?: number;
    attemptBudgetsMs?: Record<string, number>;
    retrieveKnowledge?: typeof searchKnowledgeChunks;
}

function jsonResponse(
    body: ChatApiSuccessResponse | ChatApiErrorResponse,
    status: number,
    extraHeaders?: Record<string, string>,
): Response {
    return Response.json(body, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            ...extraHeaders,
        },
    });
}

function methodNotAllowedResponse(): Response {
    return jsonResponse(
        {
            error: 'Only the POST method is supported for /api/chat.',
            code: 'METHOD_NOT_ALLOWED',
        },
        405,
        { Allow: 'POST' },
    );
}

/**
 * Normalizes loopback host aliases so localhost/127.0.0.1 match consistently in local dev.
 */
function normalizeHost(rawHost: string): string {
    const trimmed = rawHost.trim().toLowerCase();
    const match = trimmed.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
    if (!match) return trimmed;
    const hostname = match[1];
    const port = match[2];
    const normalizedHostname =
        hostname === '127.0.0.1' || hostname === '[::1]' ? 'localhost' : hostname;
    return port ? `${normalizedHostname}:${port}` : normalizedHostname;
}

function isSameOriginRequest(request: Request, extraAllowedHosts: string[]): boolean {
    const secFetchSite = request.headers.get('sec-fetch-site')?.trim().toLowerCase();
    if (secFetchSite === 'cross-site') {
        return false;
    }

    const requestHostHeader =
        request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
        request.headers.get('host')?.trim() ||
        (() => {
            try {
                return new URL(request.url).host;
            } catch {
                return '';
            }
        })();

    const allowedHosts = new Set<string>(
        [requestHostHeader, ...extraAllowedHosts]
            .filter(Boolean)
            .map(normalizeHost),
    );

    const originHeader = request.headers.get('origin')?.trim();
    if (originHeader) {
        if (originHeader === 'null') return false;
        try {
            const originHost = normalizeHost(new URL(originHeader).host);
            return allowedHosts.has(originHost);
        } catch {
            return false;
        }
    }

    const refererHeader = request.headers.get('referer')?.trim();
    if (refererHeader) {
        try {
            const refererHost = normalizeHost(new URL(refererHeader).host);
            return allowedHosts.has(refererHost);
        } catch {
            return false;
        }
    }

    return true;
}

function resolveClientKey(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim();
        if (firstIp) return firstIp;
    }
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
    return 'local-client';
}

/**
 * In-memory per-instance sliding-window rate limiter. Acts alongside Vercel
 * edge rate protections for warm serverless instances and local dev.
 */
export function createSlidingWindowLimiter(
    maxRequests = DEFAULT_RATE_LIMIT_MAX,
    windowMs = DEFAULT_RATE_LIMIT_WINDOW_MS,
): RateLimiter {
    const buckets = new Map<string, number[]>();

    return {
        consume(clientKey: string, nowMs = Date.now()): RateLimiterResult {
            if (buckets.size >= MAX_TRACKED_CLIENT_BUCKETS) {
                for (const [key, timestamps] of buckets.entries()) {
                    const fresh = timestamps.filter((t) => nowMs - t < windowMs);
                    if (fresh.length === 0) {
                        buckets.delete(key);
                    } else {
                        buckets.set(key, fresh);
                    }
                }
                if (buckets.size >= MAX_TRACKED_CLIENT_BUCKETS) {
                    const oldestKey = buckets.keys().next().value;
                    if (oldestKey !== undefined) {
                        buckets.delete(oldestKey);
                    }
                }
            }

            const cutoff = nowMs - windowMs;
            const active = (buckets.get(clientKey) ?? []).filter((t) => t > cutoff);

            if (active.length >= maxRequests) {
                const retryAfterMs = Math.max(1000, active[0] + windowMs - nowMs);
                buckets.set(clientKey, active);
                return {
                    allowed: false,
                    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
                };
            }

            active.push(nowMs);
            buckets.set(clientKey, active);
            return {
                allowed: true,
                retryAfterSeconds: 0,
            };
        },
    };
}

function extractInteractionText(interaction: {
    output_text?: string;
    outputs?: Array<{ type?: string; text?: string }>;
}): string {
    if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
        return interaction.output_text.trim();
    }
    if (Array.isArray(interaction.outputs)) {
        const joined = interaction.outputs
            .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
            .join('\n')
            .trim();
        if (joined) return joined;
    }
    return '';
}

async function defaultGenerateReply(args: GenerateChatReplyArgs): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: args.apiKey });
    const interaction = await ai.interactions.create(
        {
            model: args.model,
            system_instruction: args.systemInstruction,
            input: args.prompt,
            store: false,
            generation_config: {
                max_output_tokens: 2048,
                thinking_level: 'low',
            },
        },
        {
            signal: args.signal,
            timeout_ms: args.timeoutMs,
            maxRetries: 0,
        },
    );

    const text = extractInteractionText(
        interaction as {
            output_text?: string;
            outputs?: Array<{ type?: string; text?: string }>;
        },
    );
    if (!text) {
        throw new Error('EMPTY_MODEL_RESPONSE');
    }
    return text;
}

function isTransientRetryableModelError(error: unknown): boolean {
    const errRecord = (error && typeof error === 'object' ? error : {}) as {
        status?: unknown;
        message?: unknown;
    };
    const status = typeof errRecord.status === 'number' ? errRecord.status : undefined;
    const message = typeof errRecord.message === 'string' ? errRecord.message : '';
    return (
        status === 429 ||
        status === 503 ||
        status === 500 ||
        /high demand|unavailable|overloaded|resource_exhausted|429|503/i.test(message)
    );
}

function classifyUpstreamError(error: unknown, didTimeout: boolean): {
    status: number;
    body: ChatApiErrorResponse;
} {
    if (didTimeout) {
        return {
            status: 504,
            body: {
                error: 'The assistant response timed out. Please try again.',
                code: 'UPSTREAM_TIMEOUT',
            },
        };
    }

    const errRecord = (error && typeof error === 'object' ? error : {}) as {
        name?: unknown;
        status?: unknown;
        code?: unknown;
        message?: unknown;
    };
    const name = typeof errRecord.name === 'string' ? errRecord.name : '';
    const message = typeof errRecord.message === 'string' ? errRecord.message : '';
    const status = typeof errRecord.status === 'number' ? errRecord.status : undefined;

    if (
        name === 'AbortError' ||
        name === 'TimeoutError' ||
        name === 'ContinuationInterruptedError' ||
        status === 408 ||
        status === 504 ||
        /timeout|timed out|aborted/i.test(message)
    ) {
        return {
            status: 504,
            body: {
                error: 'The assistant response timed out. Please try again.',
                code: 'UPSTREAM_TIMEOUT',
            },
        };
    }

    if (
        status === 429 ||
        /429|resource_exhausted|quota|rate limit/i.test(message)
    ) {
        return {
            status: 429,
            body: {
                error: 'The AI model’s free-tier limit is temporarily busy. Please try again in a few minutes.',
                code: 'UPSTREAM_RATE_LIMIT',
            },
        };
    }

    if (status === 503 || /high demand|unavailable|overloaded|503/i.test(message)) {
        return {
            status: 503,
            body: {
                error: 'The free AI model is temporarily under heavy load. Please try again in a few seconds.',
                code: 'UPSTREAM_UNAVAILABLE',
            },
        };
    }

    return {
        status: 502,
        body: {
            error: 'The AI service is currently unavailable. Please try again later.',
            code: 'UPSTREAM_ERROR',
        },
    };
}

async function readJsonWithinByteLimit(
    request: Request,
    maxBytes: number,
): Promise<
    | { ok: true; data: unknown }
    | { ok: false; response: Response }
> {
    const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json')) {
        return {
            ok: false,
            response: jsonResponse(
                {
                    error: 'Content-Type must be application/json.',
                    code: 'UNSUPPORTED_MEDIA_TYPE',
                },
                415,
            ),
        };
    }

    const declaredLengthRaw = request.headers.get('content-length');
    if (declaredLengthRaw) {
        const declaredLength = Number(declaredLengthRaw);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            return {
                ok: false,
                response: jsonResponse(
                    {
                        error: 'Request size exceeds the 16 KB limit.',
                        code: 'PAYLOAD_TOO_LARGE',
                    },
                    413,
                ),
            };
        }
    }

    let rawBuffer: ArrayBuffer;
    try {
        rawBuffer = await request.arrayBuffer();
    } catch {
        return {
            ok: false,
            response: jsonResponse(
                {
                    error: 'Unable to read the submitted JSON body.',
                    code: 'INVALID_REQUEST',
                },
                400,
            ),
        };
    }

    if (rawBuffer.byteLength > maxBytes) {
        return {
            ok: false,
            response: jsonResponse(
                {
                    error: 'Request size exceeds the 16 KB limit.',
                    code: 'PAYLOAD_TOO_LARGE',
                },
                413,
            ),
        };
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(rawBuffer);
    try {
        return {
            ok: true,
            data: JSON.parse(text) as unknown,
        };
    } catch {
        return {
            ok: false,
            response: jsonResponse(
                {
                    error: 'Invalid JSON.',
                    code: 'INVALID_REQUEST',
                },
                400,
            ),
        };
    }
}

function createAbortError(message = 'UPSTREAM_ATTEMPT_TIMEOUT'): Error {
    const err = new Error(message);
    err.name = 'AbortError';
    return err;
}

/**
 * Guarantees hard wall-clock cancellation even if an underlying SDK/HTTP call
 * delays or ignores AbortSignal propagation.
 */
async function runWithAbortSignal<T>(
    operation: () => Promise<T>,
    signal: AbortSignal,
): Promise<T> {
    if (signal.aborted) {
        throw createAbortError();
    }

    const opPromise = operation();
    // Silence late rejections from abandoned upstream promises after timeout race loses.
    opPromise.catch(() => {});

    return await new Promise<T>((resolve, reject) => {
        const onAbort = () => {
            cleanup();
            reject(createAbortError());
        };
        const cleanup = () => {
            signal.removeEventListener('abort', onAbort);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        opPromise.then(
            (value) => {
                cleanup();
                resolve(value);
            },
            (error) => {
                cleanup();
                reject(error);
            },
        );
    });
}

/**
 * Creates a testable Web Request/Response handler for /api/chat.
 */
export function createChatHandler(deps: ChatHandlerDeps = {}): (request: Request) => Promise<Response> {
    const getApiKey = deps.getApiKey ?? (() => process.env.GEMINI_API_KEY?.trim());
    const getAllowedHosts =
        deps.getAllowedHosts ??
        (() =>
            (process.env.ALLOWED_CHAT_HOSTS ?? '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean));
    const generateReply = deps.generateReply ?? defaultGenerateReply;
    const rateLimiter = deps.rateLimiter ?? createSlidingWindowLimiter();
    const timeoutMs = deps.timeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS;
    const attemptBudgets = deps.attemptBudgetsMs ?? PER_MODEL_ATTEMPT_BUDGET_MS;
    const retrieveKnowledge = deps.retrieveKnowledge ?? searchKnowledgeChunks;

    return async (request: Request): Promise<Response> => {
        if (request.method !== 'POST') {
            return methodNotAllowedResponse();
        }

        if (!isSameOriginRequest(request, getAllowedHosts())) {
            return jsonResponse(
                {
                    error: 'Cross-origin request rejected.',
                    code: 'FORBIDDEN_ORIGIN',
                },
                403,
            );
        }

        const rateResult = rateLimiter.consume(resolveClientKey(request));
        if (!rateResult.allowed) {
            return jsonResponse(
                {
                    error: 'You are sending questions too quickly. Please wait a moment and try again.',
                    code: 'RATE_LIMITED',
                    retryAfterSeconds: rateResult.retryAfterSeconds,
                },
                429,
                { 'Retry-After': String(rateResult.retryAfterSeconds) },
            );
        }

        const parsedBody = await readJsonWithinByteLimit(request, MAX_CHAT_REQUEST_BYTES);
        if (!parsedBody.ok) {
            return parsedBody.response;
        }

        const validated = validateChatRequest(parsedBody.data);
        if (!validated.ok) {
            return jsonResponse(
                {
                    error: validated.error,
                    code: 'INVALID_REQUEST',
                },
                400,
            );
        }

        const payload = validated.value;
        const retrievalQuery = buildRetrievalQuery(payload);
        const retrieval = retrieveKnowledge(retrievalQuery, {
            topK: CHAT_TOP_K_CHUNKS,
            bodyHint: payload.context?.bodyId,
        });

        if (!retrieval.sufficient) {
            return jsonResponse(buildInsufficientEvidenceReply(retrieval), 200);
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            return jsonResponse(
                {
                    error: 'The AI assistant is not configured on the server.',
                    code: 'CHAT_NOT_CONFIGURED',
                },
                503,
            );
        }

        const citations = buildCitationsFromMatches(retrieval.matches);
        const evidenceNotice = buildEvidenceNotice(retrieval.matches);
        const prompt = buildGroundedPrompt(payload, retrieval.matches);

        const outerController = new AbortController();
        let didOuterTimeout = false;
        const startedAt = Date.now();
        const outerTimer = setTimeout(() => {
            didOuterTimeout = true;
            outerController.abort();
        }, timeoutMs);

        try {
            let lastError: unknown = null;
            for (let idx = 0; idx < GEMINI_FREE_TIER_FALLBACK_MODELS.length; idx += 1) {
                const candidateModel = GEMINI_FREE_TIER_FALLBACK_MODELS[idx];
                const elapsed = Date.now() - startedAt;
                const remainingMs = timeoutMs - elapsed;
                if (didOuterTimeout || outerController.signal.aborted || remainingMs <= 500) {
                    break;
                }

                const hasMoreModels = idx < GEMINI_FREE_TIER_FALLBACK_MODELS.length - 1;
                const modelBudget = attemptBudgets[candidateModel] ?? remainingMs;
                const attemptBudgetMs = hasMoreModels
                    ? Math.min(remainingMs, Math.max(15, modelBudget))
                    : remainingMs;

                const attemptController = new AbortController();
                let didAttemptTimeout = false;
                const onOuterAbort = () => attemptController.abort();
                outerController.signal.addEventListener('abort', onOuterAbort, { once: true });
                const attemptTimer = setTimeout(() => {
                    didAttemptTimeout = true;
                    attemptController.abort();
                }, attemptBudgetMs);

                try {
                    const answer = await runWithAbortSignal(
                        () =>
                            generateReply({
                                apiKey,
                                model: candidateModel,
                                systemInstruction: SYSTEM_INSTRUCTION,
                                prompt,
                                signal: attemptController.signal,
                                timeoutMs: attemptBudgetMs,
                            }),
                        attemptController.signal,
                    );

                    return jsonResponse(
                        {
                            answer: answer.trim(),
                            citations,
                            evidenceNotice,
                            retrievalSufficient: true,
                            groundedOnly: true,
                            model: candidateModel,
                        },
                        200,
                    );
                } catch (err) {
                    lastError = err;
                    const remainingAfterFail = timeoutMs - (Date.now() - startedAt);
                    const canFallback =
                        hasMoreModels &&
                        !didOuterTimeout &&
                        !outerController.signal.aborted &&
                        remainingAfterFail > 800 &&
                        (didAttemptTimeout || isTransientRetryableModelError(err));
                    if (!canFallback) {
                        throw err;
                    }
                } finally {
                    clearTimeout(attemptTimer);
                    outerController.signal.removeEventListener('abort', onOuterAbort);
                }
            }

            throw lastError ?? new Error('UPSTREAM_TIMEOUT');
        } catch (error) {
            const classified = classifyUpstreamError(error, didOuterTimeout);
            return jsonResponse(classified.body, classified.status);
        } finally {
            clearTimeout(outerTimer);
        }
    };
}

const defaultHandler = createChatHandler();

export async function POST(request: Request): Promise<Response> {
    return defaultHandler(request);
}

export async function GET(): Promise<Response> {
    return methodNotAllowedResponse();
}

export async function PUT(): Promise<Response> {
    return methodNotAllowedResponse();
}

export async function DELETE(): Promise<Response> {
    return methodNotAllowedResponse();
}

export async function PATCH(): Promise<Response> {
    return methodNotAllowedResponse();
}

export async function OPTIONS(): Promise<Response> {
    return methodNotAllowedResponse();
}

export default {
    fetch(request: Request): Promise<Response> {
        return defaultHandler(request);
    },
};
