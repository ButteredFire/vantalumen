import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    MAX_CHAT_HISTORY_TURNS,
    MAX_CHAT_MESSAGE_CHARS,
    type ChatApiErrorResponse,
    type ChatApiSuccessResponse,
    type ChatCitation,
    type ChatHistoryTurn,
} from '../../chat/chatContract';
import { DEVICE_CATALOG } from '../../config/deviceCatalog';
import { RiseMascot } from '../../scene/mascot/RiseMascot';
import { useCosmosStore } from '../../store/useCosmosStore';

interface WidgetMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    citations?: ChatCitation[];
    evidenceNotice?: string | null;
    retrievalSufficient?: boolean;
    model?: string;
}

interface LauncherPos {
    x: number;
    y: number;
}

const LAUNCHER_SIZE = 78;
const VIEWPORT_MARGIN = 12;
const DRAG_THRESHOLD_PX = 6;
const STORAGE_POS_KEY = 'vantalumen_atlas_chat_pos_v1';

const STARTER_PROMPTS = [
    'Which NASA data does the project use?',
    'Which equipment can move across the surface?',
    'Which models do Ares Station and Orion use?',
    'What is the Apollo Lunar Module on the Moon?',
];

const EVIDENCE_BADGE_LABELS: Record<ChatCitation['evidenceType'], string> = {
    source_verified: 'Verified source',
    illustrative_or_simulated: 'Simulated / illustrative / proxy',
    mixed: 'Data & simulation',
    policy: 'Source policy & limits',
};

function clampPosition(pos: LauncherPos, viewportW: number, viewportH: number): LauncherPos {
    const maxX = Math.max(VIEWPORT_MARGIN, viewportW - LAUNCHER_SIZE - VIEWPORT_MARGIN);
    const maxY = Math.max(VIEWPORT_MARGIN, viewportH - LAUNCHER_SIZE - VIEWPORT_MARGIN);
    return {
        x: Math.min(maxX, Math.max(VIEWPORT_MARGIN, Math.round(pos.x))),
        y: Math.min(maxY, Math.max(VIEWPORT_MARGIN, Math.round(pos.y))),
    };
}

function getDefaultPosition(viewportW: number, viewportH: number): LauncherPos {
    if (viewportW <= 960) {
        return clampPosition(
            { x: viewportW - LAUNCHER_SIZE - 14, y: viewportH - LAUNCHER_SIZE - 18 },
            viewportW,
            viewportH,
        );
    }
    return clampPosition(
        { x: Math.max(316, viewportW - 332 - LAUNCHER_SIZE - 12), y: viewportH - LAUNCHER_SIZE - 94 },
        viewportW,
        viewportH,
    );
}

function loadInitialPosition(): LauncherPos {
    if (typeof window === 'undefined') {
        return { x: 20, y: 20 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    try {
        const raw = window.sessionStorage?.getItem(STORAGE_POS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<LauncherPos>;
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                return clampPosition({ x: parsed.x, y: parsed.y }, w, h);
            }
        }
    } catch {
        // Ignore restricted sessionStorage environments cleanly.
    }
    return getDefaultPosition(w, h);
}

function createInitialMessages(): WidgetMessage[] {
    return [
        {
            id: 'welcome',
            role: 'assistant',
            text:
                'Hello! I’m VantaLumen’s RISE assistant. Ask about scientific data sources (MOLA, THEMIS, LOLA, Diviner, HiRISE, LROC), 3D equipment and spacecraft on Mars and the Moon, or how to use surface mode.',
            evidenceNotice:
                'Answers are grounded in the project’s documents and configuration; only recorded sources are shown.',
        },
    ];
}

function computeDialogStyle(pos: LauncherPos, viewportW: number, viewportH: number): React.CSSProperties {
    if (viewportW <= 640) {
        return {
            left: '10px',
            right: '10px',
            bottom: '10px',
            width: 'auto',
            maxHeight: 'min(72dvh, 520px)',
        };
    }

    const panelW = Math.min(388, viewportW - 24);
    const preferLeft = pos.x > viewportW * 0.5;
    const rawLeft = preferLeft ? pos.x + LAUNCHER_SIZE - panelW : pos.x;
    const left = Math.min(Math.max(12, rawLeft), viewportW - panelW - 12);

    const spaceAbove = Math.max(0, pos.y - 22);
    const spaceBelow = Math.max(0, viewportH - (pos.y + LAUNCHER_SIZE) - 22);
    const openAbove = spaceAbove >= spaceBelow;

    if (openAbove) {
        const bottom = Math.max(12, viewportH - pos.y + 10);
        const maxHeight = Math.min(540, Math.max(140, spaceAbove));
        return {
            left: `${Math.round(left)}px`,
            bottom: `${Math.round(bottom)}px`,
            width: `${Math.round(panelW)}px`,
            maxHeight: `${Math.round(maxHeight)}px`,
        };
    }

    const top = Math.min(Math.max(12, viewportH - 152), Math.max(12, pos.y + LAUNCHER_SIZE + 10));
    const maxHeight = Math.min(540, Math.max(140, viewportH - top - 12));
    return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(panelW)}px`,
        maxHeight: `${Math.round(maxHeight)}px`,
    };
}

/**
 * Floating, draggable, keyboard-accessible project Q&A assistant with a 3D mascot launcher.
 */
export const ProjectChatWidget: React.FC = () => {
    const viewStage = useCosmosStore((state) => state.viewStage);
    const activeBodyId = useCosmosStore((state) => state.activeBodyId);
    const activeTarget = useCosmosStore((state) => state.activeTarget);
    const activeDeviceId = useCosmosStore((state) => state.activeDeviceId);
    const pointerLocked = useCosmosStore((state) => state.pointerLocked);
    const reducedMotion = useCosmosStore((state) => state.reducedMotion);
    const resolvedQualityTier = useCosmosStore((state) => state.resolvedQualityTier);

    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState<LauncherPos>(() => loadInitialPosition());
    const [viewport, setViewport] = useState(() => ({
        w: typeof window !== 'undefined' ? window.innerWidth : 1280,
        h: typeof window !== 'undefined' ? window.innerHeight : 800,
    }));
    const [isDragging, setIsDragging] = useState(false);
    const [messages, setMessages] = useState<WidgetMessage[]>(() => createInitialMessages());
    const [draft, setDraft] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorBanner, setErrorBanner] = useState<string | null>(null);

    const launcherRef = useRef<HTMLButtonElement | null>(null);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const suppressNextClickRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        moved: boolean;
    } | null>(null);

    const activeDeviceName = useMemo(() => {
        if (!activeDeviceId) return undefined;
        return DEVICE_CATALOG.find((item) => item.id === activeDeviceId)?.name ?? activeDeviceId;
    }, [activeDeviceId]);

    const persistPosition = useCallback((next: LauncherPos) => {
        try {
            window.sessionStorage?.setItem(STORAGE_POS_KEY, JSON.stringify(next));
        } catch {
            // Ignore restricted storage.
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setViewport({ w, h });
            setPos((prev) => clampPosition(prev, w, h));
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
        }
    }, [isOpen, messages.length, isSubmitting, reducedMotion]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const focusTimer = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 0);
        return () => window.clearTimeout(focusTimer);
    }, [isOpen]);

    const closeDialog = useCallback(() => {
        setIsOpen(false);
        window.setTimeout(() => {
            launcherRef.current?.focus();
        }, 0);
    }, []);

    const hiddenForTransition =
        viewStage === 'PRELOADING' ||
        viewStage === 'LAUNCHING' ||
        viewStage === 'BODY_TRANSITION';

    if (hiddenForTransition) {
        return null;
    }

    const sendQuestion = async (rawText: string) => {
        const cleanText = rawText.trim();
        if (!cleanText || isSubmitting) return;
        if (cleanText.length > MAX_CHAT_MESSAGE_CHARS) {
            setErrorBanner(`Questions are limited to ${MAX_CHAT_MESSAGE_CHARS} characters.`);
            return;
        }

        setErrorBanner(null);
        const userMessage: WidgetMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            text: cleanText,
        };

        const history: ChatHistoryTurn[] = messages
            .filter((item) => item.id !== 'welcome')
            .slice(-MAX_CHAT_HISTORY_TURNS)
            .map((item) => ({
                role: item.role,
                text: item.text.slice(0, MAX_CHAT_MESSAGE_CHARS),
            }));

        setMessages((prev) => [...prev, userMessage]);
        setDraft('');
        setIsSubmitting(true);

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const clientTimeoutId = window.setTimeout(() => controller.abort(), 35_000);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
                body: JSON.stringify({
                    message: cleanText,
                    history,
                    context: {
                        bodyId: activeBodyId,
                        viewStage,
                        activeTargetName: activeTarget?.name,
                        activeDeviceName,
                    },
                }),
            });

            let payload: unknown = null;
            try {
                payload = await response.json();
            } catch {
                payload = null;
            }

            if (!response.ok) {
                const errPayload = (payload ?? {}) as Partial<ChatApiErrorResponse>;
                const fallbackErr =
                    response.status === 429
                        ? 'You are sending questions too quickly or the free tier is temporarily full. Please wait a moment.'
                        : 'Unable to receive an answer from the server right now.';
                setErrorBanner(typeof errPayload.error === 'string' ? errPayload.error : fallbackErr);
                return;
            }

            const okPayload = payload as ChatApiSuccessResponse;
            setMessages((prev) => [
                ...prev,
                {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    text: okPayload.answer,
                    citations: okPayload.citations,
                    evidenceNotice: okPayload.evidenceNotice,
                    retrievalSufficient: okPayload.retrievalSufficient,
                    model: okPayload.model,
                },
            ]);
        } catch (error) {
            if ((error as { name?: string })?.name === 'AbortError') {
                setErrorBanner('The assistant took too long to respond. Please try again.');
                return;
            }
            setErrorBanner('The connection was interrupted or timed out. Please try again.');
        } finally {
            window.clearTimeout(clientTimeoutId);
            setIsSubmitting(false);
        }
    };

    const handleLauncherPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            originX: pos.x,
            originY: pos.y,
            moved: false,
        };
        setIsDragging(true);
    };

    const handleLauncherPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const activeDrag = dragRef.current;
        if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;

        const dx = e.clientX - activeDrag.startX;
        const dy = e.clientY - activeDrag.startY;
        if (!activeDrag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            activeDrag.moved = true;
        }
        if (activeDrag.moved) {
            setPos(clampPosition({ x: activeDrag.originX + dx, y: activeDrag.originY + dy }, viewport.w, viewport.h));
        }
    };

    const handleLauncherPointerEnd = (e: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
        e.stopPropagation();
        const activeDrag = dragRef.current;
        if (!activeDrag || activeDrag.pointerId !== e.pointerId) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        if (activeDrag.moved) {
            suppressNextClickRef.current = true;
            window.setTimeout(() => {
                suppressNextClickRef.current = false;
            }, 120);
            const dx = e.clientX - activeDrag.startX;
            const dy = e.clientY - activeDrag.startY;
            const nextPos = cancelled
                ? clampPosition(pos, viewport.w, viewport.h)
                : clampPosition({ x: activeDrag.originX + dx, y: activeDrag.originY + dy }, viewport.w, viewport.h);
            setPos(nextPos);
            persistPosition(nextPos);
        }

        dragRef.current = null;
        setIsDragging(false);
    };

    const handleLauncherClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
        }
        setIsOpen((prev) => !prev);
    };

    const handleLauncherKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === ' ') {
            suppressNextClickRef.current = false;
            return;
        }
        const step = e.shiftKey ? 24 : 12;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            closeDialog();
            return;
        } else {
            return;
        }

        e.preventDefault();
        const nextPos = clampPosition({ x: pos.x + dx, y: pos.y + dy }, viewport.w, viewport.h);
        setPos(nextPos);
        persistPosition(nextPos);
    };

    const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialog();
            return;
        }
        if (e.key === 'Tab' && dialogRef.current) {
            const focusables = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
                ),
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    const idleFloatAllowed =
        !isOpen && !isDragging && !reducedMotion && resolvedQualityTier !== 'low';
    const contextLabel = `${activeBodyId === 'mars' ? 'Mars' : 'Moon'}${
        activeDeviceName ? ` · ${activeDeviceName}` : activeTarget?.name ? ` · ${activeTarget.name}` : ''
    }`;
    const dialogStyle = computeDialogStyle(pos, viewport.w, viewport.h);

    return (
        <div
            className={`project-chat-root ${pointerLocked ? 'is-pointer-locked' : ''}`}
            data-testid="project-chat-root"
            data-reduced-motion={reducedMotion ? 'true' : 'false'}
        >
            <button
                ref={launcherRef}
                type="button"
                className={[
                    'project-chat-launcher',
                    isDragging ? 'is-dragging' : '',
                    idleFloatAllowed ? 'is-idle-float' : '',
                    isOpen ? 'is-open' : '',
                ]
                    .filter(Boolean)
                    .join(' ')}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                data-testid="project-chat-launcher"
                data-mascot-slot="rise-plushie-3d"
                aria-label={isOpen ? 'Close RISE assistant' : 'Open the RISE project assistant'}
                aria-expanded={isOpen}
                aria-controls="vantalumen-atlas-chat-dialog"
                title="RISE assistant — Drag to move; press Enter or click to ask about the project"
                onPointerDown={handleLauncherPointerDown}
                onPointerMove={handleLauncherPointerMove}
                onPointerUp={(e) => handleLauncherPointerEnd(e, false)}
                onPointerCancel={(e) => handleLauncherPointerEnd(e, true)}
                onClick={handleLauncherClick}
                onKeyDown={handleLauncherKeyDown}
            >
                <RiseMascot
                    isOpen={isOpen}
                    isDragging={isDragging}
                    reducedMotion={reducedMotion}
                    resolvedQualityTier={resolvedQualityTier}
                />
                <span className="project-chat-launcher-badge">RISE AI</span>
            </button>

            {isOpen && (
                <div
                    ref={dialogRef}
                    id="vantalumen-atlas-chat-dialog"
                    role="dialog"
                    aria-modal="false"
                    aria-label="Ask the VantaLumen project assistant"
                    className="project-chat-dialog glass-panel"
                    data-testid="project-chat-dialog"
                    style={dialogStyle}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                    onKeyDown={handleDialogKeyDown}
                >
                    <header className="project-chat-header">
                        <div className="project-chat-title-block">
                            <strong>RISE Assistant · VantaLumen</strong>
                            <span className="project-chat-context-pill" data-testid="project-chat-context">
                                {contextLabel}
                            </span>
                        </div>
                        <div className="project-chat-header-actions">
                            <button
                                type="button"
                                className="project-chat-icon-btn"
                                data-testid="project-chat-reset"
                                onClick={() => {
                                    abortControllerRef.current?.abort();
                                    setIsSubmitting(false);
                                    setErrorBanner(null);
                                    setMessages(createInitialMessages());
                                }}
                                title="Start a new conversation"
                            >
                                New
                            </button>
                            <button
                                type="button"
                                className="project-chat-icon-btn"
                                data-testid="project-chat-close"
                                aria-label="Close assistant dialog"
                                onClick={closeDialog}
                            >
                                Close
                            </button>
                        </div>
                    </header>

                    <div className="project-chat-messages" data-testid="project-chat-messages">
                        {messages.map((msg) => (
                            <article
                                key={msg.id}
                                className={`project-chat-bubble is-${msg.role}`}
                                data-testid={`project-chat-msg-${msg.role}`}
                            >
                                <div className="project-chat-bubble-body project-chat-markdown">
                                    {msg.role === 'assistant' ? (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ href, children }) =>
                                                    href ? (
                                                        <a href={href} target="_blank" rel="noopener noreferrer">
                                                            {children}
                                                        </a>
                                                    ) : (
                                                        <>{children}</>
                                                    ),
                                                table: ({ children }) => (
                                                    <div className="project-chat-table-scroll">
                                                        <table>{children}</table>
                                                    </div>
                                                ),
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    ) : (
                                        msg.text.split('\n\n').map((paragraph, index) => (
                                            <p key={index}>{paragraph}</p>
                                        ))
                                    )}
                                </div>

                                {msg.evidenceNotice && (
                                    <div
                                        className="project-chat-evidence-note"
                                        data-testid="project-chat-evidence-note"
                                    >
                                        {msg.evidenceNotice}
                                    </div>
                                )}

                                {msg.citations && msg.citations.length > 0 && (
                                    <div className="project-chat-citations" data-testid="project-chat-citations">
                                        {msg.citations.map((cite) => (
                                            <div key={cite.id} className="project-chat-citation-chip">
                                                <div className="project-chat-citation-head">
                                                    <span className="project-chat-citation-id">[{cite.id}]</span>
                                                    <span className="project-chat-citation-type">
                                                        {EVIDENCE_BADGE_LABELS[cite.evidenceType]}
                                                    </span>
                                                </div>
                                                <div className="project-chat-citation-path">
                                                    {cite.title} · <code>{cite.sourcePath}</code>
                                                </div>
                                                {cite.sourceUrls.length > 0 && (
                                                    <div className="project-chat-citation-links">
                                                        {cite.sourceUrls.slice(0, 2).map((url) => (
                                                            <a
                                                                key={url}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                NASA/USGS source ↗
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))}

                        {isSubmitting && (
                            <div className="project-chat-status" role="status" aria-live="polite">
                                Checking VantaLumen sources and preparing an answer...
                            </div>
                        )}

                        {errorBanner && (
                            <div
                                className="project-chat-error"
                                role="alert"
                                data-testid="project-chat-error"
                            >
                                {errorBanner}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {messages.length <= 1 && (
                        <div className="project-chat-starters" aria-label="Suggested questions">
                            {STARTER_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    className="project-chat-starter-btn"
                                    disabled={isSubmitting}
                                    onClick={() => void sendQuestion(prompt)}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    <form
                        className="project-chat-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void sendQuestion(draft);
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            className="project-chat-input"
                            data-testid="project-chat-input"
                            rows={2}
                            maxLength={MAX_CHAT_MESSAGE_CHARS}
                            value={draft}
                            placeholder="Ask about Mars, the Moon, 3D equipment, NASA/USGS sources... (Enter to send, Shift+Enter for a new line)"
                            aria-label="Enter a question for the RISE assistant"
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    closeDialog();
                                    return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    void sendQuestion(draft);
                                }
                            }}
                        />
                        <div className="project-chat-form-footer">
                            <span className="project-chat-char-count">
                                {draft.length}/{MAX_CHAT_MESSAGE_CHARS}
                            </span>
                            <button
                                type="submit"
                                className="project-chat-send-btn"
                                data-testid="project-chat-send"
                                disabled={isSubmitting || !draft.trim()}
                            >
                                {isSubmitting ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
