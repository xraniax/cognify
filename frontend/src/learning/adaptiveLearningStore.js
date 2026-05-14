/**
 * adaptiveLearningStore.js
 * 
 * Centralized Adaptive Learning Event Store.
 * Ingests events from quiz, flashcards, and exams to feed future adaptive learning algorithms.
 * 
 * Architecture Goals:
 * - In-memory querying + localStorage persistence
 * - Append-only architecture (no mutation of past events)
 * - Framework agnostic (no React dependencies)
 * - Ready for mastery scoring, difficulty adaptation, and learner profiling.
 */

const INDEX_KEY = 'cognify_als_sessions';
const SESSION_PREFIX = 'cognify_als_session_';

// ─── In-Memory State ────────────────────────────────────────────────────────

let sessionIndex = new Set();
let events = []; // Flat array of all events for fast querying

// ─── Persistence Logic ──────────────────────────────────────────────────────

/**
 * Initialize store from localStorage.
 * Runs automatically on module evaluation.
 */
function init() {
    try {
        const rawIndex = localStorage.getItem(INDEX_KEY);
        if (rawIndex) {
            const sessions = JSON.parse(rawIndex);
            sessionIndex = new Set(sessions);
            
            events = [];
            for (const sessionId of sessionIndex) {
                const rawSession = localStorage.getItem(`${SESSION_PREFIX}${sessionId}`);
                if (rawSession) {
                    const sessionEvents = JSON.parse(rawSession);
                    events.push(...sessionEvents);
                }
            }
            
            // Ensure chronological order across sessions
            events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Enforce immutability on loaded events
            events.forEach(e => Object.freeze(e));
        }
    } catch (e) {
        console.warn('[AdaptiveLearningStore] Failed to initialize from localStorage', e);
        sessionIndex = new Set();
        events = [];
    }
}

/**
 * Persist the session index to localStorage.
 */
function persistIndex() {
    try {
        localStorage.setItem(INDEX_KEY, JSON.stringify(Array.from(sessionIndex)));
    } catch (e) {
        console.warn('[AdaptiveLearningStore] Failed to persist index', e);
    }
}

/**
 * Persist a specific session's events to localStorage.
 * @param {string} sessionId 
 * @param {Array<Object>} sessionEvents 
 */
function persistSession(sessionId, sessionEvents) {
    try {
        localStorage.setItem(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(sessionEvents));
    } catch (e) {
        console.warn(`[AdaptiveLearningStore] Failed to persist session ${sessionId}`, e);
    }
}

// ─── Query Utilities ────────────────────────────────────────────────────────

/**
 * Internal utility to apply standard filters.
 * @param {Array<Object>} sourceEvents 
 * @param {Object} filters 
 * @returns {Array<Object>}
 */
function applyFilters(sourceEvents, filters = {}) {
    let result = sourceEvents;
    
    if (filters.source) {
        result = result.filter(e => e.source === filters.source);
    }
    if (filters.eventType) {
        result = result.filter(e => e.eventType === filters.eventType);
    }
    if (filters.sessionId) {
        result = result.filter(e => e.sessionId === filters.sessionId);
    }
    
    // Always return a shallow copy to prevent external mutation of the internal array structure
    return [...result];
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Append a new learning event to the store.
 * The event is deep-cloned and frozen to enforce append-only immutability.
 * 
 * @param {Object} event - The learning event conforming to learningEventSchema
 */
export function appendEvent(event) {
    if (!event || !event.sessionId) {
        console.warn('[AdaptiveLearningStore] Cannot append event without a sessionId');
        return;
    }

    // Deep clone and freeze to enforce append-only immutability
    const frozenEvent = Object.freeze(JSON.parse(JSON.stringify(event)));
    
    // Update in-memory state
    events.push(frozenEvent);
    
    // Track session in index
    const isNewSession = !sessionIndex.has(frozenEvent.sessionId);
    if (isNewSession) {
        sessionIndex.add(frozenEvent.sessionId);
        persistIndex();
    }
    
    // Persist session events
    const sessionEvents = events.filter(e => e.sessionId === frozenEvent.sessionId);
    persistSession(frozenEvent.sessionId, sessionEvents);
}

/**
 * Get all events across all sessions.
 * 
 * @param {Object} [filters] - Optional filters { source, eventType, sessionId }
 * @returns {Array<Object>}
 */
export function getAllEvents(filters = {}) {
    return applyFilters(events, filters);
}

/**
 * Get all events for a specific session.
 * 
 * @param {string} sessionId 
 * @param {Object} [filters] - Optional additional filters { source, eventType }
 * @returns {Array<Object>}
 */
export function getEventsBySession(sessionId, filters = {}) {
    return applyFilters(events, { ...filters, sessionId });
}

/**
 * Get all events for a specific subject.
 * 
 * @param {string} subjectId 
 * @param {Object} [filters] - Optional additional filters { source, eventType, sessionId }
 * @returns {Array<Object>}
 */
export function getEventsBySubject(subjectId, filters = {}) {
    const subjectEvents = events.filter(e => e.subjectId === subjectId);
    return applyFilters(subjectEvents, filters);
}

/**
 * Clear all events for a specific session from memory and storage.
 * 
 * @param {string} sessionId 
 */
export function clearSession(sessionId) {
    if (!sessionIndex.has(sessionId)) return;
    
    // Update in-memory state
    events = events.filter(e => e.sessionId !== sessionId);
    sessionIndex.delete(sessionId);
    
    // Update localStorage
    persistIndex();
    try {
        localStorage.removeItem(`${SESSION_PREFIX}${sessionId}`);
    } catch (e) {
        console.warn(`[AdaptiveLearningStore] Failed to remove session ${sessionId} from storage`, e);
    }
}

// ─── Initialization ─────────────────────────────────────────────────────────

init();
