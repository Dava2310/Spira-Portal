import type {
  ContactResponseDto,
  ImpactReportResponseDto,
  RecipientResponseDto,
  VerificationPassResponseDto,
} from '@/api-client';
import {
  ContactType,
  LocationType,
  RecipientType,
  UrgencyThreshold,
} from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/** The organisation's own record, as its profile screen reads it. */
export interface NgoProfileVM {
  id: string;
  displayName: string;
  legalName: string | null;
  shortName: string | null;
  type: RecipientType;
  taxId: string | null;
  registrationCode: string | null;
  mission: string | null;
  serviceArea: string | null;
  website: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  timezone: string;

  /** How far out surplus alerts reach, in kilometres. */
  alertRadiusKm: number;

  urgencyThreshold: UrgencyThreshold;
  pushNotificationsEnabled: boolean;
}

/** One authorised member of staff, who may sign for a collection. */
export interface NgoContactVM {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  type: ContactType;
  isPrimary: boolean;
}

/** A base the organisation collects from, used as the origin for distances. */
export interface NgoBaseVM {
  id: string;
  label: string;
  address: string;
  city: string;
  hasCoordinates: boolean;
  isPrimary: boolean;
}

// --- 2. MAPPERS ---

/** How each alert threshold is worded. */
export const URGENCY_THRESHOLD_LABELS: Record<UrgencyThreshold, string> = {
  [UrgencyThreshold.All]: 'Everything available',
  [UrgencyThreshold.CriticalExpiring]: 'Expiring within a day',
  [UrgencyThreshold.CriticalOnly]: 'Only critical',
};

/** How each kind of contact is worded. */
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  [ContactType.Primary]: 'Main contact',
  [ContactType.Operations]: 'Operations',
  [ContactType.Logistics]: 'Logistics',
  [ContactType.Billing]: 'Billing',
  [ContactType.Driver]: 'Driver',
  [ContactType.Emergency]: 'Emergency',
};

/**
 * Maps the organisation's record onto the view model.
 * @param dto The recipient from the API.
 * @returns The profile view model.
 */
export const toNgoProfileVM = (dto: RecipientResponseDto): NgoProfileVM => ({
  id: dto.id,
  displayName: dto.displayName,
  legalName: dto.legalName ?? null,
  shortName: dto.shortName ?? null,
  type: dto.type,
  taxId: dto.taxId ?? null,
  registrationCode: dto.registrationCode ?? null,
  mission: dto.mission ?? null,
  serviceArea: dto.serviceArea ?? null,
  website: dto.website ?? null,
  logoUrl: dto.logoUrl ?? null,
  isVerified: dto.isVerified,
  timezone: dto.timezone,
  alertRadiusKm: dto.alertRadiusKm,
  urgencyThreshold: dto.urgencyThreshold,
  pushNotificationsEnabled: dto.pushNotificationsEnabled,
});

/**
 * Maps a contact onto the view model.
 * @param dto The contact from the API.
 * @returns The contact view model.
 */
export const toNgoContactVM = (dto: ContactResponseDto): NgoContactVM => ({
  id: dto.id,
  fullName: dto.fullName,
  jobTitle: dto.jobTitle ?? null,
  email: dto.email ?? null,
  phone: dto.phone ?? null,
  type: dto.type,
  isPrimary: dto.isPrimary,
});

// --- 3. API CALLS ---

export const ngoProfileQueryKey = ['ngo', 'profile'] as const;
export const ngoContactsQueryKey = ['ngo', 'contacts'] as const;
export const ngoBasesQueryKey = ['ngo', 'bases'] as const;
export const verificationPassQueryKey = ['ngo', 'verification-pass'] as const;
export const ngoImpactQueryKey = (period?: string) =>
  ['ngo', 'impact', period ?? 'all'] as const;

/**
 * Reads the caller's own organisation record.
 * @returns A Promise that resolves with the profile.
 */
export const getNgoProfile = async (): Promise<NgoProfileVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindProfile();

    return toNgoProfileVM(response.data);
  } catch (error) {
    throwError(error, 'Could not load your organisation.');
  }
};

/**
 * Updates the organisation's own details.
 * @param changes The fields to change.
 * @returns A Promise that resolves with the updated profile.
 */
export const updateNgoProfile = async (changes: {
  displayName?: string;
  legalName?: string;
  shortName?: string;
  mission?: string;
  serviceArea?: string;
  website?: string;
  taxId?: string;
  registrationCode?: string;
}): Promise<NgoProfileVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerUpdateProfile({
        updateRecipientDto: changes,
      });

    return toNgoProfileVM(response.data);
  } catch (error) {
    throwError(error, 'Could not save your organisation.');
  }
};

/**
 * Updates how far and how urgently surplus alerts reach.
 * @param changes The preferences to change.
 * @returns A Promise that resolves with the updated profile.
 */
export const updateAlertPreferences = async (changes: {
  alertRadiusKm?: number;
  urgencyThreshold?: UrgencyThreshold;
  pushNotificationsEnabled?: boolean;
}): Promise<NgoProfileVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerUpdateNotificationPreferences(
        { updateNotificationPreferencesDto: changes },
      );

    return toNgoProfileVM(response.data);
  } catch (error) {
    throwError(error, 'Could not save your alert settings.');
  }
};

/**
 * Lists the organisation's authorised staff.
 * @returns A Promise that resolves with the contacts.
 */
export const getNgoContacts = async (): Promise<NgoContactVM[]> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindContacts();

    return response.data.map(toNgoContactVM);
  } catch (error) {
    throwError(error, 'Could not load your staff.');
  }
};

/**
 * Adds an authorised member of staff.
 * @param input Who they are and what they do.
 * @returns A Promise that resolves with the new contact.
 */
export const addNgoContact = async (input: {
  fullName: string;
  type: ContactType;
  phone?: string;
  email?: string;
  jobTitle?: string;
}): Promise<NgoContactVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerAddContact({
        createContactDto: input,
      });

    return toNgoContactVM(response.data);
  } catch (error) {
    throwError(error, 'Could not add that person.');
  }
};

/**
 * Reads the organisation's permanent verification QR.
 * @returns A Promise that resolves with the pass.
 */
export const getVerificationPass =
  async (): Promise<VerificationPassResponseDto> => {
    try {
      const response =
        await apiClient.recipientPortal.recipientPortalControllerFindVerificationPass();

      return response.data;
    } catch (error) {
      throwError(error, 'Could not load your verification pass.');
    }
  };

/**
 * Reads the organisation's impact for a period.
 * @param period `YYYY` or `YYYY-MM`.
 * @returns A Promise that resolves with the report.
 */
export const getNgoImpact = async (
  period?: string,
): Promise<ImpactReportResponseDto> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindImpact({
        period,
      });

    return response.data;
  } catch (error) {
    throwError(error, 'Could not load your impact report.');
  }
};

/**
 * Lists the bases this organisation collects from.
 *
 * This is where the shelf's distances are measured from — the *location*, not the
 * profile. Without one, nothing can be sorted by distance unless the browser shares
 * a position.
 * @param recipientId The organisation whose bases to keep.
 * @returns A Promise that resolves with its bases.
 */
export const getNgoBases = async (
  recipientId: string,
): Promise<NgoBaseVM[]> => {
  try {
    const response = await apiClient.locations.locationsControllerFindAll();

    return response.data
      .filter((location) => location.recipientId === recipientId)
      .map((location) => ({
        id: location.id,
        label: location.label,
        address: [location.addressLine1, location.city]
          .filter(Boolean)
          .join(', '),
        city: location.city,
        hasCoordinates: location.latitude != null && location.longitude != null,
        isPrimary: location.isPrimary,
      }));
  } catch (error) {
    throwError(error, 'Could not load your bases.');
  }
};

/**
 * Saves a base for this organisation.
 * @param input Where it is, and its coordinates when the browser could supply them.
 * @returns A Promise that resolves with the new base.
 */
export const createNgoBase = async (input: {
  recipientId: string;
  label: string;
  addressLine1: string;
  city: string;
  postalCode?: string;
  countryCode: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
}): Promise<NgoBaseVM> => {
  try {
    const response = await apiClient.locations.locationsControllerCreate({
      createLocationDto: {
        ...input,
        type: LocationType.Warehouse,
        isActive: true,
        isPrimary: true,
      },
    });

    const location = response.data;

    return {
      id: location.id,
      label: location.label,
      address: [location.addressLine1, location.city]
        .filter(Boolean)
        .join(', '),
      city: location.city,
      hasCoordinates: location.latitude != null && location.longitude != null,
      isPrimary: location.isPrimary,
    };
  } catch (error) {
    throwError(error, 'Could not save that base.');
  }
};
