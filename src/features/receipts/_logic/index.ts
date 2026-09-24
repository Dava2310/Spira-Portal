import type { DonationReceiptResponseDto } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

// --- 1. TYPES (VM) ---

/**
 * A handover certificate, as both sides' history screens read it.
 *
 * This is the legal record of a donation, not a summary of it: the names, tax IDs
 * and signatory are captured at handover and never recomputed, so a shop renaming
 * itself later does not rewrite what was signed.
 */
export interface ReceiptVM {
  id: string;
  receiptNumber: string;
  issuedAt: Date;

  retailerName: string;
  retailerTaxId: string | null;
  storeLabel: string;
  storeAddress: string;
  authorizedByName: string;

  recipientName: string;
  recipientTaxId: string | null;
  driverName: string | null;
  vehiclePlate: string | null;
  receivedByLabel: string | null;

  lineCount: number;
  totalWeightKg: number;
  totalRetailValue: number | null;
  currency: string;
  estimatedMeals: number | null;

  legalReference: string | null;
  verificationCode: string | null;
}

/** One page of certificates. */
export interface ReceiptPageVM {
  receipts: ReceiptVM[];
  total: number;
  nextCursor: string | null;
}

// --- 2. MAPPERS ---

/**
 * Maps a certificate onto the view model.
 * @param dto The certificate from the API.
 * @returns The certificate view model.
 */
export const toReceiptVM = (dto: DonationReceiptResponseDto): ReceiptVM => ({
  id: dto.id,
  receiptNumber: dto.receiptNumber,
  issuedAt: new Date(dto.issuedAt),
  retailerName: dto.retailerLegalName,
  retailerTaxId: dto.retailerTaxId ?? null,
  storeLabel: dto.locationLabel,
  storeAddress: dto.locationAddress,
  authorizedByName: dto.authorizedByName,
  recipientName: dto.recipientLegalName,
  recipientTaxId: dto.recipientTaxId ?? null,
  driverName: dto.driverName ?? null,
  vehiclePlate: dto.vehiclePlate ?? null,
  receivedByLabel: dto.receivedByLabel ?? null,
  lineCount: dto.lineCount,
  totalWeightKg: dto.totalWeightKg,
  totalRetailValue: dto.totalRetailValue ?? null,
  currency: dto.currency,
  estimatedMeals: dto.estimatedMeals ?? null,
  legalReference: dto.legalReference ?? null,
  verificationCode: dto.verificationCode ?? null,
});

// --- 3. API CALLS ---

export const pickupsQueryKey = ['receipts', 'pickups'] as const;

/**
 * Reads the caller's collection history as its certificates.
 *
 * The recipient portal's own route, so it is scoped to the caller without being
 * asked — unlike `GET /api/donation-receipts`, which is not scoped at all.
 * @param cursor The page to fetch, from a previous page's `nextCursor`.
 * @returns A Promise that resolves with one page of certificates.
 */
export const getPickups = async (cursor?: string): Promise<ReceiptPageVM> => {
  try {
    const response =
      await apiClient.recipientPortal.recipientPortalControllerFindPickups({
        limit: 20,
        cursor,
      });

    const body = response.data as unknown as {
      data: DonationReceiptResponseDto[];
      meta: { total: number; nextCursor: string | null };
    };

    return {
      receipts: body.data.map(toReceiptVM),
      total: body.meta.total,
      nextCursor: body.meta.nextCursor,
    };
  } catch (error) {
    throwError(error, 'Could not load your collection history.');
  }
};

/**
 * Finds the certificate issued for one donation.
 *
 * Matched from the caller's own certificate list, because there is no by-donation
 * route and the list is already scoped to them. Fine while a branch has tens of
 * handovers; a route would be better once it has thousands.
 * @param donationId The handover to find the certificate for.
 * @returns A Promise that resolves with the certificate, or null when none exists.
 */
export const findReceiptForDonation = async (
  donationId: string,
): Promise<ReceiptVM | null> => {
  try {
    const response =
      await apiClient.donationReceipts.donationReceiptsControllerFindAll();

    const match = response.data.find(
      (receipt) => receipt.donationId === donationId,
    );

    return match ? toReceiptVM(match) : null;
  } catch (error) {
    throwError(error, 'Could not find that certificate.');
  }
};

/**
 * Opens a certificate's PDF.
 *
 * Fetched through the client rather than linked to, because the route needs the
 * bearer token and an `<a href>` would send none. The blob is turned into an object
 * URL and opened, then revoked once the tab has had it.
 * @param id The certificate to open.
 * @param receiptNumber Used to name the downloaded file.
 * @returns A Promise that resolves once the PDF has been handed to the browser.
 */
export const openReceiptPdf = async (
  id: string,
  receiptNumber: string,
): Promise<void> => {
  try {
    const response =
      await apiClient.donationReceipts.donationReceiptsControllerDownloadPdf(
        { id },
        { responseType: 'blob' },
      );

    const url = URL.createObjectURL(response.data as unknown as Blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${receiptNumber}.pdf`;
    link.rel = 'noopener';
    link.click();

    // Give the browser a moment to take the blob before it is revoked.
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) {
    throwError(error, 'Could not open that certificate.');
  }
};
