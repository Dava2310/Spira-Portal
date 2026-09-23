import { Gift, Home, Package, Store, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { PortalSide } from '@/features/auth/_logic';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The tabs each side shows, in order.
 *
 * Only routes that exist are listed — a tab leading to a blank screen reads as a
 * broken app, so this grows as screens are ported rather than being stubbed ahead.
 */
const ITEMS: Record<PortalSide, NavItem[]> = {
  retailer: [
    { to: '/retailer', label: 'Home', icon: Home },
    { to: '/retailer/inventory', label: 'Inventory', icon: Package },
    { to: '/retailer/donations', label: 'Donations', icon: Gift },
  ],
  ngo: [
    { to: '/ngo', label: 'Claims', icon: Home },
    { to: '/ngo/shelf', label: 'Available', icon: Store },
  ],
  admin: [
    { to: '/retailer', label: 'Retailer', icon: Home },
    { to: '/ngo', label: 'NGO', icon: Home },
  ],
};

/** The single bottom navigation both sides share. */
export function BottomNav({ side }: { side: PortalSide }) {
  const items = ITEMS[side];

  if (items.length < 2) {
    return null;
  }

  return (
    <nav className="sticky bottom-0 z-40 flex border-t border-border-tan bg-white/95 backdrop-blur">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // `end` so the index route does not stay highlighted on its children.
          end={item.to === `/${side === 'ngo' ? 'ngo' : 'retailer'}`}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
              isActive ? 'text-retailer-accent' : 'text-brand-brown/55'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
