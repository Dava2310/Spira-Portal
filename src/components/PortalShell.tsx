import { Loader2, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { BottomNav } from '@/components/BottomNav';
import { SpiraLogo } from '@/components/SpiraLogo';

/**
 * The one shell both sides render inside.
 *
 * Both prototypes were a hardcoded `max-w-md` mobile column with their own fixed
 * bottom nav, so neither could be nested. One shell means one header, one nav and
 * one place to change the layout.
 */
export function PortalShell() {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Guarded against a second click: the first request revokes the token, so the
  // second would be answered 401 by the denylist.
  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border-tan bg-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-tan bg-white/95 px-4 py-3 backdrop-blur">
        <SpiraLogo size="sm" />
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-brand-brown/70 transition hover:bg-surface-cream disabled:opacity-60"
          aria-label="Sign out"
        >
          {isSigningOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          Sign out
        </button>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {session && !session.isVerified && (
        <p className="border-t border-border-tan bg-surface-cream px-4 py-2 text-center text-[11px] text-brand-brown/70">
          Your organisation is awaiting verification.
        </p>
      )}

      {/* Hidden until a retailer has a branch — there is nowhere to navigate to
          before setup, and offering tabs that bounce back reads as a bug. */}
      {session &&
        (session.side !== 'retailer' || session.primaryLocationId) && (
          <BottomNav side={session.side} />
        )}
    </div>
  );
}
