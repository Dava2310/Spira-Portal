import type { RetailerDashboardResponseDto } from '@/api-client';
import { SurplusUrgency } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/**
 * The retailer home screen's numbers.
 *
 * Passed through almost untouched: the API assembles this specifically for this
 * screen, so re-deriving anything here would only risk disagreeing with it.
 */
export interface DashboardVM {
  readyLineCount: number;
  readyWeightKg: number;
  readyMeals: number;
  urgentCount: number;
  highestUrgency: SurplusUrgency | null;
  deliveredCount: number;
  inventoryCount: number;
  nextPickup: NextPickupVM | null;
}

/** The next collection due at this branch. */
export interface NextPickupVM {
  donationId: string;
  code: string;
  recipientName: string;
  contactPerson: string | null;
  vehiclePlate: string | null;
  minutesUntilWindow: number | null;

  /** How long until the window opens, as the card phrases it. */
  etaLabel: string | null;
}

// --- 2. MAPPERS ---

/**
 * Turns minutes until the window into the short phrase the card shows.
 *
 * Negative means the window is already open, which is the case that matters most:
 * the driver may be outside, so it must not read as "in -20 min".
 * @param minutes Minutes until the window opens, or null when none is agreed.
 * @returns A phrase, or null without a window.
 */
export function etaLabel(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }

  if (minutes <= 0) {
    return 'Window open now';
  }

  if (minutes < 60) {
    return `in ${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  return rest === 0 ? `in ${hours}h` : `in ${hours}h ${rest}m`;
}

/**
 * Maps the dashboard onto the view model.
 * @param dto The dashboard from the API.
 * @returns The dashboard view model.
 */
export const toDashboardVM = (
  dto: RetailerDashboardResponseDto,
): DashboardVM => ({
  readyLineCount: dto.ready.lineCount,
  readyWeightKg: dto.ready.totalWeightKg,
  readyMeals: dto.ready.estimatedMeals,
  urgentCount: dto.urgentCount,
  highestUrgency: dto.highestUrgency ?? null,
  deliveredCount: dto.deliveredCount,
  inventoryCount: dto.inventoryCount,
  nextPickup: dto.nextPickup
    ? {
        donationId: dto.nextPickup.donationId,
        code: dto.nextPickup.code,
        recipientName: dto.nextPickup.recipientName,
        contactPerson: dto.nextPickup.contactPerson ?? null,
        vehiclePlate: dto.nextPickup.vehiclePlate ?? null,
        minutesUntilWindow: dto.nextPickup.minutesUntilWindow ?? null,
        etaLabel: etaLabel(dto.nextPickup.minutesUntilWindow ?? null),
      }
    : null,
});

// --- 3. API CALLS ---

/**
 * Query key for the dashboard.
 * @param locationId The branch, or undefined for the primary one.
 * @returns The query key.
 */
export const dashboardQueryKey = (locationId?: string) =>
  ['retailer', 'dashboard', locationId ?? null] as const;

/**
 * Reads the retailer home dashboard.
 * @param locationId The branch to report on. Defaults to the primary branch.
 * @returns A Promise that resolves with the dashboard.
 */
export const getDashboard = async (
  locationId?: string,
): Promise<DashboardVM> => {
  try {
    const response =
      await apiClient.retailerPortal.retailerPortalControllerFindDashboard({
        locationId,
      });

    return toDashboardVM(response.data);
  } catch (error) {
    throwError(error, 'Could not load your dashboard.');
  }
};
