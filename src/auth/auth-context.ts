import { createContext } from 'react';

import type { SessionVM } from '@/features/auth/_logic';

export interface AuthContextValue {
  /** The signed-in account, or null when signed out. */
  session: SessionVM | null;

  /** True while the stored token is being exchanged for a session. */
  isLoading: boolean;

  /** Set when loading the session failed for a reason other than a 401. */
  error: Error | null;

  /** Re-reads the session — call after anything that changes the organization. */
  refresh: () => Promise<void>;

  /** Signs out and clears the cache. */
  signOut: () => Promise<void>;

  /** Adopts a token that a sign-in or registration just stored. */
  adoptSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
