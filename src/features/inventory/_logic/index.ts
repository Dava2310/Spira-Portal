import type {
  InventoryFacetsResponseDto,
  InventoryItemResponseDto,
} from '@/api-client';
import {
  DonationReason,
  ExpiryKind,
  InventoryItemSort,
  InventoryItemStatus,
  ProductCategory,
  SurplusUrgency,
  UnitOfMeasure,
} from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** One stock lot, as the inventory screens read it. */
export interface LotVM {
  id: string;
  productName: string;
  brand: string | null;
  category: ProductCategory | null;
  quantity: number;
  unit: string;
  unitLabel: string | null;
  weightKg: number;
  retailValue: number | null;
  currency: string;
  status: InventoryItemStatus;
  isListed: boolean;
  imageUrl: string | null;

  /** Parsed, so screens can sort and compare without re-parsing strings. */
  expiresAt: Date | null;

  /** Which kind of date `expiresAt` is. Null only when there is no expiry. */
  expiryKind: ExpiryKind | null;

  /**
   * True once a use-by date has passed, which closes the lot: it may no longer be
   * donated. Always false for a best-before lot, however long ago it passed.
   */
  isPastUseBy: boolean;

  /** Straight from the API — derived server-side so every client agrees. */
  urgency: SurplusUrgency | null;
  hoursRemaining: number | null;
  daysRemaining: number | null;

  reason: DonationReason;
  reasonDescription: string | null;
}

/** One page of lots plus the paging metadata. */
export interface LotPageVM {
  lots: LotVM[];
  total: number;
  nextCursor: string | null;
}

/** The filter state the inventory screen owns. */
export interface LotFilters {
  locationId: string;
  q?: string;
  category?: ProductCategory;
  reason?: DonationReason;
  urgency?: SurplusUrgency;
  status?: InventoryItemStatus;
  isListed?: boolean;

  /** Narrow to lots expiring inside this many hours. */
  expiringWithinHours?: number;

  /** Narrow to lots expiring inside this many days. */
  expiringWithinDays?: number;

  sort?: InventoryItemSort;
  limit?: number;
}

// --- 2. MAPPERS ---

/**
 * Maps a stock lot onto the view model.
 *
 * Note what is *not* mapped: `urgency`, `hoursRemaining` and `daysRemaining` come
 * straight from the API. Both prototypes computed their own and both drifted — one
 * hardcoded `daysRemaining: 1` on create, the other froze `expiryHoursLeft` into
 * localStorage. Recomputing here would reintroduce exactly that bug.
 *
 * The only real transform is parsing `expiresAt` into a `Date`, so screens can sort
 * and compare without re-parsing an ISO string on every render.
 * @param dto The lot from the API.
 * @returns The lot view model.
 */
export const toLotVM = (dto: InventoryItemResponseDto): LotVM => ({
  id: dto.id,
  productName: dto.product?.name ?? 'Unknown product',
  brand: dto.product?.brand ?? null,
  category: dto.product?.category ?? null,
  quantity: dto.quantity,
  unit: dto.unit,
  unitLabel: dto.unitLabel ?? null,
  weightKg: dto.weightKg,
  retailValue: dto.retailValue ?? null,
  currency: dto.currency,
  status: dto.status,
  isListed: dto.isListed,
  imageUrl: dto.displayImageUrl ?? null,
  expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
  expiryKind: dto.expiryKind ?? null,
  isPastUseBy: dto.isPastUseBy,
  urgency: dto.urgency ?? null,
  hoursRemaining: dto.hoursRemaining ?? null,
  daysRemaining: dto.daysRemaining ?? null,
  reason: dto.reason,
  reasonDescription: dto.reasonDescription ?? null,
});

/** Display labels for the reasons, which the API returns as enum members. */
export const REASON_LABELS: Record<DonationReason, string> = {
  [DonationReason.NearExpiry]: 'Near best-by',
  [DonationReason.DamagedPackaging]: 'Damaged packaging',
  [DonationReason.SurplusStock]: 'Surplus stock',
  [DonationReason.AestheticImperfection]: 'Aesthetic imperfection',
};

/** Display labels for the categories. */
export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  [ProductCategory.Bakery]: 'Bakery',
  [ProductCategory.Dairy]: 'Dairy',
  [ProductCategory.Produce]: 'Produce',
  [ProductCategory.Pantry]: 'Pantry',
  [ProductCategory.Meat]: 'Meat',
  [ProductCategory.Beverage]: 'Beverages',
  [ProductCategory.BabyCare]: 'Baby care',
  [ProductCategory.Deli]: 'Deli',
  [ProductCategory.Prepared]: 'Prepared',
};

/** How each kind of date is worded. The distinction is legal, so it is spelled out. */
export const EXPIRY_KIND_LABELS: Record<ExpiryKind, string> = {
  [ExpiryKind.BestBefore]: 'Best before',
  [ExpiryKind.UseBy]: 'Use by',
};

/**
 * Turns hours remaining into the short phrase the lists show.
 *
 * A passed use-by reads differently from a passed best-before, because they mean
 * different things: one is food that must not be given away, the other is food that
 * still can be.
 * @param lot The lot to describe.
 * @returns A phrase, or null when the lot has no expiry.
 */
export function expiryPhrase(lot: LotVM): string | null {
  if (lot.hoursRemaining === null) {
    return null;
  }

  if (lot.isPastUseBy) {
    return 'Past use-by — cannot be donated';
  }

  if (lot.hoursRemaining < 0) {
    return lot.expiryKind === ExpiryKind.BestBefore
      ? 'Past best-before'
      : 'Expired';
  }

  if (lot.hoursRemaining < 24) {
    return `${Math.max(0, Math.round(lot.hoursRemaining))}h left`;
  }

  const days = lot.daysRemaining ?? Math.floor(lot.hoursRemaining / 24);

  return days === 1 ? '1 day left' : `${days} days left`;
}

// --- 3. API CALLS ---

/**
 * Query key for a page of lots. The filters are part of the key, so changing a
 * filter is a different cache entry rather than a manual refetch.
 * @param filters The filters in force.
 * @returns The query key.
 */
export const lotsQueryKey = (filters: LotFilters) =>
  ['inventory', 'search', filters] as const;

/**
 * Query key for the facet counts, which deliberately ignore most filters.
 * @param locationId The branch being counted.
 * @param status The lifecycle state being counted.
 * @returns The query key.
 */
export const facetsQueryKey = (
  locationId: string,
  status?: InventoryItemStatus,
) => ['inventory', 'facets', locationId, status ?? null] as const;

/**
 * Searches, filters and pages a branch's stock.
 * @param filters The filters and ordering.
 * @param cursor The page to fetch, from a previous page's `nextCursor`.
 * @returns A Promise that resolves with one page of lots.
 */
export const getLots = async (
  filters: LotFilters,
  cursor?: string,
): Promise<LotPageVM> => {
  try {
    const response =
      await apiClient.inventoryItems.inventoryItemsControllerSearch({
        locationId: filters.locationId,
        q: filters.q,
        category: filters.category,
        reason: filters.reason,
        urgency: filters.urgency,
        status: filters.status,
        isListed: filters.isListed,
        expiringWithinHours: filters.expiringWithinHours,
        expiringWithinDays: filters.expiringWithinDays,
        sort: filters.sort,
        limit: filters.limit,
        cursor,
      });

    // The paginated envelope is typed loosely by the generator, because the
    // schema uses allOf to graft the item type onto a generic wrapper.
    const body = response.data as unknown as {
      data: InventoryItemResponseDto[];
      meta: { total: number; nextCursor: string | null };
    };

    return {
      lots: body.data.map(toLotVM),
      total: body.meta.total,
      nextCursor: body.meta.nextCursor,
    };
  } catch (error) {
    throwError(error, 'Could not load your inventory.');
  }
};

/**
 * Reads the counts behind the filter chips.
 *
 * A separate call from the list on purpose: the chips report how much each category
 * holds regardless of the filter in force, so deriving them from the filtered result
 * would zero every chip but the active one.
 * @param locationId The branch to count within.
 * @param status The lifecycle state to count.
 * @returns A Promise that resolves with the facet counts.
 */
export const getFacets = async (
  locationId: string,
  status?: InventoryItemStatus,
): Promise<InventoryFacetsResponseDto> => {
  try {
    const response =
      await apiClient.inventoryItems.inventoryItemsControllerFacets({
        locationId,
        status,
      });

    return response.data;
  } catch (error) {
    throwError(error, 'Could not load the inventory summary.');
  }
};

/**
 * Logs a new stock lot at a branch.
 *
 * `expiryKind` is required whenever a date is given, and the API refuses the lot
 * without it — getting a use-by wrong is the one mistake here that reaches someone's
 * dinner, so it is asked rather than assumed.
 * @param input What the lot is, and where.
 * @returns A Promise that resolves with the created lot.
 */
export const createLot = async (input: {
  locationId: string;
  productId: string;
  quantity: number;
  unit: UnitOfMeasure;
  weightKg: number;
  reason: DonationReason;
  expiresAt?: string;
  expiryKind?: ExpiryKind;
  retailValue?: number;
  unitLabel?: string;
  reasonDescription?: string;
  isListed?: boolean;
}): Promise<LotVM> => {
  try {
    const response =
      await apiClient.inventoryItems.inventoryItemsControllerCreate({
        createInventoryItemDto: input,
      });

    return toLotVM(response.data);
  } catch (error) {
    throwError(error, 'Could not log that lot.');
  }
};

/**
 * Publishes a lot to the surplus shelf, or withdraws it.
 * @param id The lot to change.
 * @param isListed Whether it should be claimable by recipients in range.
 * @returns A Promise that resolves with the updated lot.
 */
export const setLotListed = async (
  id: string,
  isListed: boolean,
): Promise<LotVM> => {
  try {
    const response =
      await apiClient.inventoryItems.inventoryItemsControllerUpdate({
        id,
        updateInventoryItemDto: { isListed },
      });

    return toLotVM(response.data);
  } catch (error) {
    throwError(error, 'Could not update the lot.');
  }
};
