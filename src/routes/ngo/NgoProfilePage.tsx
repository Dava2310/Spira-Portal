import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  Crosshair,
  Loader2,
  MapPin,
  Plus,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

import { ContactType, UrgencyThreshold } from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import {
  addNgoContact,
  CONTACT_TYPE_LABELS,
  createNgoBase,
  getNgoBases,
  getNgoContacts,
  getNgoProfile,
  ngoBasesQueryKey,
  ngoContactsQueryKey,
  ngoProfileQueryKey,
  updateAlertPreferences,
  URGENCY_THRESHOLD_LABELS,
  verificationPassQueryKey,
  getVerificationPass,
  type NgoBaseVM,
} from '@/features/ngo-profile/_logic';
import { findCurrentPosition } from '@/features/shelf/_logic';

const card = 'rounded-2xl border border-border-tan bg-white p-3.5';
const heading =
  'mb-2.5 flex items-center gap-1.5 border-b border-border-tan/60 pb-2.5 text-[11px] font-semibold text-brand-brown/70';
const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-amber';

/**
 * The organisation's own settings.
 *
 * Holds the collection base, which is where the shelf measures distances from —
 * registration deliberately does not ask for one, and without it nothing can be
 * sorted by distance unless the browser shares a position.
 */
export function NgoProfilePage() {
  const { session } = useAuth();
  const recipientId = session?.recipient?.id ?? '';

  const profile = useQuery({
    queryKey: ngoProfileQueryKey,
    queryFn: getNgoProfile,
  });
  const contacts = useQuery({
    queryKey: ngoContactsQueryKey,
    queryFn: getNgoContacts,
  });
  const bases = useQuery({
    queryKey: ngoBasesQueryKey,
    queryFn: () => getNgoBases(recipientId),
    enabled: recipientId !== '',
  });
  const pass = useQuery({
    queryKey: verificationPassQueryKey,
    queryFn: getVerificationPass,
  });

  if (profile.isPending) {
    return (
      <p className="flex items-center gap-2 p-5 text-sm text-brand-brown/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your organisation…
      </p>
    );
  }

  if (profile.error) {
    return (
      <p
        role="alert"
        className="m-4 rounded-xl bg-red-50 p-3 text-xs text-red-700"
      >
        {profile.error instanceof Error
          ? profile.error.message
          : 'Could not load your organisation.'}
      </p>
    );
  }

  const data = profile.data;

  return (
    <section className="space-y-3.5 p-4">
      <header>
        <h1 className="flex items-center gap-1.5 text-lg font-semibold text-brand-brown">
          {data?.displayName}
          {data?.isVerified && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand-amber" />
          )}
        </h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {data?.legalName ?? session?.email}
          {data?.serviceArea && ` · ${data.serviceArea}`}
        </p>
      </header>

      {data && !data.isVerified && (
        <p className="rounded-xl border border-border-tan bg-surface-cream px-3 py-2 text-[11px] leading-relaxed text-brand-brown/80">
          Your organisation is not verified yet. You can claim and collect as
          normal — the badge is there for shops deciding who to give to.
        </p>
      )}

      {pass.data && (
        <div className={card}>
          <p className={heading}>
            <BadgeCheck className="h-3.5 w-3.5" />
            Verification pass
          </p>
          <div className="flex items-center gap-4">
            <span className="rounded-xl border border-border-tan bg-white p-2">
              <QRCodeSVG
                value={pass.data.passCode}
                size={88}
                level="M"
                bgColor="#ffffff"
                fgColor="#372506"
              />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-brand-ink">
                {pass.data.displayName}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-brand-brown/70">
                {pass.data.passCode}
              </p>
              {pass.data.registrationCode && (
                <p className="mt-0.5 text-[10px] text-brand-brown/70">
                  Reg. {pass.data.registrationCode}
                </p>
              )}
              <p className="mt-1 text-[10px] leading-relaxed text-brand-brown/60">
                Show this at a shop that has not worked with you before.
              </p>
            </div>
          </div>
        </div>
      )}

      {data && <AlertSettings profile={data} />}

      <BasesCard
        recipientId={recipientId}
        bases={bases.data ?? []}
        isPending={bases.isPending}
        timezone={data?.timezone ?? 'Europe/Madrid'}
      />

      <div className={card}>
        <p className={heading}>
          <Users className="h-3.5 w-3.5" />
          Authorised staff
        </p>
        {contacts.isPending ? (
          <p className="py-2 text-[11px] text-brand-brown/60">Loading…</p>
        ) : (
          <>
            <ul className="divide-y divide-border-tan/60">
              {(contacts.data ?? []).map((contact) => (
                <li key={contact.id} className="py-2 first:pt-0">
                  <p className="text-xs font-semibold text-brand-ink">
                    {contact.fullName}
                    {contact.isPrimary && (
                      <span className="ml-1.5 rounded bg-brand-amber/20 px-1.5 py-0.5 text-[9px] font-medium text-brand-brown">
                        main
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-brand-brown/70">
                    {CONTACT_TYPE_LABELS[contact.type]}
                    {contact.phone && ` · ${contact.phone}`}
                    {contact.email && ` · ${contact.email}`}
                  </p>
                </li>
              ))}
            </ul>
            {(contacts.data ?? []).length === 0 && (
              <p className="py-1 text-[11px] text-brand-brown/60">
                Only the account owner is listed. Add the drivers who collect,
                so a shop knows who to expect.
              </p>
            )}
            <AddContact />
          </>
        )}
      </div>
    </section>
  );
}

function AlertSettings({
  profile,
}: {
  profile: { alertRadiusKm: number; urgencyThreshold: UrgencyThreshold };
}) {
  const queryClient = useQueryClient();
  const [radius, setRadius] = useState(profile.alertRadiusKm);

  const save = useMutation({
    mutationFn: (changes: {
      alertRadiusKm?: number;
      urgencyThreshold?: UrgencyThreshold;
    }) => updateAlertPreferences(changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ngoProfileQueryKey });
      // The radius bounds what the shelf returns, so its pages are stale too.
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });

  return (
    <div className={card}>
      <p className={heading}>
        <MapPin className="h-3.5 w-3.5" />
        Surplus alerts
      </p>

      <label className="block text-xs font-medium text-brand-brown/80">
        How far to look: <strong>{radius} km</strong>
        <input
          type="range"
          min={1}
          max={100}
          value={radius}
          onChange={(event) => setRadius(Number(event.target.value))}
          onPointerUp={() => save.mutate({ alertRadiusKm: radius })}
          className="mt-2 w-full accent-brand-amber"
        />
      </label>

      <p className="mt-3 text-xs font-medium text-brand-brown/80">
        What to be told about
      </p>
      <div className="mt-1.5 space-y-1.5">
        {Object.values(UrgencyThreshold).map((value) => (
          <button
            key={value}
            onClick={() => save.mutate({ urgencyThreshold: value })}
            aria-pressed={profile.urgencyThreshold === value}
            className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${
              profile.urgencyThreshold === value
                ? 'border-brand-amber bg-brand-amber/10 text-brand-ink'
                : 'border-border-tan text-brand-brown/80 hover:bg-surface-cream'
            }`}
          >
            {URGENCY_THRESHOLD_LABELS[value]}
          </button>
        ))}
      </div>

      {save.isPending && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-brown/60">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}
      {save.error && (
        <p role="alert" className="mt-2 text-[11px] text-red-700">
          {save.error instanceof Error
            ? save.error.message
            : 'Could not save that.'}
        </p>
      )}
    </div>
  );
}

function BasesCard({
  recipientId,
  bases,
  isPending,
  timezone,
}: {
  recipientId: string;
  bases: NgoBaseVM[];
  isPending: boolean;
  timezone: string;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [addressLine1, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      createNgoBase({
        recipientId,
        label,
        addressLine1,
        city,
        postalCode: postalCode || undefined,
        countryCode: 'ES',
        timezone,
        latitude: coords?.lat,
        longitude: coords?.lng,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ngoBasesQueryKey });
      await queryClient.invalidateQueries({ queryKey: ['shelf'] });
      setAdding(false);
      setLabel('');
      setAddress('');
      setCity('');
      setPostalCode('');
      setCoords(null);
    },
  });

  const locate = async () => {
    setLocating(true);
    setCoords(await findCurrentPosition());
    setLocating(false);
  };

  return (
    <div className={card}>
      <p className={heading}>
        <Building2 className="h-3.5 w-3.5" />
        Collection base
      </p>

      {isPending ? (
        <p className="py-2 text-[11px] text-brand-brown/60">Loading…</p>
      ) : bases.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-brand-brown/70">
          You have no base saved. Distances on the shelf are measured from here,
          so adding one puts the nearest shops first.
        </p>
      ) : (
        <ul className="divide-y divide-border-tan/60">
          {bases.map((base) => (
            <li key={base.id} className="py-2 first:pt-0">
              <p className="text-xs font-semibold text-brand-ink">
                {base.label}
                {base.isPrimary && (
                  <span className="ml-1.5 rounded bg-brand-amber/20 px-1.5 py-0.5 text-[9px] font-medium text-brand-brown">
                    main
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[10px] text-brand-brown/70">
                {base.address}
                {!base.hasCoordinates && ' · no coordinates, so no distances'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="mt-2.5 border-t border-border-tan/60 pt-2.5"
        >
          <input
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Main warehouse"
            className={field}
          />
          <input
            required
            value={addressLine1}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Street address"
            className={field}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City"
              className={field}
            />
            <input
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
              placeholder="Postal code"
              className={field}
            />
          </div>

          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-border-tan px-2.5 py-1.5 text-[11px] font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            {coords
              ? `Coordinates set (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
              : 'Use my current position'}
          </button>
          <p className="mt-1 text-[10px] leading-relaxed text-brand-brown/60">
            Do this while standing at the base. Without coordinates the address
            is still saved, but distances cannot be worked out.
          </p>

          {save.error && (
            <p role="alert" className="mt-2 text-[11px] text-red-700">
              {save.error instanceof Error
                ? save.error.message
                : 'Could not save that base.'}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-border-tan py-2 text-xs font-semibold text-brand-brown"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2 text-xs font-semibold text-brand-brown disabled:opacity-60"
            >
              {save.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Save base
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-brown underline"
        >
          <Plus className="h-3.5 w-3.5" />
          {bases.length === 0 ? 'Add a base' : 'Add another base'}
        </button>
      )}
    </div>
  );
}

function AddContact() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<ContactType>(ContactType.Driver);

  const save = useMutation({
    mutationFn: () =>
      addNgoContact({ fullName, type, phone: phone || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ngoContactsQueryKey });
      setOpen(false);
      setFullName('');
      setPhone('');
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-brand-brown underline"
      >
        <Plus className="h-3.5 w-3.5" />
        Add someone
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="mt-2.5 border-t border-border-tan/60 pt-2.5"
    >
      <input
        required
        minLength={2}
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Full name"
        className={field}
      />
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="Phone (optional)"
        className={field}
      />
      <select
        value={type}
        onChange={(event) => setType(event.target.value as ContactType)}
        className={field}
      >
        {Object.values(ContactType).map((value) => (
          <option key={value} value={value}>
            {CONTACT_TYPE_LABELS[value]}
          </option>
        ))}
      </select>

      {save.error && (
        <p role="alert" className="mt-2 text-[11px] text-red-700">
          {save.error instanceof Error
            ? save.error.message
            : 'Could not add that person.'}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-border-tan py-2 text-xs font-semibold text-brand-brown"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2 text-xs font-semibold text-brand-brown disabled:opacity-60"
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Add
        </button>
      </div>
    </form>
  );
}
