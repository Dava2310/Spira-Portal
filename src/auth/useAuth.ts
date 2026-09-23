import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from '@/auth/auth-context';

/**
 * Reads the session.
 * @returns The auth context.
 * @throws Error If used outside `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
