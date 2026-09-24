import type { SurplusPackageResponseDto } from '@/api-client';
import {
  ProductCategory,
  SurplusPackageSort,
  SurplusUrgency,
} from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/**
 * One store's claimable surplus, as the shelf lists it.
 *
 * A "package" is everything one branch has on offer right now, not a single lot:
 * an NGO sends a van to a shop, so the shop is the unit of decision.
 */
export interface ShelfPackageVM {
  locationId: string;
  storeLabel: string;
  retailerName: string;
  retailerIsVerified: boolean;
  logoUrl: string | null;

  address: string;
  neighborhood: string | null;
  city: string;
  phone: string | null;

  /** Straight from the API, which knows the origin the search was run from. */
  distanceKm: number | null;

  availableCount: number;
  totalWeightKg: number;
  totalValue: number;
  currency: string;
  estimatedMeals: number;

  categories: ProductCategory[];
  categorySummary: Record<string, number>;
  highestUrgency: SurplusUrgency | null;
  earliestExpiryHoursLeft: number | null;

  /** Today's collection windows, already formatted by the API. */
  pickupHoursToday: string[];
}

/**
 * One page of the shelf, plus what the search was run with.
 *
 * The two kinds of count are named apart on purpose. The API's `totalPackages` and
 * `filteredPackages` count claimable *lots*, while `count` and `total` count
 * *stores* — easy to mix up, and a header reading "3 of 3 shops" when one shop holds
 * three lots is exactly the mistake that invites.
 */
export interface ShelfPageVM {
  packages: ShelfPackageVM[];

  /** Claimable lots in range, ignoring the filters. */
  lotsInRange: number;

  /** Claimable lots matching the filters. */
  lotsMatching: number;

  /** Stores matching the filters, across every page. */
  storesMatching: number;

  nextCursor: string | null;
  radiusKm: number;
  hasOrigin: boolean;
}

/** The filter state the shelf screen owns. */
export interface ShelfFilters {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  q?: string;
  category?: ProductCategory;
  urgency?: SurplusUrgency;
  sort?: SurplusPackageSort;
  limit?: number;
}

// --- 2. MAPPERS ---

/**
 * Maps a surplus package onto the view model.
 *
 * `distanceKm` is taken as given rather than recomputed: the server knows which
 * origin the search ran from, and the browser's last known position may not be it.
 * @param dto The package from the API.
 * @returns The package view model.
 */
export const toShelfPackageVM = (
  dto: SurplusPackageResponseDto,
): ShelfPackageVM => ({
  locationId: dto.locationId,
  storeLabel: dto.label,
  retailerName: dto.retailerName,
  retailerIsVerified: dto.isVerified,
  logoUrl: dto.logoUrl ?? null,
  address: dto.address,
  neighborhood: dto.neighborhood ?? null,
  city: dto.city,
  phone: dto.phone ?? null,
  distanceKm: dto.distanceKm ?? null,
  availableCount: dto.availableCount,
  totalWeightKg: dto.totalWeightKg,
  totalValue: dto.totalValue,
  currency: dto.currency,
  estimatedMeals: dto.estimatedMeals,
  categories: dto.categories,
  categorySummary: dto.categorySummary,
  highestUrgency: dto.highestUrgency ?? null,
  earliestExpiryHoursLeft: dto.earliestExpiryHoursLeft ?? null,
  pickupHoursToday: dto.pickupHoursToday ?? [],
});

/**
 * Phrases a distance for a row, in the units someone driving a van thinks in.
 * @param km The distance, or null when the search had no origin.
 * @returns A phrase, or null when there is no distance to show.
 */
export function distanceLabel(km: number | null): string | null {
  if (km === null) {
    return null;
  }

  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Phrases how long the most pressing lot in a package has left.
 * @param hours Hours until the earliest expiry, or null.
 * @returns A phrase, or null when nothing in the package expires.
 */
export function soonestExpiryLabel(hours: number | null): string | null {
  if (hours === null) {
    return null;
  }

  if (hours < 0) {
    return 'Past best-by';
  }

  if (hours < 24) {
    return `${Math.max(0, Math.round(hours))}h left`;
  }

  const days = Math.floor(hours / 24);

  return days === 1 ? '1 day left' : `${days} days left`;
}

/**
 * Asks the browser where the van is now.
 *
 * The shelf takes an explicit origin, so the nearest shops can be found without any
 * setup at all — which matters because a driver's useful origin is wherever they are
 * standing, not a saved depot address.
 * @returns A Promise that resolves with a position, or null when it is unavailable
 * or refused.
 */
export const findCurrentPosition = async (): Promise<{
  lat: number;
  lng: number;
} | null> => {
  if (!('geolocation' in navigator)) {
    return null;
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      // Refusing is an ordinary answer, not a fault: the shelf still works
      // unsorted, so this resolves rather than rejects.
      () => resolve(null),
      { timeout: 10000, maximumAge: 300000 },
    );
  });
};

// --- 3. API CALLS ---

/**
 * Query key for a page of the shelf.
 * @param filters The filters in force.
 * @returns The query key.
 */
export const shelfQueryKey = (filters: ShelfFilters) =>
  ['shelf', filters] as const;

/**
 * Browses the claimable surplus near the caller.
 * @param filters Where to look, how far, and what to narrow to.
 * @param cursor The page to fetch, from a previous page's `nextCursor`.
 * @returns A Promise that resolves with one page of the shelf.
 */
export const getShelf = async (
  filters: ShelfFilters,
  cursor?: string,
): Promise<ShelfPageVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindSurplusPackages(
        {
          lat: filters.lat,
          lng: filters.lng,
          radiusKm: filters.radiusKm,
          q: filters.q,
          category: filters.category,
          urgency: filters.urgency,
          sort: filters.sort,
          limit: filters.limit,
          cursor,
        },
      );

    const body = response.data;

    return {
      packages: body.data.map(toShelfPackageVM),
      lotsInRange: body.meta.totalPackages,
      lotsMatching: body.meta.filteredPackages,
      storesMatching: body.meta.total,
      nextCursor: body.meta.nextCursor ?? null,
      radiusKm: body.meta.radiusKm,
      hasOrigin: body.meta.originLatitude !== null,
    };
  } catch (error) {
    throwError(error, 'Could not load what is available nearby.');
  }
};

/**
 * Reads one store's claimable lots, so the claim screen can list them.
 *
 * The same endpoint as the shelf, narrowed to one branch — the package a store
 * offers is assembled server-side, so asking for it again here keeps the two views
 * consistent by construction.
 * @param locationId The branch to read.
 * @returns A Promise that resolves with the package, or null when it is gone.
 */
export const getShelfPackage = async (
  locationId: string,
): Promise<ShelfPackageVM | null> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindSurplusPackages(
        { locationId, limit: 1 },
      );

    const first = response.data.data[0];

    return first ? toShelfPackageVM(first) : null;
  } catch (error) {
    throwError(error, 'Could not load that store.');
  }
};
