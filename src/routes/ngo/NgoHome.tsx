import { useAuth } from '@/auth/useAuth';

/** Placeholder NGO shell. The ported screens land here next. */
export function NgoHome() {
  const { session } = useAuth();

  return (
    <section className="p-5">
      <h1 className="text-lg font-semibold text-brand-brown">
        {session?.organizationName ?? 'Organisation'}
      </h1>
      <p className="mt-1 text-xs text-brand-brown/70">
        {session?.email} · {session?.role}
        {session && !session.isVerified && ' · unverified'}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-tan p-4">
          <dt className="text-xs text-brand-brown/70">Rescued</dt>
          <dd className="text-xl font-semibold text-brand-brown">
            {session?.impact.totalWeightKg ?? 0} kg
          </dd>
        </div>
        <div className="rounded-2xl border border-border-tan p-4">
          <dt className="text-xs text-brand-brown/70">Meals</dt>
          <dd className="text-xl font-semibold text-brand-brown">
            {session?.impact.totalMeals ?? 0}
          </dd>
        </div>
      </dl>
      <p className="mt-6 text-xs text-brand-brown/60">
        Service area: {session?.recipient?.serviceArea ?? 'not set'} · Contact:{' '}
        {session?.primaryContactName ?? 'none'}
      </p>
    </section>
  );
}
