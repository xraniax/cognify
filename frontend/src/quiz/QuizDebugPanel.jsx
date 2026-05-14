/**
 * QuizDebugPanel — development-only event inspector overlay.
 *
 * Renders a fixed-position panel (bottom-right) showing the in-memory event
 * queue for the current quiz session. Helps verify event ordering, duplicates,
 * missing events, and response timing before backend integration.
 *
 * IS_DEV is a compile-time constant — Vite strips this module's JSX in prod.
 * Hooks are always called (React rules), but the component renders null in prod.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getSessionEvents, clearSessionEvents } from './quizEventQueue';
import { buildEventSummary } from './quizDebug';

const IS_DEV = import.meta.env.DEV;

// ---------------------------------------------------------------------------
// Per-event-type display config
// ---------------------------------------------------------------------------

const TYPE_CFG = {
    QUESTION_VIEWED:   { bg: '#1e3a5f', text: '#60a5fa', label: 'VIEWED'    },
    OPTION_SELECTED:   { bg: '#1f2937', text: '#9ca3af', label: 'SELECTED'  },
    ANSWER_SUBMITTED:  { bg: '#064e3b', text: '#34d399', label: 'SUBMITTED' },
    QUESTION_ADVANCED: { bg: '#2e1065', text: '#a78bfa', label: 'ADVANCED'  },
    QUIZ_COMPLETED:    { bg: '#451a03', text: '#fbbf24', label: 'COMPLETED' },
    QUIZ_RESET:        { bg: '#450a0a', text: '#f87171', label: 'RESET'     },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function formatTime(iso) {
    try {
        const d = new Date(iso);
        return [
            String(d.getHours()).padStart(2, '0'),
            String(d.getMinutes()).padStart(2, '0'),
            String(d.getSeconds()).padStart(2, '0'),
        ].join(':') + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
        return '??:??:??.???';
    }
}

function EventRow({ ev, index }) {
    const cfg = TYPE_CFG[ev.eventType] ?? { bg: '#1f2937', text: '#e5e7eb', label: ev.eventType };
    return (
        <div style={{
            display: 'flex', alignItems: 'baseline', gap: 7,
            padding: '3px 12px', borderBottom: '1px solid #1a2030',
        }}>
            <span style={{ color: '#4b5563', minWidth: 18, textAlign: 'right', flexShrink: 0 }}>{index}</span>
            <span style={{
                background: cfg.bg, color: cfg.text,
                borderRadius: 3, padding: '1px 5px',
                fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            }}>{cfg.label}</span>
            <span style={{ color: '#4b5563', flexShrink: 0, fontSize: 10 }}>{formatTime(ev.timestamp)}</span>
            <span style={{ color: '#d1d5db', fontSize: 11 }}>{buildEventSummary(ev)}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const BTN = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 11, fontFamily: 'monospace', padding: '2px 7px',
    borderRadius: 3,
};

export default function QuizDebugPanel({ sessionRef, eventQueueRef }) {
    const [open, setOpen] = useState(false);
    const [events, setEvents] = useState([]);

    const refresh = useCallback(() => {
        // Prefer in-memory ref (always current); fall back to localStorage read.
        const src = eventQueueRef?.current;
        setEvents(Array.isArray(src) ? [...src] : getSessionEvents(sessionRef?.current?.sessionId ?? ''));
    }, [eventQueueRef, sessionRef]);

    useEffect(() => {
        if (!IS_DEV || !open) return;
        refresh();
    }, [open, refresh]);

    // Render nothing in production — hooks are still called to satisfy React's rules.
    if (!IS_DEV) return null;

    const sessionId = sessionRef?.current?.sessionId ?? '';
    const shortId   = sessionId ? sessionId.slice(0, 8) : '—';

    const duplicateTypes = (() => {
        const counts = {};
        events.forEach(ev => { counts[ev.eventType] = (counts[ev.eventType] ?? 0) + 1; });
        return Object.entries(counts).filter(([, n]) => n > 1).map(([t]) => t);
    })();

    return (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, fontFamily: 'monospace', fontSize: 12 }}>
            {open && (
                <div style={{
                    width: 440, maxHeight: 500,
                    background: '#0d1117', color: '#e5e7eb',
                    borderRadius: 8, overflow: 'hidden',
                    boxShadow: '0 6px 28px rgba(0,0,0,0.7)',
                    display: 'flex', flexDirection: 'column',
                    marginBottom: 8, border: '1px solid #30363d',
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '7px 12px', background: '#161b22',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #30363d',
                    }}>
                        <span style={{ color: '#8b949e', fontSize: 11 }}>
                            Quiz Debug &nbsp;
                            <span style={{ color: '#fbbf24' }}>{shortId}…</span>
                            &nbsp;·&nbsp;
                            <span style={{ color: '#60a5fa' }}>{events.length} evt</span>
                            {duplicateTypes.length > 0 && (
                                <span style={{ color: '#f87171', marginLeft: 8 }}>
                                    ⚠ dup: {duplicateTypes.join(', ')}
                                </span>
                            )}
                        </span>
                        <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={refresh} style={{ ...BTN, color: '#60a5fa' }}>↺ refresh</button>
                            <button
                                onClick={() => { clearSessionEvents(sessionId); setEvents([]); }}
                                style={{ ...BTN, color: '#f87171' }}
                            >✕ clear</button>
                        </div>
                    </div>

                    {/* Event list */}
                    <div style={{ overflowY: 'auto', flex: 1, padding: '2px 0' }}>
                        {events.length === 0
                            ? <div style={{ padding: '20px 12px', color: '#4b5563', textAlign: 'center' }}>
                                No events — interact with the quiz then click ↺ refresh
                              </div>
                            : events.map((ev, i) => <EventRow key={i} ev={ev} index={i} />)
                        }
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '5px 12px', background: '#161b22',
                        color: '#4b5563', borderTop: '1px solid #30363d', fontSize: 10,
                    }}>
                        window.__quizDebug.inspect('{shortId}…') · .timeline() · .clear()
                    </div>
                </div>
            )}

            {/* Toggle button */}
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background: open ? '#161b22' : '#0d1117',
                    color: open ? '#e5e7eb' : '#6b7280',
                    border: '1px solid #30363d',
                    borderRadius: 6, padding: '5px 11px',
                    cursor: 'pointer', fontFamily: 'monospace', fontSize: 11,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    display: 'block', marginLeft: 'auto',
                }}
            >
                {open ? '✕ close' : `⚡ DBG${events.length > 0 ? ` [${events.length}]` : ''}`}
            </button>
        </div>
    );
}
