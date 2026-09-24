import { apiClient } from '@/lib/api-client';
import { throwError } from '@/lib/error-utils';

/**
 * Changes the signed-in account's password.
 *
 * The API revokes the current token on success, so the caller has to sign in again —
 * which is the point: a password change that leaves the old session alive protects
 * nobody.
 * @param oldPassword The current password.
 * @param newPassword The replacement.
 * @returns A Promise that resolves once it is changed.
 */
export const changePassword = async (
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  try {
    await apiClient.auth.authControllerChangePassword({
      changePasswordDto: { oldPassword, newPassword },
    });
  } catch (error) {
    throwError(error, 'Could not change your password.');
  }
};
