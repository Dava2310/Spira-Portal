import type {
  DonationLineResponseDto,
  DonationResponseDto,
} from '@/api-client';
import {
  DonationReason,
  DonationSort,
  DonationStatus,
  ProductCategory,
  SurplusUrgency,
} from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** A donation, as the retailer's queue and history read it. */
export interface DonationVM {
  id: string;
  code: string;
  status: DonationStatus;

  /** Who is collecting. Null only when the relation was not loaded. */
  recipientName: string | null;
  recipientIsVerified: boolean;

  driverName: string | null;
  driverPhone: string | null;
  vehiclePlate: string | null;

  /** Already formatted by the API, in the branch's own timezone. */
  pickupWindowLabel: string | null;

  lineCount: number;
  totalWeightKg: number;
  totalRetailValue: number;
  currency: string;
  estimatedMeals: number | null;

  completedAt: Date | null;
  createdAt: Date;

  /** The staged lots, present only when the call loads them. */
  lines: DonationLineVM[];
}

/** One staged lot inside a donation. */
export interface DonationLineVM {
  id: string;
  productName: string;
  brand: string | null;
  category: ProductCategory;
  quantity: number;
  unit: string;
  unitLabel: string | null;
  weightKg: number;
  imageUrl: string | null;
  urgency: SurplusUrgency | null;
  hoursRemaining: number | null;
  daysRemaining: number | null;
  reason: DonationReason;
  reasonDescription: string | null;
}

/** What the queue and history screens filter by. */
export interface DonationFilters {
  locationId: string;

  /** Any of these states. The queue is several at once; the history is one. */
  status?: DonationStatus[];

  sort?: DonationSort;
  limit?: number;
}

/**
 * The states in which a batch is assembled but not yet handed over.
 *
 * These are the ones `GET /api/donations/current` covers — it returns the single
 * basket a branch stages into.
 */
export const STAGING_STATUSES: DonationStatus[] = [
  DonationStatus.Draft,
  DonationStatus.Offered,
  DonationStatus.Accepted,
];

/** The states in which a batch is sealed and a driver is expected. */
export const AWAITING_PICKUP_STATUSES: DonationStatus[] = [
  DonationStatus.ReadyForPickup,
  DonationStatus.DriverEnRoute,
];

/** One page of donations. */
export interface DonationPageVM {
  donations: DonationVM[];
  total: number;
  nextCursor: string | null;
}

// --- 2. MAPPERS ---

/** How each status is worded for the retailer. */
export const STATUS_LABELS: Record<DonationStatus, string> = {
  [DonationStatus.Draft]: 'Staging',
  [DonationStatus.Offered]: 'Awaiting reply',
  [DonationStatus.Accepted]: 'Accepted',
  [DonationStatus.ReadyForPickup]: 'Ready for pickup',
  [DonationStatus.DriverEnRoute]: 'Driver on the way',
  [DonationStatus.Delivered]: 'Delivered',
  [DonationStatus.Declined]: 'Declined',
  [DonationStatus.Cancelled]: 'Cancelled',
};

/**
 * Maps a staged lot onto the view model.
 *
 * The API already flattens the product onto the line, so there is nothing to join.
 * @param dto The line from the API.
 * @returns The line view model.
 */
export const toDonationLineVM = (
  dto: DonationLineResponseDto,
): DonationLineVM => ({
  id: dto.id,
  productName: dto.productName,
  brand: dto.brand ?? null,
  category: dto.category,
  quantity: dto.quantity,
  unit: dto.unit,
  unitLabel: dto.unitLabel ?? null,
  weightKg: dto.weightKg,
  imageUrl: dto.imageUrl ?? null,
  urgency: dto.urgency ?? null,
  hoursRemaining: dto.hoursRemaining ?? null,
  daysRemaining: dto.daysRemaining ?? null,
  reason: dto.reason,
  reasonDescription: dto.reasonDescription ?? null,
});

/**
 * Maps a donation onto the view model.
 *
 * `pickupWindowLabel` is taken as given: the API formats it in the branch's own
 * timezone, and formatting it again here would put the browser's timezone on a
 * window that belongs to the shop.
 * @param dto The donation from the API.
 * @returns The donation view model.
 */
export const toDonationVM = (dto: DonationResponseDto): DonationVM => ({
  id: dto.id,
  code: dto.code,
  status: dto.status,
  recipientName: dto.recipient?.shortName ?? dto.recipient?.displayName ?? null,
  recipientIsVerified: dto.recipient?.isVerified ?? false,
  driverName: dto.driver?.fullName ?? null,
  driverPhone: dto.driver?.phone ?? null,
  vehiclePlate: dto.vehicle?.plate ?? null,
  pickupWindowLabel: dto.pickupWindowLabel ?? null,
  lineCount: dto.lineCount,
  totalWeightKg: dto.totalWeightKg,
  totalRetailValue: dto.totalRetailValue,
  currency: dto.currency,
  estimatedMeals: dto.estimatedMeals ?? null,
  completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
  createdAt: new Date(dto.createdAt),
  lines: dto.lines?.map(toDonationLineVM) ?? [],
});

/**
 * Counts lines with the right plural.
 * @param count How many lines the donation has.
 * @returns For example `1 line` or `3 lines`.
 */
export const linesLabel = (count: number): string =>
  `${count} ${count === 1 ? 'line' : 'lines'}`;

// --- 3. API CALLS ---

/**
 * Query key for a donation list.
 * @param filters The filters in force.
 * @returns The query key.
 */
export const donationsQueryKey = (filters: DonationFilters) =>
  ['donations', filters] as const;

/**
 * Lists one branch's donations.
 *
 * The paginated search is used rather than `by-location` because it is the only
 * path that sorts, and the two sub-views want different orders: the queue by when
 * collection is due, the history by when it completed.
 * @param filters The branch, status and ordering.
 * @param cursor The page to fetch, from a previous page's `nextCursor`.
 * @returns A Promise that resolves with one page of donations.
 */
export const getDonations = async (
  filters: DonationFilters,
  cursor?: string,
): Promise<DonationPageVM> => {
  try {
    const response = await apiClient.donations.donationsControllerSearch({
      locationId: filters.locationId,
      status: filters.status,
      sort: filters.sort,
      limit: filters.limit,
      cursor,
    });

    const body = response.data as unknown as {
      data: DonationResponseDto[];
      meta: { total: number; nextCursor: string | null };
    };

    return {
      donations: body.data.map(toDonationVM),
      total: body.meta.total,
      nextCursor: body.meta.nextCursor,
    };
  } catch (error) {
    throwError(error, 'Could not load your donations.');
  }
};

/** Query key for a branch's open basket. */
export const openDonationQueryKey = (locationId: string) =>
  ['donations', 'current', locationId] as const;

/**
 * Reads the branch's open basket — what is staged but not yet collected.
 *
 * A branch has at most one, which is why this is a single donation rather than a
 * list: the retailer app stages lots into one batch and hands that batch over.
 * @param locationId The branch to read.
 * @returns A Promise that resolves with the open donation, or null when nothing is
 * staged.
 */
export const getOpenDonation = async (
  locationId: string,
): Promise<DonationVM | null> => {
  try {
    const response = await apiClient.donations.donationsControllerFindOpen({
      locationId,
    });

    // The route answers 200 with an empty body when nothing is staged.
    return response.data ? toDonationVM(response.data) : null;
  } catch (error) {
    throwError(error, 'Could not load what is staged for collection.');
  }
};

/**
 * Reads one donation with its lines.
 * @param id The donation to read.
 * @returns A Promise that resolves with the donation.
 */
export const getDonation = async (id: string): Promise<DonationVM> => {
  try {
    const response = await apiClient.donations.donationsControllerFindOne({
      id,
    });

    return toDonationVM(response.data);
  } catch (error) {
    throwError(error, 'Could not load that donation.');
  }
};
