import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    createChatHandler,
    createSlidingWindowLimiter,
    default as vercelFetchHandler,
    GET,
    OPTIONS,
} from '../api/chat';
import {
    GEMINI_FREE_TIER_MODEL,
    MAX_CHAT_MESSAGE_CHARS,
    MAX_CHAT_REQUEST_BYTES,
    SYSTEM_INSTRUCTION,
    buildRetrievalQuery,
    validateChatRequest,
} from '../src/chat/chatContract';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walkFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkFiles(full));
        } else if (entry.isFile()) {
            out.push(full);
        }
    }
    return out;
}

function makeChatRequest(
    body: unknown,
    options?: {
        method?: string;
        origin?: string | null;
        referer?: string;
        secFetchSite?: string;
        contentType?: string;
        ip?: string;
        rawBody?: string;
    },
): Request {
    const headers = new Headers();
    headers.set('host', 'localhost:5173');
    headers.set('content-type', options?.contentType ?? 'application/json');
    if (options?.origin !== null) {
        headers.set('origin', options?.origin ?? 'http://localhost:5173');
    }
    if (options?.referer) {
        headers.set('referer', options.referer);
    }
    if (options?.secFetchSite) {
        headers.set('sec-fetch-site', options.secFetchSite);
    }
    if (options?.ip) {
        headers.set('x-forwarded-for', options.ip);
    }

    const payloadText = options?.rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
    return new Request('http://localhost:5173/api/chat', {
        method: options?.method ?? 'POST',
        headers,
        body: options?.method === 'GET' ? undefined : payloadText,
    });
}

test('validateChatRequest enforces structure, trims whitespace, caps history, and rejects oversized messages', () => {
    const bad = validateChatRequest({ message: '   ' });
    assert.equal(bad.ok, false);

    const tooLong = validateChatRequest({ message: 'a'.repeat(MAX_CHAT_MESSAGE_CHARS + 1) });
    assert.equal(tooLong.ok, false);

    const valid = validateChatRequest({
        message: '  Apollo Lunar Module dùng nguồn nào?  ',
        history: Array.from({ length: 8 }, (_, idx) => ({
            role: idx % 2 === 0 ? 'user' : 'assistant',
            text: `turn ${idx}`,
        })),
        context: {
            bodyId: 'moon',
            viewStage: 'MODEL_CLOSEUP',
            activeDeviceName: 'Apollo Lunar Module',
        },
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
        assert.equal(valid.value.message, 'Apollo Lunar Module dùng nguồn nào?');
        assert.equal(valid.value.history?.length, 6);
        assert.equal(valid.value.context?.bodyId, 'moon');
    }
});

test('buildRetrievalQuery only expands referential queries with active device context', () => {
    const direct = buildRetrievalQuery({
        message: 'Thời tiết Hà Nội hôm nay ra sao?',
        context: { bodyId: 'mars', activeDeviceName: 'Perseverance Rover' },
    });
    assert.equal(direct, 'Thời tiết Hà Nội hôm nay ra sao?');

    const referential = buildRetrievalQuery({
        message: 'Thiết bị này di chuyển được không?',
        context: { bodyId: 'mars', activeDeviceName: 'Perseverance Rover' },
    });
    assert.match(referential, /Perseverance Rover/);
});

test('chat system instruction requires English answers regardless of question language', () => {
    assert.match(SYSTEM_INSTRUCTION, /Always answer in English, regardless of the language used in the question/);
});

test('createChatHandler returns grounded answer, verified Free Tier model, XML isolation, and citations', async () => {
    let capturedCall: { model: string; systemInstruction: string; prompt: string } | null = null;

    const handler = createChatHandler({
        getApiKey: () => 'unit-test-fake-key-do-not-leak',
        rateLimiter: createSlidingWindowLimiter(10, 60_000),
        generateReply: async ({ model, systemInstruction, prompt }) => {
            capturedCall = { model, systemInstruction, prompt };
            return 'The Apollo Lunar Module is an official NASA 3D model shown in static inspection mode [S1].';
        },
    });

    const response = await handler(
        makeChatRequest({
            message: 'Apollo Lunar Module trên Mặt Trăng là dữ liệu gì và có di chuyển không?',
            context: { bodyId: 'moon', activeDeviceName: 'Apollo Lunar Module' },
        }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const json = (await response.json()) as {
        answer: string;
        citations: Array<{ id: string; sourcePath: string }>;
        evidenceNotice: string | null;
        retrievalSufficient: boolean;
        groundedOnly: boolean;
        model: string;
    };

    assert.equal(json.retrievalSufficient, true);
    assert.equal(json.groundedOnly, true);
    assert.equal(json.model, GEMINI_FREE_TIER_MODEL);
    assert.equal(json.model, 'gemini-3.8-flash');
    assert.ok(json.citations.length >= 1);
    assert.ok(capturedCall !== null);
    assert.match(capturedCall.prompt, /<question>/);
    assert.match(capturedCall.prompt, /<retrieved_sources>/);
    assert.doesNotMatch(JSON.stringify(json), /unit-test-fake-key-do-not-leak/);
});

test('createChatHandler refuses out-of-scope queries without calling LLM', async () => {
    let llmCalls = 0;
    const handler = createChatHandler({
        getApiKey: () => 'unit-test-fake-key',
        generateReply: async () => {
            llmCalls += 1;
            return 'Should never run';
        },
    });

    const response = await handler(
        makeChatRequest({
            message: 'Giá vàng SJC và thời tiết Hà Nội hôm nay bao nhiêu?',
            context: { bodyId: 'mars' },
        }),
    );

    assert.equal(response.status, 200);
    const json = (await response.json()) as {
        retrievalSufficient: boolean;
        groundedOnly: boolean;
        citations: unknown[];
        model: string;
    };
    assert.equal(llmCalls, 0);
    assert.equal(json.retrievalSufficient, false);
    assert.equal(json.groundedOnly, true);
    assert.equal(json.citations.length, 0);
    assert.equal(json.model, 'grounding-guard');
});

test('createChatHandler enforces HTTP method, same-origin, content-type, payload size, and rate limit', async () => {
    const getResp = await GET();
    assert.equal(getResp.status, 405);
    assert.equal(getResp.headers.get('allow'), 'POST');
    const vercelGetResp = await vercelFetchHandler.fetch(
        makeChatRequest(undefined, { method: 'GET' }),
    );
    assert.equal(vercelGetResp.status, 405);
    assert.equal(vercelGetResp.headers.get('allow'), 'POST');

    const optResp = await OPTIONS();
    assert.equal(optResp.status, 405);

    const handler = createChatHandler({
        getApiKey: () => 'unit-test-fake-key',
        rateLimiter: createSlidingWindowLimiter(2, 60_000),
        generateReply: async () => 'ok [S1]',
    });

    const crossOriginResp = await handler(
        makeChatRequest({ message: 'Mars là gì?' }, { origin: 'https://attacker.invalid' }),
    );
    assert.equal(crossOriginResp.status, 403);

    const secFetchResp = await handler(
        makeChatRequest({ message: 'Mars là gì?' }, { origin: null, secFetchSite: 'cross-site' }),
    );
    assert.equal(secFetchResp.status, 403);

    const badMimeResp = await handler(
        makeChatRequest({ message: 'Mars là gì?' }, { contentType: 'text/plain', ip: '10.0.0.2' }),
    );
    assert.equal(badMimeResp.status, 415);

    const hugeResp = await handler(
        makeChatRequest(undefined, {
            rawBody: JSON.stringify({ message: 'x'.repeat(MAX_CHAT_REQUEST_BYTES + 100) }),
            ip: '10.0.0.3',
        }),
    );
    assert.equal(hugeResp.status, 413);

    const badJsonResp = await handler(
        makeChatRequest(undefined, { rawBody: '{broken-json', ip: '10.0.0.4' }),
    );
    assert.equal(badJsonResp.status, 400);

    // Rate limit 2 per window on same IP 10.0.0.5
    const r1 = await handler(makeChatRequest({ message: 'MOLA dùng dữ liệu gì?' }, { ip: '10.0.0.5' }));
    const r2 = await handler(makeChatRequest({ message: 'MOLA dùng dữ liệu gì?' }, { ip: '10.0.0.5' }));
    const r3 = await handler(makeChatRequest({ message: 'MOLA dùng dữ liệu gì?' }, { ip: '10.0.0.5' }));
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 429);
    assert.ok(Number(r3.headers.get('retry-after')) >= 1);
});

test('createChatHandler maps missing key, timeout, rate-limit, and upstream errors without leaking secrets', async () => {
    const noKeyHandler = createChatHandler({ getApiKey: () => undefined });
    const noKeyResp = await noKeyHandler(
        makeChatRequest({ message: 'Apollo Lunar Module dùng dữ liệu gì?' }),
    );
    assert.equal(noKeyResp.status, 503);

    const timeoutHandler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        timeoutMs: 15,
        generateReply: async ({ signal }) =>
            new Promise<string>((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                    const err = new Error('aborted with secret-token-xyz');
                    err.name = 'AbortError';
                    reject(err);
                });
            }),
    });
    const timeoutResp = await timeoutHandler(
        makeChatRequest({ message: 'Apollo Lunar Module dùng dữ liệu gì?' }),
    );
    assert.equal(timeoutResp.status, 504);
    assert.doesNotMatch(await timeoutResp.text(), /secret-token-xyz/);

    const upstream429Handler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        generateReply: async () => {
            const err = new Error('429 RESOURCE_EXHAUSTED');
            (err as Error & { status?: number }).status = 429;
            throw err;
        },
    });
    const upstream429Resp = await upstream429Handler(
        makeChatRequest({ message: 'Apollo Lunar Module dùng dữ liệu gì?' }),
    );
    assert.equal(upstream429Resp.status, 429);

    const upstream502Handler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        generateReply: async () => {
            throw new Error('Upstream failed with key secret-token-xyz');
        },
    });
    const upstream502Resp = await upstream502Handler(
        makeChatRequest({ message: 'Apollo Lunar Module dùng dữ liệu gì?' }),
    );
    assert.equal(upstream502Resp.status, 502);
    assert.doesNotMatch(await upstream502Resp.text(), /secret-token-xyz/);

    // Transient 503 on gemini-3.8-flash falls back automatically to gemini-3.6-flash
    const seenModels: string[] = [];
    const fallbackHandler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        generateReply: async ({ model }) => {
            seenModels.push(model);
            if (model === 'gemini-3.8-flash') {
                const err = new Error('503 high demand');
                (err as Error & { status?: number }).status = 503;
                throw err;
            }
            return 'Apollo Lunar Module from NASA 3D Resources [S1].';
        },
    });
    const fallbackResp = await fallbackHandler(
        makeChatRequest({ message: 'Apollo Lunar Module dùng dữ liệu gì?' }),
    );
    assert.equal(fallbackResp.status, 200);
    const fallbackJson = (await fallbackResp.json()) as { model: string; citations: unknown[] };
    assert.deepEqual(seenModels, ['gemini-3.8-flash', 'gemini-3.6-flash']);
    assert.equal(fallbackJson.model, 'gemini-3.6-flash');
    assert.ok(fallbackJson.citations.length >= 1);

    // Dual 503 across 3.8-flash and 3.6-flash falls back to fast Free Tier gemini-3.5-flash-lite
    const tripleModels: string[] = [];
    const tripleFallbackHandler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        generateReply: async ({ model }) => {
            tripleModels.push(model);
            if (model !== 'gemini-3.5-flash-lite') {
                const err = new Error('503 high demand');
                (err as Error & { status?: number }).status = 503;
                throw err;
            }
            return 'Apollo Lunar Module from NASA 3D Resources (lite) [S1].';
        },
    });
    const tripleResp = await tripleFallbackHandler(
        makeChatRequest({ message: 'Apollo Lunar Module GLB creator credit and SHA256' }),
    );
    assert.equal(tripleResp.status, 200);
    const tripleJson = (await tripleResp.json()) as { model: string; citations: unknown[] };
    assert.deepEqual(tripleModels, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
    assert.equal(tripleJson.model, 'gemini-3.5-flash-lite');
    assert.ok(tripleJson.citations.length >= 1);

    // Hard deadline race cuts off hanging upstream attempts even if AbortSignal is ignored
    const stalledModels: string[] = [];
    const hardTimeoutCascadeHandler = createChatHandler({
        getApiKey: () => 'secret-token-xyz',
        timeoutMs: 2_500,
        attemptBudgetsMs: {
            'gemini-3.8-flash': 30,
            'gemini-3.6-flash': 30,
            'gemini-3.5-flash-lite': 500,
        },
        generateReply: async ({ model }) => {
            stalledModels.push(model);
            if (model !== 'gemini-3.5-flash-lite') {
                return await new Promise<string>(() => {
                    // Deliberately never resolves and ignores AbortSignal
                });
            }
            return 'NASA NSSDCA, MOLA, and THEMIS [S1].';
        },
    });
    const t0 = Date.now();
    const hardCascadeResp = await hardTimeoutCascadeHandler(
        makeChatRequest({ message: 'Apollo Lunar Module GLB creator credit and SHA256' }),
    );
    const cascadeElapsedMs = Date.now() - t0;
    assert.equal(hardCascadeResp.status, 200);
    assert.ok(cascadeElapsedMs < 1_000, `Expected fast cascade cutoff, got ${cascadeElapsedMs}ms`);
    const hardCascadeJson = (await hardCascadeResp.json()) as { model: string };
    assert.deepEqual(stalledModels, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
    assert.equal(hardCascadeJson.model, 'gemini-3.5-flash-lite');
});

test('client src/ never imports Gemini SDK or reads API keys, and C3 mascot asset matches inventory', () => {
    const srcFiles = walkFiles(path.join(ROOT_DIR, 'src'));
    for (const filePath of srcFiles) {
        if (!/\.(ts|tsx|css|json)$/i.test(filePath)) continue;
        const relPath = path.relative(ROOT_DIR, filePath);
        if (relPath.replace(/\\/g, '/') === 'src/config/chatKnowledgeIndex.json') continue;
        const content = fs.readFileSync(filePath, 'utf8');
        assert.equal(
            content.includes('@google/genai'),
            false,
            `${relPath} must not import @google/genai in browser bundle`,
        );
        assert.equal(
            /GEMINI_API_KEY|VITE_GEMINI|AQ\.Ab8RN6|AIza[0-9A-Za-z_-]{20,}/.test(content),
            false,
            `${relPath} must never contain API keys or VITE_GEMINI env references`,
        );
    }

    const mascotGlbPath = path.join(ROOT_DIR, 'public/assets/mascot/rise_plushie.glb');
    assert.equal(
        fs.existsSync(mascotGlbPath),
        true,
        'public/assets/mascot/rise_plushie.glb must be present for C3 3D RISE mascot launcher',
    );
    const glbBytes = fs.readFileSync(mascotGlbPath);
    assert.equal(glbBytes.byteLength, 716_904);
    assert.equal(glbBytes.subarray(0, 4).toString('utf8'), 'glTF');
    const actualSha256 = crypto.createHash('sha256').update(glbBytes).digest('hex');
    assert.equal(
        actualSha256,
        'aee69a76157e5b5fea6067dc91d9ae847bcf747686e2b4694db383946ff6d32f',
    );

    const widgetContent = fs.readFileSync(
        path.join(ROOT_DIR, 'src/ui/chat/ProjectChatWidget.tsx'),
        'utf8',
    );
    assert.ok(widgetContent.includes('<RiseMascot'));
    assert.ok(widgetContent.includes('data-mascot-slot="rise-plushie-3d"'));
});
