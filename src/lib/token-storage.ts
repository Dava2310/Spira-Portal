/**
 * The access token, held in localStorage so a refresh does not sign the user out.
 *
 * Deliberately the only thing this app persists. Both prototypes cached entities
 * in localStorage and drifted out of sync with each other; the API is the source
 * of truth now, and React Query owns the cache.
 *
 * Keys are namespaced `spira.portal.*` to avoid the unversioned `spira_*` keys
 * the two prototypes left behind on this origin.
 */
const TOKEN_KEY = 'spira.portal.accessToken';
const EXPIRES_KEY = 'spira.portal.expiresAt';

/** Reads the stored token, or null when absent, expired, or storage is blocked. */
export function getToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      return null;
    }

    const expiresAt = localStorage.getItem(EXPIRES_KEY);

    // Discard a token we already know is stale rather than spending a request to
    // be told 401. Tokens last 2h and there is no refresh flow yet.
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      clearToken();

      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Stores the token and its expiry.
 * @param token The access token from `POST /api/auth/login`.
 * @param expiresAt The ISO expiry the same response carries.
 */
export function setToken(token: string, expiresAt?: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);

    if (expiresAt) {
      localStorage.setItem(EXPIRES_KEY, expiresAt);
    }
  } catch {
    // A private window with storage blocked still works for one session.
  }
}

/** Removes the token, on logout or on a 401. */
export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch {
    // Nothing to do — the in-memory instance is being torn down anyway.
  }
}
