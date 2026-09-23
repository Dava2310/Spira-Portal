import { useMutation } from '@tanstack/react-query';
import { Loader2, Store } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/useAuth';
import { createRetailerBranch } from '@/features/locations/_logic';

const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber';
const label = 'mt-3 block text-xs font-medium text-brand-brown/80';

/**
 * First-run branch setup.
 *
 * Registration deliberately does not ask for a branch — someone signing up may not
 * know the address, and a long form loses people. But every retailer screen needs a
 * branch to scope to, so this stands between a fresh account and the rest of the app.
 *
 * The timezone is taken from the browser rather than asked for, and the country is
 * derived from it, because both are things we can know without a question.
 */
export function BranchSetupPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [label_, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('ES');
  const [accessInstructions, setAccessInstructions] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      if (!session?.retailer) {
        throw new Error('No retailer is linked to this account.');
      }

      return await createRetailerBranch({
        retailerId: session.retailer.id,
        label: label_,
        code: code || undefined,
        addressLine1,
        city,
        neighborhood: neighborhood || undefined,
        postalCode: postalCode || undefined,
        countryCode: countryCode.toUpperCase(),
        timezone: browserTimezone,
        accessInstructions: accessInstructions || undefined,
        isPrimary: true,
      });
    },
    // The session carries primaryLocationId, so it has to be re-read before the
    // guard will let this account through — and only then is it safe to navigate,
    // or the guard bounces them straight back here.
    onSuccess: async () => {
      await refresh();
      navigate('/retailer', { replace: true });
    },
  });

  return (
    <section className="p-5">
      <div className="mb-5 flex items-start gap-3">
        <Store className="mt-0.5 h-5 w-5 shrink-0 text-retailer-accent" />
        <div>
          <h1 className="text-lg font-semibold text-brand-brown">
            Add your first branch
          </h1>
          <p className="mt-1 text-xs text-brand-brown/70">
            Surplus is logged against a branch, so we need one before you can
            start.
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutate();
        }}
      >
        <label className={label}>
          Branch name
          <input
            required
            value={label_}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Eixample Branch"
            className={field}
          />
        </label>

        <label className={label}>
          Internal code <span className="font-normal">(optional)</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="MRC-BCN-01"
            className={field}
          />
        </label>

        <label className={label}>
          Street address
          <input
            required
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
            className={field}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            City
            <input
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Neighbourhood <span className="font-normal">(optional)</span>
            <input
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              className={field}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Postal code <span className="font-normal">(optional)</span>
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Country
            <input
              required
              maxLength={2}
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className={`${field} uppercase`}
            />
          </label>
        </div>

        <label className={label}>
          Arrival notes for drivers{' '}
          <span className="font-normal">(optional)</span>
          <textarea
            rows={2}
            value={accessInstructions}
            onChange={(event) => setAccessInstructions(event.target.value)}
            placeholder="Loading bay gate 2 on the side alley. Ring the Spira buzzer."
            className={field}
          />
        </label>

        <p className="mt-2 text-[11px] text-brand-brown/60">
          Timezone set from your browser: {browserTimezone}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error instanceof Error
              ? error.message
              : 'Could not create the branch.'}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isPending ? 'Creating…' : 'Create branch'}
        </button>
      </form>
    </section>
  );
}
