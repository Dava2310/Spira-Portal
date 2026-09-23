import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  MapPin,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { InventoryItemStatus } from '@/api-client';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import {
  expiryPhrase,
  getLots,
  lotsQueryKey,
  REASON_LABELS,
  type LotFilters,
  type LotVM,
} from '@/features/inventory/_logic';
import {
  getPickupSlots,
  pickupSlotsQueryKey,
  slotDaysLabel,
  type PickupSlotVM,
} from '@/features/pickup-slots/_logic';
import { claimSurplus } from '@/features/reservations/_logic';
import {
  distanceLabel,
  getShelfPackage,
  type ShelfPackageVM,
} from '@/features/shelf/_logic';
import { statusOf } from '@/lib/error-utils';

/**
 * One shop's shelf, and the claim built from it.
 *
 * Selection is per lot rather than all-or-nothing, because a van has a size and a
 * foodbank has storage: taking three crates and leaving the rest for someone else
 * is the normal case, not an edge one.
 */
export function StorePage() {
  const { locationId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [slotId, setSlotId] = useState<string | null>(null);
  const [from, setFrom] = useState(defaultWindow().from);
  const [to, setTo] = useState(defaultWindow().to);

  const store = useQuery({
    queryKey: ['shelf', 'store', locationId],
    queryFn: () => getShelfPackage(locationId),
    enabled: locationId !== '',
  });

  // Only what the shop has published. A lot it has not listed is not on offer,
  // whatever the inventory route would return if asked.
  const filters: LotFilters = {
    locationId,
    status: InventoryItemStatus.InInventory,
    isListed: true,
    limit: 50,
  };
  const lots = useQuery({
    queryKey: lotsQueryKey(filters),
    queryFn: () => getLots(filters),
    enabled: locationId !== '',
  });

  const slots = useQuery({
    queryKey: pickupSlotsQueryKey(locationId),
    queryFn: () => getPickupSlots(locationId),
    enabled: locationId !== '',
  });

  const claim = useMutation({
    // A claim has to say when the van is coming: the API takes one of the shop's
    // published windows, or a proposed start and end, and refuses neither given.
    mutationFn: () =>
      claimSurplus(
        slotId !== null
          ? {
              locationId,
              inventoryItemIds: [...picked],
              pickupSlotId: slotId,
            }
          : {
              locationId,
              inventoryItemIds: [...picked],
              pickupWindowStart: new Date(from).toISOString(),
              pickupWindowEnd: new Date(to).toISOString(),
            },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reservations'] });
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
      navigate('/ngo', { replace: true });
    },
  });

  const toggle = (id: string) => {
    setPicked((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const available = lots.data?.lots ?? [];
  const chosen = available.filter((lot) => picked.has(lot.id));
  const chosenWeight =
    Math.round(chosen.reduce((sum, lot) => sum + lot.weightKg, 0) * 10) / 10;

  return (
    <section className="p-4 pb-28">
      <Link
        to="/ngo/shelf"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-brown/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to available shops
      </Link>

      {store.isPending && (
        <p className="flex items-center gap-2 py-8 text-sm text-brand-brown/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the shop…
        </p>
      )}

      {store.data && <StoreHeader store={store.data} />}

      {store.isSuccess && store.data === null && (
        <p className="py-8 text-center text-sm text-brand-brown/70">
          This shop has nothing on the shelf any more.
        </p>
      )}

      {lots.isSuccess && available.length === 0 && store.data !== null && (
        <div className="py-10 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-brand-brown/30" />
          <p className="mt-2 text-sm text-brand-brown/70">
            Everything here has just been claimed.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {available.map((lot) => (
          <LotChoice
            key={lot.id}
            lot={lot}
            picked={picked.has(lot.id)}
            onToggle={() => toggle(lot.id)}
          />
        ))}
      </ul>

      {claim.error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {/* A 409 is the ordinary race on an open shelf, not a fault. */}
          {statusOf(claim.error) === 409
            ? 'Another organisation claimed some of that first. Refresh to see what is left.'
            : claim.error instanceof Error
              ? claim.error.message
              : 'Could not claim that surplus.'}
        </p>
      )}

      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-border-tan bg-white/95 p-3 backdrop-blur">
          <WhenPicker
            slots={slots.data ?? []}
            slotId={slotId}
            onSlot={setSlotId}
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
          />

          <button
            onClick={() => claim.mutate()}
            disabled={claim.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
          >
            {claim.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Claim {picked.size} {picked.size === 1 ? 'lot' : 'lots'} ·{' '}
            {chosenWeight} kg
          </button>
        </div>
      )}
    </section>
  );
}

function StoreHeader({ store }: { store: ShelfPackageVM }) {
  const distance = distanceLabel(store.distanceKm);

  return (
    <div className="rounded-2xl border border-border-tan bg-white p-3.5">
      <p className="flex items-center gap-1 text-sm font-semibold text-brand-ink">
        {store.retailerName}
        {store.retailerIsVerified && (
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
        )}
      </p>
      <p className="text-[11px] text-brand-brown/70">{store.storeLabel}</p>

      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-brand-brown/80">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
        {store.address}
        {distance && ` · ${distance}`}
      </p>

      {store.pickupHoursToday.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-brand-brown/80">
          <Clock className="h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
          Collect today: {store.pickupHoursToday.join(', ')}
        </p>
      )}

      <p className="mt-2 border-t border-border-tan/60 pt-2 text-[11px] font-medium text-brand-brown/80">
        {store.availableCount} {store.availableCount === 1 ? 'lot' : 'lots'} ·{' '}
        {store.totalWeightKg} kg
        {store.estimatedMeals > 0 && ` · ~${store.estimatedMeals} meals`}
      </p>
    </div>
  );
}

function LotChoice({
  lot,
  picked,
  onToggle,
}: {
  lot: LotVM;
  picked: boolean;
  onToggle: () => void;
}) {
  const phrase = expiryPhrase(lot);

  return (
    <li>
      <button
        onClick={onToggle}
        aria-pressed={picked}
        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
          picked
            ? 'border-brand-amber bg-brand-amber/10'
            : 'border-border-tan bg-white hover:border-brand-amber/60'
        }`}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
            picked
              ? 'border-brand-amber bg-brand-amber text-brand-brown'
              : 'border-border-tan'
          }`}
        >
          {picked && <Check className="h-3.5 w-3.5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold text-brand-brown">
              {lot.productName}
            </span>
            {lot.urgency && <UrgencyBadge urgency={lot.urgency} />}
          </span>

          <span className="mt-0.5 block truncate text-xs text-brand-brown/70">
            {lot.brand ? `${lot.brand} · ` : ''}
            {lot.quantity} {lot.unitLabel ?? lot.unit.toLowerCase()} ·{' '}
            {lot.weightKg} kg
          </span>

          <span className="mt-1 block text-[11px] text-brand-brown/60">
            {REASON_LABELS[lot.reason]}
            {phrase && ` · ${phrase}`}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A sensible default collection window: this evening, or tomorrow evening once the
 * shop's usual closing hour has passed.
 * @returns The two values the datetime inputs start on.
 */
function defaultWindow(): { from: string; to: string } {
  const start = new Date();

  if (start.getHours() >= 19) {
    start.setDate(start.getDate() + 1);
  }

  start.setHours(18, 0, 0, 0);

  const end = new Date(start);
  end.setHours(20, 0, 0, 0);

  const local = (value: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');

    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  };

  return { from: local(start), to: local(end) };
}

/**
 * Chooses when the van will arrive.
 *
 * Shows the shop's own published windows when it has any, because agreeing to one of
 * those needs no negotiation. A shop with none is common — nothing in branch setup
 * requires them — so proposing a time has to stay possible.
 */
function WhenPicker({
  slots,
  slotId,
  onSlot,
  from,
  to,
  onFrom,
  onTo,
}: {
  slots: PickupSlotVM[];
  slotId: string | null;
  onSlot: (id: string | null) => void;
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <div className="mb-2.5">
      <p className="mb-1.5 text-[11px] font-semibold text-brand-brown/70">
        When will you collect?
      </p>

      {slots.length > 0 && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => onSlot(slotId === slot.id ? null : slot.id)}
              aria-pressed={slotId === slot.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
                slotId === slot.id
                  ? 'border-brand-amber bg-brand-amber text-brand-brown'
                  : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
              }`}
            >
              {slotDaysLabel(slot)} {slot.windowLabel}
            </button>
          ))}
        </div>
      )}

      {slotId === null && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-medium text-brand-brown/60">
            From
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => onFrom(event.target.value)}
              className="mt-0.5 w-full rounded-lg border border-border-tan px-2 py-1.5 text-xs text-brand-ink outline-none focus:border-brand-amber"
            />
          </label>
          <label className="text-[10px] font-medium text-brand-brown/60">
            Until
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => onTo(event.target.value)}
              className="mt-0.5 w-full rounded-lg border border-border-tan px-2 py-1.5 text-xs text-brand-ink outline-none focus:border-brand-amber"
            />
          </label>
        </div>
      )}
    </div>
  );
}
