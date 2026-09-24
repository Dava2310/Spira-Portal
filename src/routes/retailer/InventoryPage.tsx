import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, PackageSearch, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  InventoryItemStatus,
  ProductCategory,
  SurplusUrgency,
} from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import {
  CATEGORY_LABELS,
  EXPIRY_KIND_LABELS,
  expiryPhrase,
  facetsQueryKey,
  getFacets,
  getLots,
  lotsQueryKey,
  REASON_LABELS,
  type LotFilters,
  type LotVM,
} from '@/features/inventory/_logic';

const PAGE_SIZE = 20;

/**
 * The retailer's surplus stock.
 *
 * Ported from the prototype's `InventoryTab`, with every derived value now coming
 * from the API instead of being recomputed here. The prototype filtered a
 * client-side array; this filters server-side, so the counts are right even when
 * the list is paged.
 */
export function InventoryPage() {
  const { session } = useAuth();
  const locationId = session?.primaryLocationId ?? '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProductCategory | undefined>();
  const [urgency, setUrgency] = useState<SurplusUrgency | undefined>();

  const filters = useMemo<LotFilters>(
    () => ({
      locationId,
      q: search.trim() || undefined,
      category,
      urgency,
      status: InventoryItemStatus.InInventory,
      limit: PAGE_SIZE,
    }),
    [locationId, search, category, urgency],
  );

  // Infinite rather than paged: the cursor is deliberately not part of the query
  // key, so fetching the next page appends to this list instead of replacing it.
  const lotsQuery = useInfiniteQuery({
    queryKey: lotsQueryKey(filters),
    queryFn: ({ pageParam }) => getLots(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: locationId !== '',
  });

  const lots = lotsQuery.data?.pages.flatMap((page) => page.lots) ?? [];
  const total = lotsQuery.data?.pages[0]?.total ?? 0;

  // Separate query, and deliberately not keyed on the filters — the chips must
  // report what the branch holds, not what survived the current filter.
  const facetsQuery = useQuery({
    queryKey: facetsQueryKey(locationId, InventoryItemStatus.InInventory),
    queryFn: () => getFacets(locationId, InventoryItemStatus.InInventory),
    enabled: locationId !== '',
  });

  return (
    <section className="p-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-brand-brown">Inventory</h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {facetsQuery.data
            ? `${facetsQuery.data.total} lots in stock`
            : 'Loading…'}
        </p>
      </header>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-brown/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, brand or barcode"
          className="w-full rounded-xl border border-border-tan py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-amber"
        />
      </div>

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <Chip
          active={urgency === undefined}
          onClick={() => setUrgency(undefined)}
        >
          All
        </Chip>
        {Object.values(SurplusUrgency).map((value) => (
          <Chip
            key={value}
            active={urgency === value}
            onClick={() => setUrgency(urgency === value ? undefined : value)}
          >
            {value === SurplusUrgency.Critical
              ? 'Critical'
              : value === SurplusUrgency.Expiring
                ? 'Expiring'
                : 'Standard'}
            {facetsQuery.data
              ? ` ${facetsQuery.data.byUrgency[value] ?? 0}`
              : ''}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Object.values(ProductCategory).map((value) => {
          const count = facetsQuery.data?.byCategory[value] ?? 0;

          return (
            <Chip
              key={value}
              active={category === value}
              // Every category renders, zeros included — the chips must not appear
              // and disappear as stock changes.
              dimmed={count === 0}
              onClick={() =>
                setCategory(category === value ? undefined : value)
              }
            >
              {CATEGORY_LABELS[value]} {count}
            </Chip>
          );
        })}
      </div>

      {lotsQuery.isPending && (
        <p className="flex items-center gap-2 py-8 text-sm text-brand-brown/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading inventory…
        </p>
      )}

      {lotsQuery.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {lotsQuery.error instanceof Error
            ? lotsQuery.error.message
            : 'Could not load your inventory.'}
        </p>
      )}

      {lotsQuery.isSuccess && lots.length === 0 && (
        <div className="py-10 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-brand-brown/30" />
          <p className="mt-2 text-sm text-brand-brown/70">
            {search || category || urgency
              ? 'Nothing matches those filters.'
              : 'No surplus logged yet.'}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {lots.map((lot) => (
          <LotRow key={lot.id} lot={lot} />
        ))}
      </ul>

      {lotsQuery.hasNextPage && (
        <button
          onClick={() => void lotsQuery.fetchNextPage()}
          disabled={lotsQuery.isFetchingNextPage}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border-tan py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
        >
          {lotsQuery.isFetchingNextPage && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Load more ({total - lots.length} remaining)
        </button>
      )}
    </section>
  );
}

function Chip({
  active,
  dimmed,
  onClick,
  children,
}: {
  active: boolean;
  dimmed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-brand-amber bg-brand-amber text-brand-brown'
          : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
      } ${dimmed && !active ? 'opacity-45' : ''}`}
    >
      {children}
    </button>
  );
}

function LotRow({ lot }: { lot: LotVM }) {
  const phrase = expiryPhrase(lot);

  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border-tan p-3">
      {lot.imageUrl ? (
        <img
          src={lot.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-xl bg-surface-cream" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-brand-brown">
            {lot.productName}
          </p>
          {lot.urgency && <UrgencyBadge urgency={lot.urgency} />}
        </div>

        <p className="mt-0.5 truncate text-xs text-brand-brown/70">
          {lot.brand ? `${lot.brand} · ` : ''}
          {lot.quantity} {lot.unitLabel ?? lot.unit.toLowerCase()} ·{' '}
          {lot.weightKg} kg
          {lot.retailValue !== null && ` · ${lot.retailValue} ${lot.currency}`}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-brand-brown/60">
          <span>{REASON_LABELS[lot.reason]}</span>
          {lot.expiryKind && (
            <span>· {EXPIRY_KIND_LABELS[lot.expiryKind]}</span>
          )}
          {phrase && (
            <span
              className={
                lot.isPastUseBy ? 'font-semibold text-urgency-critical' : ''
              }
            >
              · {phrase}
            </span>
          )}
          {lot.isListed && (
            <span className="rounded bg-brand-amber/20 px-1.5 py-0.5 font-medium text-brand-brown">
              on the shelf
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
