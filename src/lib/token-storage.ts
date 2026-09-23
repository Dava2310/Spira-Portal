/**
 * The access token, held in localStorage so a refresh does not sign the user out.
 *
 * Deliberately the only thing this app persists. Both prototypes cached entities
 * in localStorage and drifted out of sync with each other; the API is the source
 * of truth now, and React Query owns the cache.
 *
 * Reads go through a cached snapshot that components subscribe to, because
 * localStorage is not reactive: without this, clearing the token on a 401 leaves
 * every guard rendering whatever it decided on the previous render.
 *
 * Keys are namespaced `spira.portal.*` to avoid the unversioned `spira_*` keys
 * the two prototypes left behind on this origin.
 */
const TOKEN_KEY = 'spira.portal.accessToken';
const EXPIRES_KEY = 'spira.portal.expiresAt';

const listeners = new Set<() => void>();

/**
 * Whether an expiry timestamp is still in the future.
 *
 * An unparseable value counts as expired. Treating it as valid would silently
 * disable the staleness check for anything that wrote the key in the wrong format.
 * @param value The stored expiry.
 * @returns True when the token may still be used.
 */
function isFuture(value: string): boolean {
  const ms = new Date(value).getTime();

  return Number.isFinite(ms) && ms > Date.now();
}

/**
 * Reads the token from storage without touching it.
 *
 * Pure on purpose: this feeds the snapshot React reads during render, and a write
 * here would notify subscribers mid-render.
 * @returns The usable token, or null.
 */
function readToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      return null;
    }

    const expiresAt = localStorage.getItem(EXPIRES_KEY);

    if (expiresAt !== null && !isFuture(expiresAt)) {
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

let snapshot: string | null = readToken();

function emit(): void {
  snapshot = readToken();

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Subscribes to token changes, for `useSyncExternalStore`.
 * @param listener Called whenever the stored token changes.
 * @returns The unsubscribe function.
 */
export function subscribeToToken(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The cached token, stable between changes so React can compare it by value. */
export function getTokenSnapshot(): string | null {
  return snapshot;
}

/**
 * Reads the token for a request, discarding one that has already expired.
 *
 * Unlike the snapshot this writes, so it is only safe outside render.
 * @returns The token to send, or null.
 */
export function getToken(): string | null {
  const token = readToken();

  if (token === null && localStorage.getItem(TOKEN_KEY) !== null) {
    // Expired: drop it rather than spending a request to be told 401.
    clearToken();
  }

  return token;
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

  emit();
}

/** Removes the token, on logout or on a 401. */
export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  } catch {
    // Nothing to do — the in-memory instance is being torn down anyway.
  }

  emit();
}

// Signing out in one tab signs out the others.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === TOKEN_KEY || event.key === EXPIRES_KEY) {
      emit();
    }
  });
}
