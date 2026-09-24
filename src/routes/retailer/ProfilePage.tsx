import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  HeartHandshake,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/auth/useAuth';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { PickupWindowsCard } from '@/components/PickupWindowsCard';
import {
  getPartners,
  getRetailerImpact,
  PARTNERSHIP_STATUS_LABELS,
  partnersQueryKey,
  RECIPIENT_TYPE_LABELS,
  retailerImpactQueryKey,
  type PartnerVM,
} from '@/features/retailer-profile/_logic';

const card = 'rounded-2xl border border-border-tan bg-white p-3.5';
const heading =
  'mb-2.5 flex items-center gap-1.5 border-b border-border-tan/60 pb-2.5 text-[11px] font-semibold text-brand-brown/70';

/** The current year and month, as the impact report expects them. */
function periods(): { thisMonth: string; thisYear: string } {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  return {
    thisMonth: `${now.getFullYear()}-${month}`,
    thisYear: String(now.getFullYear()),
  };
}

/**
 * The branch's own page: what it is, what it has rescued, and who collects from it.
 *
 * The impact figures come from the API's period report rather than being summed
 * here, because the same numbers go on the tax paperwork and the two must not
 * disagree.
 */
export function ProfilePage() {
  const { session } = useAuth();
  const locationId = session?.primaryLocationId ?? '';
  const { thisMonth, thisYear } = periods();
  const [period, setPeriod] = useState<string | undefined>(thisYear);

  const impact = useQuery({
    queryKey: retailerImpactQueryKey(locationId, period),
    queryFn: () => getRetailerImpact(locationId, period),
    enabled: locationId !== '',
  });

  const partners = useQuery({
    queryKey: partnersQueryKey(locationId),
    queryFn: () => getPartners(locationId),
    enabled: locationId !== '',
  });

  const retailer = session?.retailer;
  const branch = session?.primaryLocation;

  return (
    <section className="space-y-3.5 p-4">
      <header>
        <h1 className="flex items-center gap-1.5 text-lg font-semibold text-brand-brown">
          {session?.organizationName}
          {retailer?.isVerified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand-amber" />
          )}
        </h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">{session?.email}</p>
      </header>

      <div className={card}>
        <p className={heading}>
          <Store className="h-3.5 w-3.5" />
          This branch
        </p>
        {branch ? (
          <>
            <p className="text-sm font-semibold text-brand-ink">
              {branch.label}
              {branch.code && (
                <span className="ml-1.5 font-mono text-[10px] font-medium text-brand-brown/60">
                  {branch.code}
                </span>
              )}
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-[11px] text-brand-brown/80">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
              {[branch.addressLine1, branch.neighborhood, branch.city]
                .filter(Boolean)
                .join(', ')}
            </p>
            {session?.primaryContactName && (
              <p className="mt-1 text-[11px] text-brand-brown/70">
                Contact: {session.primaryContactName}
              </p>
            )}
            {branch.pickupHoursToday && branch.pickupHoursToday.length > 0 ? (
              <p className="mt-1 text-[11px] text-brand-brown/70">
                Collection today: {branch.pickupHoursToday.join(', ')}
              </p>
            ) : (
              <p className="mt-1.5 rounded-xl bg-surface-cream px-3 py-2 text-[11px] leading-relaxed text-brand-brown/80">
                No collection windows published. Foodbanks must propose a time
                instead of accepting one of yours.
              </p>
            )}
            {branch.latitude == null && (
              <p className="mt-1.5 rounded-xl bg-surface-cream px-3 py-2 text-[11px] leading-relaxed text-brand-brown/80">
                This branch is not pinned on the map, so nobody searching nearby
                can see how far away you are.
              </p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-brand-brown/70">No branch yet.</p>
        )}
      </div>

      {locationId !== '' && <PickupWindowsCard locationId={locationId} />}

      <div className={card}>
        <p className={heading}>
          <Sparkles className="h-3.5 w-3.5" />
          Food rescued
        </p>

        <div className="mb-3 flex gap-1 rounded-xl border border-border-tan p-1 text-[11px]">
          {[
            { value: thisMonth, label: 'This month' },
            { value: thisYear, label: 'This year' },
            { value: undefined, label: 'All time' },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={`flex-1 rounded-lg py-1.5 font-semibold transition ${
                period === option.value
                  ? 'bg-brand-amber text-brand-brown'
                  : 'text-brand-brown/70 hover:text-brand-brown'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {impact.isPending ? (
          <p className="flex items-center gap-2 py-2 text-[11px] text-brand-brown/60">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </p>
        ) : impact.error ? (
          <p role="alert" className="text-[11px] text-red-700">
            {impact.error instanceof Error
              ? impact.error.message
              : 'Could not load your impact report.'}
          </p>
        ) : (
          impact.data && (
            <>
              <div className="grid grid-cols-3 divide-x divide-border-tan text-center">
                <Metric
                  value={`${impact.data.totalWeightKg} kg`}
                  label="Rescued"
                />
                <Metric
                  value={`~${Math.round(impact.data.totalMeals)}`}
                  label="Meals"
                />
                <Metric
                  value={`${impact.data.totalRetailValue} ${impact.data.currency}`}
                  label="Retail value"
                />
              </div>
              <p className="mt-2.5 border-t border-border-tan/60 pt-2.5 text-[10px] leading-relaxed text-brand-brown/60">
                {impact.data.periodLabel} · {impact.data.donationCount}{' '}
                {impact.data.donationCount === 1 ? 'handover' : 'handovers'} to{' '}
                {impact.data.partnerCount}{' '}
                {impact.data.partnerCount === 1 ? 'partner' : 'partners'}. Meals
                reckoned at {impact.data.impactFactor.mealsPerKg} per kg.
              </p>
            </>
          )
        )}
      </div>

      <div className={card}>
        <p className={heading}>
          <HeartHandshake className="h-3.5 w-3.5" />
          Who collects from you
        </p>

        {partners.isPending ? (
          <p className="py-2 text-[11px] text-brand-brown/60">Loading…</p>
        ) : (partners.data ?? []).length === 0 ? (
          <p className="text-[11px] leading-relaxed text-brand-brown/70">
            No partners yet. Anything you publish to the shelf can be claimed by
            any verified organisation in range — a partnership just means you
            have worked together before.
          </p>
        ) : (
          <ul className="divide-y divide-border-tan/60">
            {(partners.data ?? []).map((partner) => (
              <PartnerRow key={partner.partnershipId} partner={partner} />
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <p className={heading}>
          <Building2 className="h-3.5 w-3.5" />
          Business details
        </p>
        <dl className="space-y-1 text-[11px]">
          <Detail label="Registered name" value={retailer?.legalName} />
          <Detail label="Tax ID" value={retailer?.taxId} />
          <Detail label="Business type" value={retailer?.businessType} />
          <Detail
            label="Status"
            value={retailer?.isVerified ? 'Verified' : 'Awaiting verification'}
          />
        </dl>
      </div>

      <ChangePasswordCard />
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-1">
      <span className="text-sm font-bold tracking-tight text-brand-ink">
        {value}
      </span>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-brand-brown/70">
        {label}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-brand-brown/60">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-brand-ink">
        {value ?? '—'}
      </dd>
    </div>
  );
}

function PartnerRow({ partner }: { partner: PartnerVM }) {
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      {partner.logoUrl ? (
        <img
          src={partner.logoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="h-9 w-9 shrink-0 rounded-lg bg-surface-cream" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-xs font-semibold text-brand-ink">
          {partner.name}
          {partner.isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
          )}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-brand-brown/70">
          {RECIPIENT_TYPE_LABELS[partner.type]} ·{' '}
          {PARTNERSHIP_STATUS_LABELS[partner.status]} · {partner.deliveredCount}{' '}
          {partner.deliveredCount === 1 ? 'handover' : 'handovers'}
        </p>
        {(partner.contactPerson ?? partner.vehiclePlate) && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-brand-brown/70">
            <Truck className="h-3 w-3 shrink-0 text-brand-brown/40" />
            {[partner.contactPerson, partner.vehiclePlate]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>
      {partner.phone && (
        <a
          href={`tel:${partner.phone}`}
          aria-label={`Call ${partner.name}`}
          className="shrink-0 rounded-lg border border-border-tan p-1.5 text-brand-brown/70 transition hover:bg-surface-cream"
        >
          <Phone className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  );
}
