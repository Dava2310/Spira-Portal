import type { CreateLocationDto, LocationResponseDto } from '@/api-client';
import { LocationType } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** A branch, as the portal's screens read it. */
export interface BranchVM {
  id: string;
  label: string;
  code: string | null;
  address: string;
  neighborhood: string | null;
  city: string;
  isPrimary: boolean;
  isActive: boolean;

  /** Name of the site contact to ask for, when the relation was loaded. */
  managerName: string | null;

  /** Today's collection windows, already formatted by the API. */
  pickupHoursToday: string[];

  /** Whether the branch has coordinates, which the NGO map and radius search need. */
  hasCoordinates: boolean;
}

// --- 2. MAPPERS ---

/**
 * Maps a location onto the branch view model.
 *
 * The one real transform is collapsing the address lines into a single string,
 * because every screen renders them together and none needs them apart.
 * @param dto The location from the API.
 * @returns The branch view model.
 */
export const toBranchVM = (dto: LocationResponseDto): BranchVM => ({
  id: dto.id,
  label: dto.label,
  code: dto.code ?? null,
  address: [dto.addressLine1, dto.addressLine2, dto.city]
    .filter(Boolean)
    .join(', '),
  neighborhood: dto.neighborhood ?? null,
  city: dto.city,
  isPrimary: dto.isPrimary,
  isActive: dto.isActive,
  managerName: dto.managerName ?? null,
  pickupHoursToday: dto.pickupHoursToday ?? [],
  hasCoordinates: dto.latitude != null && dto.longitude != null,
});

// --- 3. API CALLS ---

export const branchesQueryKey = ['locations'] as const;

/**
 * Lists the branches visible to the caller.
 *
 * The API scopes nothing on this route yet, so the caller's own retailer must be
 * filtered for here. Worth removing once `GET /api/locations` is org-scoped.
 * @param retailerId The retailer whose branches to keep.
 * @returns A Promise that resolves with that retailer's branches.
 */
export const getBranchesForRetailer = async (
  retailerId: string,
): Promise<BranchVM[]> => {
  try {
    const response = await apiClient.locations.locationsControllerFindAll();

    return response.data
      .filter((location) => location.retailerId === retailerId)
      .map(toBranchVM);
  } catch (error) {
    throwError(error, 'Could not load your branches.');
  }
};

/**
 * Creates a branch for a retailer.
 * @param input The branch details, minus the owner and the fixed defaults.
 * @returns A Promise that resolves with the created branch.
 */
export const createRetailerBranch = async (input: {
  retailerId: string;
  label: string;
  code?: string;
  addressLine1: string;
  city: string;
  neighborhood?: string;
  postalCode?: string;
  countryCode: string;
  timezone: string;
  phone?: string;
  accessInstructions?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
}): Promise<BranchVM> => {
  try {
    const dto: CreateLocationDto = {
      ...input,
      type: LocationType.Store,
      isActive: true,
    };

    const response = await apiClient.locations.locationsControllerCreate({
      createLocationDto: dto,
    });

    return toBranchVM(response.data);
  } catch (error) {
    throwError(error, 'Could not create the branch.');
  }
};
