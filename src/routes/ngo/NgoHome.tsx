import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { CancellationReasonCode } from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import { PickupPass } from '@/components/PickupPass';
import {
  dueLabel,
  getReservations,
  releaseReservation,
  RELEASE_REASONS,
  reservationsQueryKey,
  type ReservationVM,
} from '@/features/reservations/_logic';

/**
 * The NGO's home: what they have claimed and the pass to collect it with.
 *
 * Deliberately not a dashboard. The job on arriving at a shop is to show the right
 * code, so the active claim and its pass are the screen, and everything else is a
 * link away.
 */
export function NgoHome() {
  const { session } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Outstanding only: a delivered claim belongs under Collected, not here.
  const claims = useQuery({
    queryKey: reservationsQueryKey(undefined, true),
    queryFn: () => getReservations(undefined, true),
  });

  const list = claims.data ?? [];
  const selected =
    list.find((item) => item.id === selectedId) ?? list[0] ?? null;

  if (claims.isPending) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-brand-brown/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your claims…
      </p>
    );
  }

  if (claims.error) {
    return (
      <p
        role="alert"
        className="m-4 rounded-xl bg-red-50 p-3 text-xs text-red-700"
      >
        {claims.error instanceof Error
          ? claims.error.message
          : 'Could not load your claims.'}
      </p>
    );
  }

  return (
    <section className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-brand-brown">
          {session?.organizationName ?? 'Your organisation'}
        </h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {list.length === 0
            ? 'Nothing claimed right now.'
            : `${list.length} ${list.length === 1 ? 'claim' : 'claims'} to collect.`}
        </p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-3xl border border-border-tan bg-white p-8 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-amber/15 text-brand-amber">
            <Package className="h-8 w-8" />
          </span>
          <h2 className="text-base font-semibold text-brand-ink">
            No claims yet
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-brand-brown/70">
            Browse what shops near you are giving away, and claim what your van
            can carry.
          </p>
          <Link
            to="/ngo/shelf"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-amber px-5 py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-amber-hover"
          >
            <Package className="h-4 w-4" />
            Browse what is available
          </Link>
        </div>
      ) : (
        <>
          {list.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {list.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={selected?.id === item.id}
                  className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                    selected?.id === item.id
                      ? 'border-brand-amber bg-brand-amber text-brand-brown'
                      : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
                  }`}
                >
                  {item.code}
                </button>
              ))}
            </div>
          )}

          {selected && <ClaimDetail claim={selected} />}
        </>
      )}
    </section>
  );
}

function ClaimDetail({ claim }: { claim: ReservationVM }) {
  const [releasing, setReleasing] = useState(false);
  const due = dueLabel(claim);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border-tan bg-white p-3.5">
        <div className="mb-2.5 flex items-start justify-between gap-2 border-b border-border-tan/60 pb-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-brand-ink">
              {claim.retailerName}
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
            </p>
            <p className="truncate text-[11px] text-brand-brown/70">
              {claim.storeLabel}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              due === 'Overdue'
                ? 'border-urgency-critical/40 bg-urgency-critical/10 text-urgency-critical'
                : 'border-border-tan bg-surface-cream text-brand-brown/70'
            }`}
          >
            {due}
          </span>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-brand-brown/80">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-brown/50" />
          {claim.storeAddress}
        </p>

        {claim.pickupWindowLabel && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-brand-brown/80">
            <Clock className="h-3.5 w-3.5 shrink-0 text-brand-brown/50" />
            {claim.pickupWindowLabel}
          </p>
        )}

        {claim.storePhone && (
          <a
            href={`tel:${claim.storePhone}`}
            className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-brand-brown underline"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-brand-brown/50" />
            {claim.storeContactName
              ? `${claim.storeContactName} · ${claim.storePhone}`
              : claim.storePhone}
          </a>
        )}

        {claim.accessInstructions && (
          <p className="mt-2.5 rounded-xl bg-surface-cream px-3 py-2 text-[11px] leading-relaxed text-brand-brown/80">
            {claim.accessInstructions}
          </p>
        )}

        <p className="mt-2.5 border-t border-border-tan/60 pt-2.5 text-[11px] font-medium text-brand-brown/80">
          {claim.lineCount} {claim.lineCount === 1 ? 'lot' : 'lots'} ·{' '}
          {claim.totalWeightKg} kg
          {claim.estimatedMeals !== null &&
            claim.estimatedMeals > 0 &&
            ` · ~${claim.estimatedMeals} meals`}
        </p>
      </div>

      {claim.pass ? (
        <PickupPass pass={claim.pass} />
      ) : (
        <p className="rounded-2xl border border-dashed border-border-tan bg-surface-cream/50 px-3 py-4 text-center text-[11px] text-brand-brown/70">
          The shop issues your collection pass when the crates are ready. It
          will appear here.
        </p>
      )}

      {claim.lines.length > 0 && (
        <ul className="divide-y divide-border-tan/60 rounded-2xl border border-border-tan bg-white px-3">
          {claim.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-2.5">
              {line.imageUrl ? (
                <img
                  src={line.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-lg bg-surface-cream" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-brand-ink">
                  {line.productName}
                </p>
                <p className="truncate text-[10px] text-brand-brown/70">
                  {line.brand ? `${line.brand} · ` : ''}
                  {line.quantity} {line.unitLabel ?? line.unit.toLowerCase()} ·{' '}
                  {line.weightKg} kg
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setReleasing(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border-tan py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream"
      >
        <X className="h-3.5 w-3.5" />
        Release this claim
      </button>

      {releasing && (
        <ReleaseDialog claim={claim} onClose={() => setReleasing(false)} />
      )}
    </div>
  );
}

function ReleaseDialog({
  claim,
  onClose,
}: {
  claim: ReservationVM;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState<CancellationReasonCode | null>(null);
  const [note, setNote] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      if (!code) {
        throw new Error('Choose a reason first.');
      }

      const label =
        RELEASE_REASONS.find((reason) => reason.code === code)?.label ??
        'Released';

      await releaseReservation(claim.id, code, note.trim() || label);
    },
    onSuccess: async () => {
      // The stock goes back on the shelf, so both lists are now stale.
      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/50 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border-tan bg-white p-5">
        <h2 className="text-base font-semibold text-brand-ink">
          Release {claim.code}?
        </h2>
        <p className="mt-1 text-xs text-brand-brown/70">
          The crates go back on the shelf for another organisation to claim.
        </p>

        <div className="mt-4 space-y-1.5">
          {RELEASE_REASONS.map((reason) => (
            <button
              key={reason.code}
              onClick={() => setCode(reason.code)}
              aria-pressed={code === reason.code}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition ${
                code === reason.code
                  ? 'border-brand-amber bg-brand-amber/10 text-brand-ink'
                  : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
              }`}
            >
              {reason.label}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs font-medium text-brand-brown/80">
          Anything to add <span className="font-normal">(optional)</span>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border-tan px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-amber"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error instanceof Error ? error.message : 'Could not release it.'}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-tan py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream"
          >
            Keep it
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending || code === null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Release
          </button>
        </div>
      </div>
    </div>
  );
}
