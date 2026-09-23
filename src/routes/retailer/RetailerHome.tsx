import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronRight,
  FileCheck,
  HeartHandshake,
  Loader2,
  Package,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DonationSort,
  DonationStatus,
  InventoryItemStatus,
} from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import {
  dashboardQueryKey,
  getDashboard,
  type DashboardVM,
} from '@/features/dashboard/_logic';
import {
  donationsQueryKey,
  getDonations,
  linesLabel,
  type DonationFilters,
  type DonationVM,
} from '@/features/donations/_logic';
import {
  expiryPhrase,
  getLots,
  lotsQueryKey,
  type LotFilters,
  type LotVM,
} from '@/features/inventory/_logic';

const card = 'rounded-2xl border border-border-tan bg-white p-3.5';
const cardHead =
  'mb-2.5 flex items-center justify-between gap-2 border-b border-border-tan/60 pb-2.5';
const caption = 'text-[11px] font-semibold text-brand-brown/70';

/**
 * The retailer's home screen.
 *
 * Reads `GET /api/retailer/dashboard`, which the API assembles for this screen, so
 * the metrics are not re-derived here — the prototype summed a client-side array
 * and disagreed with itself once anything was paged.
 */
export function RetailerHome() {
  const { session } = useAuth();
  const locationId = session?.primaryLocationId ?? '';

  const dashboard = useQuery({
    queryKey: dashboardQueryKey(locationId),
    queryFn: () => getDashboard(locationId),
    enabled: locationId !== '',
  });

  // The dashboard gives a count of what is urgent; this gives the few rows to show.
  const urgentFilters: LotFilters = {
    locationId,
    status: InventoryItemStatus.InInventory,
    expiringWithinHours: 24,
    limit: 3,
  };
  const urgent = useQuery({
    queryKey: lotsQueryKey(urgentFilters),
    queryFn: () => getLots(urgentFilters),
    enabled: locationId !== '',
  });

  const deliveredFilters: DonationFilters = {
    locationId,
    status: [DonationStatus.Delivered],
    sort: DonationSort.CompletedAtDesc,
    limit: 3,
  };
  const delivered = useQuery({
    queryKey: donationsQueryKey(deliveredFilters),
    queryFn: () => getDonations(deliveredFilters),
    enabled: locationId !== '',
  });

  if (dashboard.isPending) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-brand-brown/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your branch…
      </p>
    );
  }

  if (dashboard.error) {
    return (
      <p
        role="alert"
        className="m-4 rounded-xl bg-red-50 p-3 text-xs text-red-700"
      >
        {dashboard.error instanceof Error
          ? dashboard.error.message
          : 'Could not load your dashboard.'}
      </p>
    );
  }

  const data = dashboard.data;

  return (
    <section className="space-y-3.5 p-4">
      <header>
        <h1 className="text-lg font-semibold text-brand-brown">
          Hello
          {session?.primaryContactName ? `, ${session.primaryContactName}` : ''}
        </h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {session?.organizationName}
        </p>
      </header>

      {data && <Metrics data={data} />}

      {data?.nextPickup && <NextPickupCard pickup={data.nextPickup} />}

      {data !== undefined && data.urgentCount > 0 && (
        <div className={card}>
          <div className={cardHead}>
            <span className={`flex items-center gap-1.5 ${caption}`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              Near expiry · {data.urgentCount}
            </span>
            <Link
              to="/retailer/inventory"
              className="flex items-center gap-0.5 text-[11px] font-semibold text-brand-brown underline"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <ul className="divide-y divide-border-tan/60">
            {urgent.data?.lots.map((lot) => (
              <UrgentRow key={lot.id} lot={lot} />
            ))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className={cardHead}>
          <span className={`flex items-center gap-1.5 ${caption}`}>
            <FileCheck className="h-3.5 w-3.5" />
            Recent handovers
          </span>
          <span className="rounded-full border border-border-tan bg-surface-cream px-2 py-0.5 text-[10px] font-semibold text-brand-brown/70">
            {data?.deliveredCount ?? 0} delivered
          </span>
        </div>

        {delivered.data && delivered.data.donations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-tan bg-surface-cream/50 py-5 text-center">
            <HeartHandshake className="mx-auto mb-1 h-7 w-7 text-brand-brown/30" />
            <p className="text-xs font-semibold text-brand-brown">
              No completed handovers yet
            </p>
            <p className="mt-0.5 text-[11px] text-brand-brown/70">
              Stage some stock and confirm the driver&apos;s code to complete
              your first one.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-tan/60">
            {delivered.data?.donations.map((donation) => (
              <HandoverRow key={donation.id} donation={donation} />
            ))}
          </ul>
        )}
      </div>

      <Link
        to="/retailer/inventory"
        className="flex items-center gap-3 rounded-2xl border border-border-tan bg-white p-3.5 transition hover:border-brand-amber"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-tan bg-surface-cream text-brand-brown/70">
          <Package className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-brand-brown">
            Donate from stock
          </span>
          <span className="block text-[11px] text-brand-brown/70">
            {data?.inventoryCount ?? 0} lots in inventory
          </span>
        </span>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-brand-brown/40" />
      </Link>
    </section>
  );
}

function Metrics({ data }: { data: DashboardVM }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-border-tan text-center">
      <Metric value={String(data.readyLineCount)} label="Staged lots" />
      <Metric value={`${data.readyWeightKg} kg`} label="Pickup weight" />
      <Metric value={`~${data.readyMeals}`} label="Meals" />
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2">
      <span className="text-base font-bold tracking-tight text-brand-ink">
        {value}
      </span>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-brand-brown/70">
        {label}
      </p>
    </div>
  );
}

function NextPickupCard({
  pickup,
}: {
  pickup: NonNullable<DashboardVM['nextPickup']>;
}) {
  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={caption}>Next pickup · {pickup.code}</span>
        {pickup.etaLabel && (
          <span className="rounded-full border border-border-tan bg-surface-cream px-2 py-0.5 text-[10px] font-semibold text-brand-brown/70">
            {pickup.etaLabel}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-tan bg-surface-cream text-brand-brown/70">
          <Truck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-brand-ink">
            {pickup.recipientName}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-brand-brown/70">
            {[pickup.contactPerson, pickup.vehiclePlate]
              .filter(Boolean)
              .join(' · ') || 'Driver not named yet'}
          </p>
        </div>
      </div>
    </div>
  );
}

function UrgentRow({ lot }: { lot: LotVM }) {
  const phrase = expiryPhrase(lot);

  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2.5">
        {lot.imageUrl ? (
          <img
            src={lot.imageUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-lg bg-surface-cream" />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-brand-ink">
            {lot.productName}
          </p>
          <p className="truncate text-[10px] text-brand-brown/70">
            {lot.brand ? `${lot.brand} · ` : ''}
            {lot.quantity} {lot.unitLabel ?? lot.unit.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {phrase && (
          <span className="text-[10px] font-medium text-brand-brown/70">
            {phrase}
          </span>
        )}
        {lot.urgency && <UrgencyBadge urgency={lot.urgency} />}
      </div>
    </li>
  );
}

function HandoverRow({ donation }: { donation: DonationVM }) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] font-semibold text-brand-ink">
          {donation.code}
        </span>
        {donation.completedAt && (
          <span className="text-[10px] text-brand-brown/70">
            ·{' '}
            {donation.completedAt.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs font-semibold text-brand-ink">
        {donation.recipientName ?? 'Unknown partner'}
      </p>
      <p className="text-[10px] text-brand-brown/70">
        {linesLabel(donation.lineCount)} · {donation.totalWeightKg} kg rescued
        {donation.estimatedMeals !== null &&
          donation.estimatedMeals > 0 &&
          ` · ~${donation.estimatedMeals} meals`}
      </p>
    </li>
  );
}
