import type { LocationPickupSlotResponseDto } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** A collection window a branch has published. */
export interface PickupSlotVM {
  id: string;
  label: string;

  /** 0-6, or null when the slot applies every day. */
  weekday: number | null;

  startTime: string;
  endTime: string;

  /** Already formatted by the API, for example `18:00 - 20:00`. */
  windowLabel: string;
}

// --- 2. MAPPERS ---

const WEEKDAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

/**
 * Maps a pickup slot onto the view model.
 * @param dto The slot from the API.
 * @returns The slot view model.
 */
export const toPickupSlotVM = (
  dto: LocationPickupSlotResponseDto,
): PickupSlotVM => ({
  id: dto.id,
  label: dto.label,
  weekday: dto.weekday ?? null,
  startTime: dto.startTime,
  endTime: dto.endTime,
  windowLabel: dto.windowLabel,
});

/**
 * Names the days a slot applies to.
 * @param slot The slot to describe.
 * @returns For example `Fridays` or `Every day`.
 */
export const slotDaysLabel = (slot: PickupSlotVM): string =>
  slot.weekday === null ? 'Every day' : (WEEKDAYS[slot.weekday] ?? 'Every day');

// --- 3. API CALLS ---

export const pickupSlotsQueryKey = (locationId: string) =>
  ['pickup-slots', locationId] as const;

/**
 * Lists the collection windows a branch has published.
 *
 * A branch may have none — nothing in setup forces them — in which case whoever is
 * collecting has to propose a time instead.
 * @param locationId The branch to read.
 * @returns A Promise that resolves with its active slots.
 */
export const getPickupSlots = async (
  locationId: string,
): Promise<PickupSlotVM[]> => {
  try {
    const response =
      await apiClient.locationPickupSlots.locationPickupSlotsControllerFindAllByLocation(
        { locationId },
      );

    return response.data.filter((slot) => slot.isActive).map(toPickupSlotVM);
  } catch (error) {
    throwError(error, 'Could not load the collection windows.');
  }
};
