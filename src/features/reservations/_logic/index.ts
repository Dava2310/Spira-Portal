import type {
  DonationLineResponseDto,
  ReservationCountsDto,
  ReservationResponseDto,
} from '@/api-client';
import {
  CancellationReasonCode,
  DonationStatus,
  ReservationWindow,
} from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** A claim on a store's surplus, as the NGO screens read it. */
export interface ReservationVM {
  id: string;
  code: string;
  status: DonationStatus;
  window: ReservationWindow;

  storeLabel: string;
  storeAddress: string;
  neighborhood: string | null;
  accessInstructions: string | null;
  retailerName: string;
  logoUrl: string | null;
  storeContactName: string | null;
  storePhone: string | null;

  /** Already formatted by the API, in the store's own timezone. */
  pickupWindowLabel: string | null;

  lineCount: number;
  totalWeightKg: number;
  totalRetailValue: number;
  currency: string;
  estimatedMeals: number | null;

  lines: ReservationLineVM[];

  /** The pass to present at the counter, once one has been issued. */
  pass: PickupPassVM | null;

  createdAt: Date;
}

/** One lot inside a claim. */
export interface ReservationLineVM {
  id: string;
  productName: string;
  brand: string | null;
  quantity: number;
  unit: string;
  unitLabel: string | null;
  weightKg: number;
  imageUrl: string | null;
  hoursRemaining: number | null;
}

/** The handover pass: what the shop checks before releasing the crates. */
export interface PickupPassVM {
  code: string;
  pin: string;
  expiresAt: Date;
  isUsable: boolean;
  consumedAt: Date | null;
}

/** How many claims are live, for the badge on the nav. */
export interface ReservationCountsVM {
  active: number;
  today: number;
  upcoming: number;
}

// --- 2. MAPPERS ---

/** Why a claim is being released, worded as the driver would say it. */
export const RELEASE_REASONS: {
  code: CancellationReasonCode;
  label: string;
}[] = [
  {
    code: CancellationReasonCode.CannotMakeWindow,
    label: 'Cannot make the collection window',
  },
  {
    code: CancellationReasonCode.VehicleCapacityReached,
    label: 'Vehicle is full',
  },
  {
    code: CancellationReasonCode.VehicleBreakdown,
    label: 'Vehicle broke down',
  },
  {
    code: CancellationReasonCode.StorageCapacityReached,
    label: 'No storage space left',
  },
  {
    code: CancellationReasonCode.StoreLogisticsDelay,
    label: 'Store is not ready',
  },
  { code: CancellationReasonCode.NoLongerNeeded, label: 'No longer needed' },
  { code: CancellationReasonCode.Other, label: 'Another reason' },
];

/**
 * Maps a claim line onto the view model.
 * @param dto The line from the API.
 * @returns The line view model.
 */
export const toReservationLineVM = (
  dto: DonationLineResponseDto,
): ReservationLineVM => ({
  id: dto.id,
  productName: dto.productName,
  brand: dto.brand ?? null,
  quantity: dto.quantity,
  unit: dto.unit,
  unitLabel: dto.unitLabel ?? null,
  weightKg: dto.weightKg,
  imageUrl: dto.imageUrl ?? null,
  hoursRemaining: dto.hoursRemaining ?? null,
});

/**
 * Maps a reservation onto the view model.
 *
 * `pickupWindowLabel` and `window` are taken as given: the API renders the window
 * in the store's timezone, and a van driving to Barcelona wants the shop's opening
 * time, not their own device's.
 * @param dto The reservation from the API.
 * @returns The reservation view model.
 */
export const toReservationVM = (
  dto: ReservationResponseDto,
): ReservationVM => ({
  id: dto.id,
  code: dto.code,
  status: dto.status,
  window: dto.window,
  storeLabel: dto.locationLabel,
  storeAddress: dto.locationAddress,
  neighborhood: dto.neighborhood ?? null,
  accessInstructions: dto.accessInstructions ?? null,
  retailerName: dto.retailerName,
  logoUrl: dto.logoUrl ?? null,
  storeContactName: dto.storeContactName ?? null,
  storePhone: dto.storePhone ?? null,
  pickupWindowLabel: dto.pickupWindowLabel ?? null,
  lineCount: dto.lineCount,
  totalWeightKg: dto.totalWeightKg,
  totalRetailValue: dto.totalRetailValue,
  currency: dto.currency,
  estimatedMeals: dto.estimatedMeals ?? null,
  lines: dto.lines?.map(toReservationLineVM) ?? [],
  pass: dto.pickupToken
    ? {
        code: dto.pickupToken.code,
        pin: dto.pickupToken.pin,
        expiresAt: new Date(dto.pickupToken.expiresAt),
        isUsable: dto.pickupToken.isUsable,
        consumedAt: dto.pickupToken.consumedAt
          ? new Date(dto.pickupToken.consumedAt)
          : null,
      }
    : null,
  createdAt: new Date(dto.createdAt),
});

// --- 3. API CALLS ---

export const reservationsQueryKey = (window?: ReservationWindow) =>
  ['reservations', window ?? 'all'] as const;

export const reservationQueryKey = (id: string) =>
  ['reservations', 'one', id] as const;

export const reservationCountsQueryKey = ['reservations', 'counts'] as const;

/**
 * Lists the caller's claims.
 * @param window Narrow to today's or the upcoming ones.
 * @returns A Promise that resolves with the claims.
 */
export const getReservations = async (
  window?: ReservationWindow,
): Promise<ReservationVM[]> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindReservations(
        {
          window,
          limit: 50,
        },
      );

    const body = response.data as unknown as {
      data: ReservationResponseDto[];
    };

    return body.data.map(toReservationVM);
  } catch (error) {
    throwError(error, 'Could not load your claims.');
  }
};

/**
 * Reads one claim with its lots and its pass.
 * @param id The claim to read.
 * @returns A Promise that resolves with the claim.
 */
export const getReservation = async (id: string): Promise<ReservationVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindReservation({
        id,
      });

    return toReservationVM(response.data);
  } catch (error) {
    throwError(error, 'Could not load that claim.');
  }
};

/**
 * Counts the live claims, for the nav badge.
 * @returns A Promise that resolves with the counts.
 */
export const getReservationCounts = async (): Promise<ReservationCountsVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerCountReservations();
    const dto: ReservationCountsDto = response.data;

    return { active: dto.active, today: dto.today, upcoming: dto.upcoming };
  } catch (error) {
    throwError(error, 'Could not count your claims.');
  }
};

/**
 * Claims lots off a store's shelf.
 *
 * A claim must say when the van is coming: either one of the shop's published slots,
 * or a proposed start and end. The API refuses a claim with neither, since stock held
 * for nobody-knows-when is stock nobody else can take.
 * @param input The store, the lots, and the collection time.
 * @returns A Promise that resolves with the new claim.
 */
export const claimSurplus = async (
  input: {
    locationId: string;
    inventoryItemIds: string[];
  } & (
    | { pickupSlotId: string }
    | { pickupWindowStart: string; pickupWindowEnd: string }
  ),
): Promise<ReservationVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerClaim({
        createReservationDto: input,
      });

    return toReservationVM(response.data);
  } catch (error) {
    // A 409 means someone else took it first, which is the normal race on an open
    // shelf rather than a fault — the caller words it that way.
    throwError(error, 'Could not claim that surplus.');
  }
};

/**
 * Releases a claim back onto the shelf.
 *
 * Goes through the donation's own cancel route: a claim *is* a donation, so
 * releasing it is the same transition the retailer would make, and the stock
 * returns to the shelf for someone else.
 * @param id The claim to release.
 * @param reasonCode Why, as a fixed code.
 * @param reason The free-text reason the certificate trail keeps.
 * @returns A Promise that resolves when it is released.
 */
export const releaseReservation = async (
  id: string,
  reasonCode: CancellationReasonCode,
  reason: string,
): Promise<void> => {
  try {
    await apiClient.donations.donationsControllerCancel({
      id,
      cancelDonationDto: {
        cancellationReason: reason,
        cancellationReasonCode: reasonCode,
      },
    });
  } catch (error) {
    throwError(error, 'Could not release that claim.');
  }
};
