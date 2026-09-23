import type { PortalSide } from '@/features/auth/_logic';

/**
 * Where an account lands when it has no explicit destination.
 *
 * Its own module so the guard components export only components, which is what
 * React Fast Refresh needs to work.
 * @param side The portal side the account belongs to.
 * @returns The route to land on.
 */
export function homePathFor(side: PortalSide): string {
  return side === 'ngo' ? '/ngo' : '/retailer';
}
