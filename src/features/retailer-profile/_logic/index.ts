import type { ImpactReportResponseDto, PartnerResponseDto } from '@/api-client';
import { PartnershipStatus, RecipientType } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** A recipient this branch has a partnership with. */
export interface PartnerVM {
  partnershipId: string;
  recipientId: string;
  name: string;
  type: RecipientType;
  logoUrl: string | null;
  isVerified: boolean;
  status: PartnershipStatus;
  isPreferred: boolean;
  contactPerson: string | null;
  phone: string | null;
  vehiclePlate: string | null;
  deliveredCount: number;
}

// --- 2. MAPPERS ---

/** How each partnership state is worded for the shop. */
export const PARTNERSHIP_STATUS_LABELS: Record<PartnershipStatus, string> = {
  [PartnershipStatus.Pending]: 'Awaiting reply',
  [PartnershipStatus.Active]: 'Active',
  [PartnershipStatus.Paused]: 'Paused',
  [PartnershipStatus.Ended]: 'Ended',
};

/** How each kind of recipient is worded. */
export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  [RecipientType.Ngo]: 'NGO',
  [RecipientType.FoodBank]: 'Food bank',
  [RecipientType.SoupKitchen]: 'Soup kitchen',
  [RecipientType.Shelter]: 'Shelter',
  [RecipientType.CommunityFridge]: 'Community fridge',
  [RecipientType.Church]: 'Church',
  [RecipientType.School]: 'School',
};

/**
 * Maps a partner onto the view model.
 * @param dto The partner from the API.
 * @returns The partner view model.
 */
export const toPartnerVM = (dto: PartnerResponseDto): PartnerVM => ({
  partnershipId: dto.partnershipId,
  recipientId: dto.recipientId,
  name: dto.shortName ?? dto.displayName,
  type: dto.type,
  logoUrl: dto.logoUrl ?? null,
  isVerified: dto.isVerified,
  status: dto.partnershipStatus,
  isPreferred: dto.isPreferred,
  contactPerson: dto.contactPerson ?? null,
  phone: dto.phone ?? null,
  vehiclePlate: dto.vehiclePlate ?? null,
  deliveredCount: dto.deliveredCount,
});

// --- 3. API CALLS ---

export const retailerImpactQueryKey = (locationId: string, period?: string) =>
  ['retailer', 'impact', locationId, period ?? 'all'] as const;

export const partnersQueryKey = (locationId: string) =>
  ['retailer', 'partners', locationId] as const;

/**
 * Reads a branch's impact for a period.
 * @param locationId The branch to report on.
 * @param period `YYYY` or `YYYY-MM`, defaulting to the whole record.
 * @returns A Promise that resolves with the report.
 */
export const getRetailerImpact = async (
  locationId: string,
  period?: string,
): Promise<ImpactReportResponseDto> => {
  try {
    const response =
      await apiClient.retailerPortal.retailerPortalControllerFindImpact({
        locationId,
        period,
      });

    return response.data;
  } catch (error) {
    throwError(error, 'Could not load your impact report.');
  }
};

/**
 * Lists the recipients this branch has collected with.
 * @param locationId The branch.
 * @returns A Promise that resolves with the partners.
 */
export const getPartners = async (locationId: string): Promise<PartnerVM[]> => {
  try {
    const response =
      await apiClient.retailerPortal.retailerPortalControllerFindPartners({
        locationId,
      });

    return response.data.map(toPartnerVM);
  } catch (error) {
    throwError(error, 'Could not load your partners.');
  }
};
