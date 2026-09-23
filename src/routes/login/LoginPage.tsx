import { Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { homePathFor } from '@/auth/paths';
import { SpiraLogo } from '@/components/SpiraLogo';
import { login } from '@/features/auth/_logic';

/** Sign-in. Neither prototype had one — both assumed an authenticated user. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adoptSession } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const side = await login(email, password);

      // Pull the session before navigating, so the guard on the destination does
      // not immediately bounce us back to /login while the query is still pending.
      await adoptSession();

      const from = (location.state as { from?: string } | null)?.from;

      navigate(from ?? homePathFor(side), { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not sign you in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-cream px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <SpiraLogo size="lg" />
          <p className="text-sm text-brand-brown/70">
            Waste ends. Value circulates.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-border-tan bg-white p-6 shadow-sm"
        >
          <h1 className="mb-5 text-lg font-semibold text-brand-brown">
            Sign in
          </h1>

          <label className="mb-1.5 block text-xs font-medium text-brand-brown/80">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber"
            />
          </label>

          <label className="mb-4 mt-3 block text-xs font-medium text-brand-brown/80">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-brand-brown/70">
          New to Spira?{' '}
          <Link
            to="/register"
            className="font-semibold text-brand-brown underline"
          >
            Register your organisation
          </Link>
        </p>
      </div>
    </main>
  );
}
