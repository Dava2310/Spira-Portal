import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';

/**
 * Sends a retailer with no branch to set one up first.
 *
 * Every retailer screen scopes to a branch, and registration deliberately does not
 * ask for one. Without this gate a fresh account lands on an inventory list that
 * cannot be queried, which reads as a broken app rather than an unfinished setup.
 */
export function RequireBranch() {
  const { session } = useAuth();

  if (session && session.side === 'retailer' && !session.primaryLocationId) {
    return <Navigate to="/retailer/setup" replace />;
  }

  return <Outlet />;
}
