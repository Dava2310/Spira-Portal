import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { homePathFor } from '@/auth/paths';
import { useAuth } from '@/auth/useAuth';
import type { PortalSide } from '@/features/auth/_logic';

/**
 * Gates a route tree on which side of the platform the account belongs to.
 *
 * Signed-out callers go to `/login`, remembering where they were headed. An account
 * on the wrong side is redirected to its own home rather than shown an empty screen
 * — the API would refuse those requests with a 403 anyway, so showing the tree
 * would only produce a page of errors.
 *
 * ADMIN passes every check, mirroring the API's RolesGuard.
 */
export function RequireSide({ side }: { side: PortalSide }) {
  const { session, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-brand-brown/60">Loading your account…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (session.side !== side && session.side !== 'admin') {
    return <Navigate to={homePathFor(session.side)} replace />;
  }

  return <Outlet />;
}

/**
 * Keeps a signed-in account away from `/login` and `/register`.
 *
 * Without this, a signed-in user following a bookmarked sign-in link would be
 * offered a form that logs them into the account they already have.
 */
export function RedirectIfSignedIn() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (session) {
    return <Navigate to={homePathFor(session.side)} replace />;
  }

  return <Outlet />;
}
