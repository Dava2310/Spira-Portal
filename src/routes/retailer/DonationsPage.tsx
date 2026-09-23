import { useQuery } from '@tanstack/react-query';
import { Gift, Loader2, Package, ShieldCheck, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { DonationSort, DonationStatus } from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import {
  AWAITING_PICKUP_STATUSES,
  donationsQueryKey,
  linesLabel,
  getDonations,
  getOpenDonation,
  openDonationQueryKey,
  STATUS_LABELS,
  type DonationFilters,
  type DonationLineVM,
  type DonationVM,
} from '@/features/donations/_logic';
import { REASON_LABELS } from '@/features/inventory/_logic';

type SubView = 'ready' | 'delivered';

/**
 * The retailer's donation queue and its history.
 *
 * The queue is deliberately two sections, because they are two different jobs for
 * the shop. What is *staging* is the single basket still being filled, so it shows
 * its lots and comes from `GET /api/donations/current`. What is *awaiting
 * collection* is sealed and has a driver coming, so it shows who and when, ordered
 * by which window opens first.
 */
export function DonationsPage() {
  const { session } = useAuth();
  const locationId = session?.primaryLocationId ?? '';
  const [view, setView] = useState<SubView>('ready');

  const open = useQuery({
    queryKey: openDonationQueryKey(locationId),
    queryFn: () => getOpenDonation(locationId),
    enabled: locationId !== '',
  });

  const awaitingFilters: DonationFilters = {
    locationId,
    status: AWAITING_PICKUP_STATUSES,
    sort: DonationSort.PickupWindowStartAsc,
    limit: 20,
  };
  const awaiting = useQuery({
    queryKey: donationsQueryKey(awaitingFilters),
    queryFn: () => getDonations(awaitingFilters),
    enabled: locationId !== '',
  });

  const deliveredFilters: DonationFilters = {
    locationId,
    status: [DonationStatus.Delivered],
    sort: DonationSort.CompletedAtDesc,
    limit: 20,
  };
  const delivered = useQuery({
    queryKey: donationsQueryKey(deliveredFilters),
    queryFn: () => getDonations(deliveredFilters),
    enabled: locationId !== '',
  });

  const readyCount =
    (awaiting.data?.total ?? 0) +
    (open.data && open.data.lines.length > 0 ? 1 : 0);

  return (
    <section className="p-4">
      <header className="mb-3">
        <h1 className="text-lg font-semibold text-brand-brown">Donations</h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          Stock staged for collection, and what has already been handed over.
        </p>
      </header>

      <div className="mb-4 flex gap-1 rounded-2xl border border-border-tan bg-white p-1 text-xs">
        <Tab active={view === 'ready'} onClick={() => setView('ready')}>
          Queue ({readyCount})
        </Tab>
        <Tab active={view === 'delivered'} onClick={() => setView('delivered')}>
          Delivered ({delivered.data?.total ?? 0})
        </Tab>
      </div>

      {view === 'ready' ? (
        <QueueView open={open} awaiting={awaiting} />
      ) : (
        <DeliveredView query={delivered} />
      )}
    </section>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-xl py-2 text-center font-semibold transition ${
        active
          ? 'bg-brand-amber text-brand-brown'
          : 'text-brand-brown/70 hover:text-brand-brown'
      }`}
    >
      {children}
    </button>
  );
}

function QueueView({
  open,
  awaiting,
}: {
  open: { isPending: boolean; error: unknown; data?: DonationVM | null };
  awaiting: {
    isPending: boolean;
    error: unknown;
    data?: { donations: DonationVM[] };
  };
}) {
  if (open.isPending || awaiting.isPending) {
    return <Pending>Loading your queue…</Pending>;
  }

  if (open.error || awaiting.error) {
    return <Failed error={open.error ?? awaiting.error} />;
  }

  const donation = open.data;
  const staging = donation && donation.lines.length > 0 ? donation : null;
  const collecting = awaiting.data?.donations ?? [];

  if (!staging && collecting.length === 0) {
    return (
      <div className="rounded-3xl border border-border-tan bg-white p-8 text-center">
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-amber/15 text-brand-amber">
          <Gift className="h-8 w-8" />
        </span>
        <h2 className="text-base font-semibold text-brand-ink">
          Nothing staged yet
        </h2>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-brand-brown/70">
          Open <strong>Inventory</strong>, pick the lots you want to give away,
          and they will be gathered here as one batch.
        </p>
        <Link
          to="/retailer/inventory"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-amber px-5 py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-amber-hover"
        >
          <Package className="h-4 w-4" />
          Go to inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {collecting.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-brown/70">
            Awaiting collection
          </h2>
          <div className="space-y-2">
            {collecting.map((item) => (
              <DonationCard key={item.id} donation={item} />
            ))}
          </div>
        </div>
      )}

      {staging && (
        <div>
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-brown/70">
            Still staging
          </h2>
          <DonationCard donation={staging} />
          <ul className="mt-2 space-y-2">
            {staging.lines.map((line) => (
              <LineRow key={line.id} line={line} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DonationCard({ donation }: { donation: DonationVM }) {
  return (
    <div className="rounded-2xl border border-border-tan bg-white p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-border-tan/60 pb-2.5">
        <span className="font-mono text-[11px] font-semibold text-brand-ink">
          {donation.code}
        </span>
        <span className="rounded-full border border-border-tan bg-surface-cream px-2 py-0.5 text-[10px] font-semibold text-brand-brown/70">
          {STATUS_LABELS[donation.status]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-tan bg-surface-cream text-brand-brown/70">
          <Truck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-xs font-semibold text-brand-ink">
            {donation.recipientName ?? 'No partner assigned yet'}
            {donation.recipientIsVerified && (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-brand-brown/70">
            {[donation.driverName, donation.vehiclePlate]
              .filter(Boolean)
              .join(' · ') || 'Driver not named yet'}
          </p>
        </div>
      </div>

      {donation.pickupWindowLabel && (
        <p className="mt-2.5 border-t border-border-tan/60 pt-2.5 text-[11px] text-brand-brown/70">
          Collection window: {donation.pickupWindowLabel}
        </p>
      )}

      <p className="mt-2 text-[11px] font-medium text-brand-brown/80">
        {lineSummary(donation)}
      </p>
    </div>
  );
}

/**
 * Sums up a donation in one line.
 * @param donation The donation to describe.
 * @returns The summary text.
 */
function lineSummary(donation: DonationVM): string {
  const parts = [
    linesLabel(donation.lineCount),
    `${donation.totalWeightKg} kg`,
    `${donation.totalRetailValue} ${donation.currency}`,
  ];

  if (donation.estimatedMeals !== null && donation.estimatedMeals > 0) {
    parts.push(`~${donation.estimatedMeals} meals`);
  }

  return parts.join(' · ');
}

function DeliveredView({
  query,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    data?: { donations: DonationVM[]; total: number };
  };
}) {
  if (query.isPending) {
    return <Pending>Loading your handovers…</Pending>;
  }

  if (query.error) {
    return <Failed error={query.error} />;
  }

  if (!query.data || query.data.donations.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-brand-brown/70">
        No handovers completed yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {query.data.donations.map((donation) => (
        <li
          key={donation.id}
          className="rounded-2xl border border-border-tan bg-white p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-brand-ink">
              {donation.code}
            </span>
            {donation.completedAt && (
              <span className="text-[10px] text-brand-brown/70">
                {donation.completedAt.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-brand-ink">
            {donation.recipientName ?? 'Unknown partner'}
          </p>
          <p className="mt-0.5 text-[11px] text-brand-brown/70">
            {lineSummary(donation)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function LineRow({ line }: { line: DonationLineVM }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border-tan p-3">
      {line.imageUrl ? (
        <img
          src={line.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-cream" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-brand-brown">
            {line.productName}
          </p>
          {line.urgency && <UrgencyBadge urgency={line.urgency} />}
        </div>
        <p className="mt-0.5 truncate text-xs text-brand-brown/70">
          {line.brand ? `${line.brand} · ` : ''}
          {line.quantity} {line.unitLabel ?? line.unit.toLowerCase()} ·{' '}
          {line.weightKg} kg
        </p>
        <p className="mt-1 text-[11px] text-brand-brown/60">
          {REASON_LABELS[line.reason]}
          {line.reasonDescription && ` · ${line.reasonDescription}`}
        </p>
      </div>
    </li>
  );
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 py-8 text-sm text-brand-brown/60">
      <Loader2 className="h-4 w-4 animate-spin" /> {children}
    </p>
  );
}

function Failed({ error }: { error: unknown }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  );
}
