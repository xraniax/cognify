/**
 * Quiz event queue — session-scoped localStorage persistence for quiz lifecycle events.
 *
 * Events are append-only and keyed by sessionId.
 * The queue survives page refreshes as long as the sessionId is restored from localStorage.
 *
 * This module does NOT transmit, batch, or deduplicate events.
 * clearSessionEvents() is intended for post-sync cleanup by the future transport layer.
 */

const STORAGE_PREFIX = 'cognify_quiz_events_';

function queueKey(sessionId) {
    return `${STORAGE_PREFIX}${sessionId}`;
}

function safeRead(sessionId) {
    try {
        const raw = localStorage.getItem(queueKey(sessionId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function safeWrite(sessionId, events) {
    try {
        localStorage.setItem(queueKey(sessionId), JSON.stringify(events));
    } catch {
        // Quota exceeded or storage unavailable — events survive in the in-memory ref only.
    }
}

/**
 * Append one event to the session's persisted queue.
 * Synchronous read → push → write — safe within single-tab JS execution.
 *
 * @param {string} sessionId
 * @param {Readonly<object>} event — frozen event object from a make*Event factory
 */
export function enqueueEvent(sessionId, event) {
    const queue = safeRead(sessionId);
    queue.push(event);
    safeWrite(sessionId, queue);
}

/**
 * Read all persisted events for a session.
 * Returns a fresh array — safe to push to without affecting the stored copy.
 *
 * @param {string} sessionId
 * @returns {object[]}
 */
export function getSessionEvents(sessionId) {
    return safeRead(sessionId);
}

/**
 * Remove a session's event queue from localStorage.
 * Intended for post-sync cleanup — do NOT call this on quiz reset.
 * Old session events should remain available until confirmed delivered.
 *
 * @param {string} sessionId
 */
export function clearSessionEvents(sessionId) {
    try {
        localStorage.removeItem(queueKey(sessionId));
    } catch {
        // ignore
    }
}
