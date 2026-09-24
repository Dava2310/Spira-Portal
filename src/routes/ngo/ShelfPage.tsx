import { useQuery } from '@tanstack/react-query';
import {
  Crosshair,
  Loader2,
  MapPin,
  PackageSearch,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  ProductCategory,
  SurplusPackageSort,
  SurplusUrgency,
} from '@/api-client';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { CATEGORY_LABELS } from '@/features/inventory/_logic';
import {
  distanceLabel,
  findCurrentPosition,
  getShelf,
  shelfQueryKey,
  soonestExpiryLabel,
  type ShelfFilters,
  type ShelfPackageVM,
  type ShelfPageVM,
} from '@/features/shelf/_logic';

/**
 * The surplus shelf: what shops nearby are giving away.
 *
 * A row is a *store*, not a lot, because an NGO sends a van to a shop — the
 * decision is which shop is worth the trip. The API assembles each store's package
 * and its distance, so neither is worked out here.
 */
export function ShelfPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ProductCategory | undefined>();
  const [urgency, setUrgency] = useState<SurplusUrgency | undefined>();
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);
  const [locationRefused, setLocationRefused] = useState(false);

  const filters = useMemo<ShelfFilters>(
    () => ({
      q: search.trim() || undefined,
      category,
      urgency,
      lat: origin?.lat,
      lng: origin?.lng,
      sort: origin ? SurplusPackageSort.Distance : undefined,
      limit: 20,
    }),
    [search, category, urgency, origin],
  );

  const locate = async () => {
    setLocating(true);
    setLocationRefused(false);

    const position = await findCurrentPosition();

    if (position === null) {
      setLocationRefused(true);
    } else {
      setOrigin(position);
    }

    setLocating(false);
  };

  const shelf = useQuery({
    queryKey: shelfQueryKey(filters),
    queryFn: () => getShelf(filters),
  });

  return (
    <section className="p-4">
      <header className="mb-3">
        <h1 className="text-lg font-semibold text-brand-brown">
          Available now
        </h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {shelf.data ? summarise(shelf.data) : 'Loading…'}
        </p>
      </header>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-brown/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search shop, area or product"
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
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {Object.values(ProductCategory).map((value) => (
          <Chip
            key={value}
            active={category === value}
            onClick={() => setCategory(category === value ? undefined : value)}
          >
            {CATEGORY_LABELS[value]}
          </Chip>
        ))}
      </div>

      {!shelf.isPending && shelf.data && !shelf.data.hasOrigin && (
        <div className="mb-3 rounded-xl border border-border-tan bg-surface-cream px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-brand-brown/80">
            These are not sorted by distance yet. Share where you are, or save a
            collection base in your profile.
          </p>
          <button
            onClick={() => void locate()}
            disabled={locating}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-border-tan bg-white px-2.5 py-1.5 text-[11px] font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Find shops near me
          </button>
          {locationRefused && (
            <p className="mt-1.5 text-[11px] text-brand-brown/70">
              Your browser did not share a position. The list below still shows
              everything available.
            </p>
          )}
        </div>
      )}

      {shelf.isPending && (
        <p className="flex items-center gap-2 py-8 text-sm text-brand-brown/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking for surplus
          nearby…
        </p>
      )}

      {shelf.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {shelf.error instanceof Error
            ? shelf.error.message
            : 'Could not load what is available nearby.'}
        </p>
      )}

      {shelf.isSuccess && shelf.data.packages.length === 0 && (
        <div className="py-10 text-center">
          <PackageSearch className="mx-auto h-8 w-8 text-brand-brown/30" />
          <p className="mt-2 text-sm text-brand-brown/70">
            {search || category || urgency
              ? 'Nothing matches those filters.'
              : 'No shop nearby has surplus on the shelf right now.'}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {shelf.data?.packages.map((item) => (
          <StoreRow key={item.locationId} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Words the header count.
 * @param page The page just loaded.
 * @returns For example `3 lots at 1 shop within 5 km`.
 */
function summarise(page: ShelfPageVM): string {
  const lots = `${page.lotsMatching} ${page.lotsMatching === 1 ? 'lot' : 'lots'}`;
  const shops = `${page.storesMatching} ${page.storesMatching === 1 ? 'shop' : 'shops'}`;

  return `${lots} at ${shops} within ${page.radiusKm} km`;
}

function Chip({
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-brand-amber bg-brand-amber text-brand-brown'
          : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
      }`}
    >
      {children}
    </button>
  );
}

function StoreRow({ item }: { item: ShelfPackageVM }) {
  const distance = distanceLabel(item.distanceKm);
  const soonest = soonestExpiryLabel(item.earliestExpiryHoursLeft);

  return (
    <li>
      <Link
        to={`/ngo/shelf/${item.locationId}`}
        className="block rounded-2xl border border-border-tan bg-white p-3.5 transition hover:border-brand-amber"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-brand-ink">
              {item.retailerName}
              {item.retailerIsVerified && (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
              )}
            </p>
            <p className="truncate text-[11px] text-brand-brown/70">
              {item.storeLabel}
            </p>
          </div>
          {item.highestUrgency && (
            <UrgencyBadge urgency={item.highestUrgency} />
          )}
        </div>

        <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] text-brand-brown/70">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
          {item.neighborhood ? `${item.neighborhood}, ` : ''}
          {item.city}
          {distance && ` · ${distance}`}
        </p>

        <p className="mt-2 text-[11px] font-medium text-brand-brown/80">
          {item.availableCount} {item.availableCount === 1 ? 'lot' : 'lots'} ·{' '}
          {item.totalWeightKg} kg
          {item.estimatedMeals > 0 && ` · ~${item.estimatedMeals} meals`}
          {soonest && ` · ${soonest}`}
        </p>

        {item.categories.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {item.categories.slice(0, 4).map((value) => (
              <span
                key={value}
                className="rounded bg-surface-cream px-1.5 py-0.5 text-[10px] font-medium text-brand-brown/70"
              >
                {CATEGORY_LABELS[value]} {item.categorySummary[value] ?? ''}
              </span>
            ))}
            {item.categories.length > 4 && (
              <span className="px-1 text-[10px] text-brand-brown/60">
                +{item.categories.length - 4}
              </span>
            )}
          </p>
        )}

        {item.pickupHoursToday.length > 0 && (
          <p className="mt-1.5 text-[10px] text-brand-brown/60">
            Collect today: {item.pickupHoursToday.join(', ')}
          </p>
        )}
      </Link>
    </li>
  );
}
