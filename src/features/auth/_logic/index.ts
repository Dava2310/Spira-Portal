import type {
  MeResponseDto,
  RecipientResponseDto,
  RegisterRecipientDto,
  RegisterRetailerDto,
  RetailerResponseDto,
} from '@/api-client';
import { UserRole } from '@/api-client';
import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';
import { clearToken, setToken } from '@/lib/token-storage';

// --- 1. TYPES (VM) ---

/**
 * Which side of the platform the signed-in account belongs to.
 *
 * Derived from the role rather than stored, because the API's `UserRole` is about
 * authorization while this is about which UI tree to render. An ADMIN can see both,
 * which is why it is not simply a rename of the enum.
 */
export type PortalSide = 'retailer' | 'ngo' | 'admin';

/** The signed-in account and the organization it acts for. */
export interface SessionVM {
  userId: string;
  email: string;
  role: UserRole;
  side: PortalSide;

  /** Set when the account acts for a retailer. */
  retailer: RetailerResponseDto | null;

  /** Set when the account acts for a recipient. */
  recipient: RecipientResponseDto | null;

  /** The organization's own name, whichever side it is on. */
  organizationName: string | null;

  /** True once an admin has verified the organization. A badge, not a gate. */
  isVerified: boolean;

  /** The branch the retailer app treats as the current store. */
  primaryLocationId: string | null;

  /** Named contact for the organization, shown on handover screens. */
  primaryContactName: string | null;

  impact: MeResponseDto['impact'];
}

// --- 2. MAPPERS ---

/**
 * Works out which UI tree an account belongs in.
 * @param role The role the API reports.
 * @returns The portal side to render.
 */
export function sideForRole(role: UserRole): PortalSide {
  if (role === UserRole.Retailer) {
    return 'retailer';
  }

  if (role === UserRole.Recipient) {
    return 'ngo';
  }

  return 'admin';
}

/**
 * Maps `GET /api/me` onto the session the UI reads.
 *
 * Deliberately thin. The API already returns what the screens want — `initials`,
 * `alertRadiusKm`, the impact totals — so the nested DTOs are passed through
 * untouched rather than restated field by field. Restating them is how a third
 * vocabulary gets invented, which is the problem the merge exists to solve.
 * @param dto The context from `GET /api/me`.
 * @returns The session view model.
 */
export const toSessionVM = (dto: MeResponseDto): SessionVM => {
  const retailer = dto.retailer ?? null;
  const recipient = dto.recipient ?? null;

  return {
    userId: dto.id,
    email: dto.email,
    role: dto.role,
    side: sideForRole(dto.role),
    retailer,
    recipient,
    organizationName:
      retailer?.tradeName ??
      retailer?.legalName ??
      recipient?.displayName ??
      null,
    isVerified: (retailer ?? recipient)?.isVerified ?? false,
    primaryLocationId: dto.primaryLocation?.id ?? null,
    primaryContactName: dto.primaryContactName ?? null,
    impact: dto.impact,
  };
};

// --- 3. API CALLS ---

/** React Query key for the session — invalidate this after anything that changes it. */
export const sessionQueryKey = ['session'] as const;

/**
 * Reads the signed-in account's context.
 * @returns A Promise that resolves with the session.
 */
export const getSession = async (): Promise<SessionVM> => {
  try {
    const response = await apiClient.me.meControllerFindContext();

    return toSessionVM(response.data);
  } catch (error) {
    throwError(error, 'Could not load your account.');
  }
};

/**
 * Signs in and stores the token.
 * @param email The sign-in address.
 * @param password The password.
 * @returns A Promise that resolves with the portal side to land on.
 */
export const login = async (
  email: string,
  password: string,
): Promise<PortalSide> => {
  try {
    const response = await apiClient.auth.authControllerLogin({
      loginDto: { email, password },
    });

    setToken(response.data.accessToken, response.data.expiresAt);

    return sideForRole(response.data.user.role);
  } catch (error) {
    throwError(error, 'Could not sign you in.');
  }
};

/**
 * Registers a retailer and signs it in.
 * @param dto The company, the first account, and who is registering.
 * @returns A Promise that resolves with the portal side to land on.
 */
export const registerRetailer = async (
  dto: RegisterRetailerDto,
): Promise<PortalSide> => {
  try {
    const response = await apiClient.auth.authControllerRegisterRetailer({
      registerRetailerDto: dto,
    });

    setToken(response.data.accessToken, response.data.expiresAt);

    return sideForRole(response.data.user.role);
  } catch (error) {
    throwError(error, 'Could not complete registration.');
  }
};

/**
 * Registers an NGO or foodbank and signs it in.
 * @param dto The organization, the first account, and who is registering.
 * @returns A Promise that resolves with the portal side to land on.
 */
export const registerRecipient = async (
  dto: RegisterRecipientDto,
): Promise<PortalSide> => {
  try {
    const response = await apiClient.auth.authControllerRegisterRecipient({
      registerRecipientDto: dto,
    });

    setToken(response.data.accessToken, response.data.expiresAt);

    return sideForRole(response.data.user.role);
  } catch (error) {
    throwError(error, 'Could not complete registration.');
  }
};

/**
 * Ends the session.
 *
 * The token is cleared locally even if the call fails: the user asked to sign out,
 * and a network error is no reason to leave them signed in. The server-side
 * denylist entry is the part that can be missed, and a token left unrevoked simply
 * expires on its own.
 */
export const logout = async (): Promise<void> => {
  try {
    await apiClient.auth.authControllerLogout();
  } catch {
    // Intentionally swallowed — see above.
  } finally {
    clearToken();
  }
};
