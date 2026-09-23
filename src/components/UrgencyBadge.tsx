import { SurplusUrgency } from '@/api-client';

const STYLES: Record<SurplusUrgency, { label: string; className: string }> = {
  [SurplusUrgency.Critical]: {
    label: 'Critical',
    className: 'bg-urgency-critical/12 text-urgency-critical',
  },
  [SurplusUrgency.Expiring]: {
    label: 'Expiring',
    className: 'bg-urgency-expiring/20 text-brand-brown',
  },
  [SurplusUrgency.Standard]: {
    label: 'Standard',
    className: 'bg-urgency-standard/12 text-urgency-standard',
  },
};

/**
 * The urgency band, as returned by the API.
 *
 * Both prototypes computed urgency client-side from a stored `daysRemaining` that
 * had gone stale. The band arrives from the server now, so every client agrees on
 * what is critical.
 */
export function UrgencyBadge({ urgency }: { urgency: SurplusUrgency }) {
  const style = STYLES[urgency];

  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.className}`}
    >
      {style.label}
    </span>
  );
}
