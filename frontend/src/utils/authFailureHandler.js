/**
 * authFailureHandler.js
 *
 * Centralized handler for 401 Unauthorized responses.
 * Guarantees exactly ONE redirect regardless of how many parallel requests
 * return 401 simultaneously.
 */

let redirecting = false;

/**
 * Call this from the Axios interceptor on every 401.
 * All subsequent calls while a redirect is in-flight are no-ops.
 */
export function handleAuthFailure() {
    if (redirecting) return;
    redirecting = true;

    localStorage.removeItem('token');

    if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
    }
}

/**
 * Reset the guard after a successful login or session restoration.
 * Must be called in the login success path so the next session works correctly.
 */
export function resetAuthFailureGuard() {
    redirecting = false;
}
