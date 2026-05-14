/**
 * Quiz analytics debug helper — development only.
 *
 * Registers window.__quizDebug when import.meta.env.DEV is true.
 * In production builds Vite strips the if-block entirely.
 *
 * Import this file once as a side-effect:
 *   import '@/quiz/quizDebug';
 *
 * Console API:
 *   __quizDebug.sessions()          — list all session IDs with pending events
 *   __quizDebug.inspect(sessionId)  — console.table() of all events
 *   __quizDebug.timeline(sessionId) — readable one-line-per-event log
 *   __quizDebug.clear(sessionId)    — remove events for one session
 *   __quizDebug.clearAll()          — remove events for all sessions
 */

import { getSessionEvents, clearSessionEvents } from './quizEventQueue';

// ---------------------------------------------------------------------------
// Shared summary formatter (used by both console helper and panel component)
// ---------------------------------------------------------------------------

export function buildEventSummary(ev) {
    switch (ev.eventType) {
        case 'QUESTION_VIEWED':
            return `q#${ev.questionIndex} of ${ev.totalQuestions ?? '?'}`;
        case 'OPTION_SELECTED':
            return `q#${ev.questionIndex} → "${ev.selectedOption}"`;
        case 'ANSWER_SUBMITTED': {
            const mark = ev.isCorrect ? '✓' : '✗';
            return `q#${ev.questionIndex} ${mark}  ${ev.responseTimeMs}ms  score=${ev.score} streak=${ev.streak}`;
        }
        case 'QUESTION_ADVANCED':
            return `${ev.fromIndex} → ${ev.toIndex ?? 'results'}`;
        case 'QUIZ_COMPLETED':
            return `score=${ev.finalScore}/${ev.totalQuestions} streak=${ev.finalStreak}`;
        case 'QUIZ_RESET':
            return `at q#${ev.atQuestionIndex} score=${ev.atScore}`;
        default:
            return '';
    }
}

// ---------------------------------------------------------------------------
// Console registration
// ---------------------------------------------------------------------------

if (import.meta.env.DEV) {
    function sessionIds() {
        const ids = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cognify_quiz_events_')) {
                ids.push(key.slice('cognify_quiz_events_'.length));
            }
        }
        return ids;
    }

    window.__quizDebug = Object.freeze({
        /** List all session IDs that have events in localStorage. */
        sessions() {
            const ids = sessionIds();
            console.log(`[QuizDebug] ${ids.length} session(s)`, ids);
            return ids;
        },

        /** Print all events for a session as a console.table. */
        inspect(sessionId) {
            const events = getSessionEvents(sessionId);
            console.group(`[QuizDebug] ${events.length} event(s) — ${sessionId}`);
            console.table(events);
            console.groupEnd();
            return events;
        },

        /** Print a human-readable timeline for a session. */
        timeline(sessionId) {
            const events = getSessionEvents(sessionId);
            console.group(`[QuizDebug] Timeline — ${sessionId}`);
            events.forEach((ev, i) => {
                const d = new Date(ev.timestamp);
                const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
                const num = String(i).padStart(2, '0');
                const type = ev.eventType.padEnd(20);
                const summary = buildEventSummary(ev);
                console.log(`  ${num}  ${type}  @${time}  ${summary}`);
            });
            console.groupEnd();
            return events;
        },

        /** Remove events for a specific session from localStorage. */
        clear(sessionId) {
            clearSessionEvents(sessionId);
            console.log(`[QuizDebug] Cleared session ${sessionId}`);
        },

        /** Remove events for ALL sessions from localStorage. */
        clearAll() {
            const ids = sessionIds();
            ids.forEach(id => clearSessionEvents(id));
            console.log(`[QuizDebug] Cleared ${ids.length} session(s)`);
        },
    });

    console.log(
        '%c[QuizDebug] Ready%c  window.__quizDebug.sessions() | .inspect(id) | .timeline(id) | .clear(id)',
        'color:#fbbf24;font-weight:bold',
        'color:#6b7280',
    );
}
