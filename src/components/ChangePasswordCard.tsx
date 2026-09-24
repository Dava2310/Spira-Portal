import { useMutation } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { changePassword } from '@/features/account/_logic';

const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-amber';

/**
 * Changing the account password, on either side's profile.
 *
 * The API revokes the current token on success, so this signs out afterwards rather
 * than leaving a session running on a password that no longer exists.
 */
export function ChangePasswordCard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');

  const save = useMutation({
    mutationFn: () => changePassword(oldPassword, newPassword),
    onSuccess: async () => {
      await signOut();
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="rounded-2xl border border-border-tan bg-white p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 border-b border-border-tan/60 pb-2.5 text-[11px] font-semibold text-brand-brown/70">
        <KeyRound className="h-3.5 w-3.5" />
        Password
      </p>

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="block text-xs font-medium text-brand-brown/80">
            Current password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={oldPassword}
              onChange={(event) => setOld(event.target.value)}
              className={field}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-brand-brown/80">
            New password
            <input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNew(event.target.value)}
              className={field}
            />
          </label>
          <p className="mt-1 text-[11px] text-brand-brown/60">
            At least 12 characters, with an uppercase letter, a lowercase letter
            and a digit. You will be signed out and asked to sign in again.
          </p>

          {save.error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {save.error instanceof Error
                ? save.error.message
                : 'Could not change your password.'}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border-tan py-2 text-xs font-semibold text-brand-brown"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2 text-xs font-semibold text-brand-brown disabled:opacity-60"
            >
              {save.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Change it
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-[11px] font-semibold text-brand-brown underline"
        >
          Change your password
        </button>
      )}
    </div>
  );
}
