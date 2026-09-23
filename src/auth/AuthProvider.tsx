import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import {
  getSession,
  logout as logoutRequest,
  sessionQueryKey,
} from '@/features/auth/_logic';
import { setUnauthorizedHandler } from '@/lib/axios';
import { getTokenSnapshot, subscribeToToken } from '@/lib/token-storage';

/**
 * Holds the session for the whole app.
 *
 * The token lives in localStorage and the session is derived from it by calling
 * `GET /api/me` — the token is never trusted for its contents. That means a
 * revoked or expired token fails closed on the first request rather than showing a
 * shell populated from a stale JWT payload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Subscribed rather than read directly: clearing the token on a 401 has to
  // re-render the guards, or they stay on whatever they last decided — which left
  // a rejected token showing "Loading your account…" forever.
  const token = useSyncExternalStore(
    subscribeToToken,
    getTokenSnapshot,
    () => null,
  );

  const { data, isPending, error, refetch } = useQuery({
    queryKey: sessionQueryKey,
    queryFn: getSession,
    // Only ask for a session when there is a token to exchange. Without this the
    // sign-in page would fire a request it knows will 401.
    enabled: token !== null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const signOut = useCallback(async () => {
    await logoutRequest();
    queryClient.clear();
  }, [queryClient]);

  const adoptSession = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  }, [queryClient]);

  // A 401 anywhere in the app means the token is gone. Drop the cache so no screen
  // keeps rendering another account's data.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear();
    });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session: data ?? null,
      // A missing token is not "loading" — it is a known signed-out state. The
      // distinction matters because `isPending` is also true for a query that is
      // disabled and has never run.
      isLoading: token !== null && isPending,
      error: error as Error | null,
      refresh,
      signOut,
      adoptSession,
    }),
    [data, isPending, error, token, refresh, signOut, adoptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
