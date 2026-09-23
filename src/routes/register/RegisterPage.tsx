import { Building2, HeartHandshake, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { BusinessType, RecipientType } from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import { homePathFor } from '@/auth/paths';
import { SpiraLogo } from '@/components/SpiraLogo';
import { registerRecipient, registerRetailer } from '@/features/auth/_logic';

/** Which registration form is showing. `null` is the side chooser. */
type Choice = 'retailer' | 'ngo' | null;

const LABELS: Record<string, string> = {
  SUPERMARKET: 'Supermarket',
  HYPERMARKET: 'Hypermarket',
  RESTAURANT: 'Restaurant',
  HOTEL: 'Hotel',
  BAKERY: 'Bakery',
  CATERING: 'Catering',
  DISTRIBUTOR: 'Distributor',
  MANUFACTURER: 'Manufacturer',
  FARM: 'Farm',
  CORPORATE_CAFETERIA: 'Corporate cafeteria',
  CONVENIENCE_STORE: 'Convenience store',
  OTHER: 'Other',
  NGO: 'NGO',
  FOOD_BANK: 'Food bank',
  SOUP_KITCHEN: 'Soup kitchen',
  SHELTER: 'Shelter',
  COMMUNITY_FRIDGE: 'Community fridge',
  CHURCH: 'Church',
  SCHOOL: 'School',
};

const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber';
const label = 'mt-3 block text-xs font-medium text-brand-brown/80';

/**
 * Self-registration for both sides.
 *
 * One page with a side chooser rather than two routes, because the person arriving
 * here does not yet know which noun Spira uses for them — "retailer" and "recipient"
 * are our words, not theirs. The chooser explains both in their terms first.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { adoptSession } = useAuth();

  const [choice, setChoice] = useState<Choice>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shared account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Retailer
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>(
    BusinessType.Supermarket,
  );

  // Recipient
  const [displayName, setDisplayName] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>(
    RecipientType.FoodBank,
  );
  const [serviceArea, setServiceArea] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const side =
        choice === 'retailer'
          ? await registerRetailer({
              email,
              password,
              fullName,
              legalName,
              tradeName: tradeName || undefined,
              taxId,
              businessType,
            })
          : await registerRecipient({
              email,
              password,
              fullName,
              displayName,
              type: recipientType,
              serviceArea: serviceArea || undefined,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });

      await adoptSession();
      navigate(homePathFor(side), { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not complete registration.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-cream px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <SpiraLogo size="lg" />
          <p className="text-sm text-brand-brown/70">
            Waste ends. Value circulates.
          </p>
        </div>

        {choice === null ? (
          <div className="rounded-3xl border border-border-tan bg-white p-6 shadow-sm">
            <h1 className="mb-1 text-lg font-semibold text-brand-brown">
              Register your organisation
            </h1>
            <p className="mb-5 text-xs text-brand-brown/70">
              Which side are you on?
            </p>

            <button
              onClick={() => setChoice('retailer')}
              className="mb-3 flex w-full items-start gap-3 rounded-2xl border border-border-tan p-4 text-left transition hover:border-brand-amber"
            >
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-retailer-accent" />
              <span>
                <span className="block text-sm font-semibold text-brand-brown">
                  We have surplus food
                </span>
                <span className="block text-xs text-brand-brown/70">
                  Supermarkets, bakeries, restaurants, distributors
                </span>
              </span>
            </button>

            <button
              onClick={() => setChoice('ngo')}
              className="flex w-full items-start gap-3 rounded-2xl border border-border-tan p-4 text-left transition hover:border-brand-amber"
            >
              <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
              <span>
                <span className="block text-sm font-semibold text-brand-brown">
                  We collect and redistribute food
                </span>
                <span className="block text-xs text-brand-brown/70">
                  Foodbanks, NGOs, soup kitchens, shelters
                </span>
              </span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-3xl border border-border-tan bg-white p-6 shadow-sm"
          >
            <h1 className="mb-5 text-lg font-semibold text-brand-brown">
              {choice === 'retailer'
                ? 'Register your business'
                : 'Register your organisation'}
            </h1>

            {choice === 'retailer' ? (
              <>
                <label className={label}>
                  Registered company name
                  <input
                    required
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Public brand <span className="font-normal">(optional)</span>
                  <input
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Tax ID
                  <input
                    required
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Type of business
                  <select
                    value={businessType}
                    onChange={(e) =>
                      setBusinessType(e.target.value as BusinessType)
                    }
                    className={field}
                  >
                    {Object.values(BusinessType).map((value) => (
                      <option key={value} value={value}>
                        {LABELS[value] ?? value}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className={label}>
                  Organisation name
                  <input
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={field}
                  />
                </label>
                <label className={label}>
                  Type of organisation
                  <select
                    value={recipientType}
                    onChange={(e) =>
                      setRecipientType(e.target.value as RecipientType)
                    }
                    className={field}
                  >
                    {Object.values(RecipientType).map((value) => (
                      <option key={value} value={value}>
                        {LABELS[value] ?? value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Area you serve <span className="font-normal">(optional)</span>
                  <input
                    value={serviceArea}
                    onChange={(e) => setServiceArea(e.target.value)}
                    placeholder="Metropolitan Barcelona"
                    className={field}
                  />
                </label>
              </>
            )}

            <div className="my-4 border-t border-border-tan pt-1" />

            <label className={label}>
              Your name
              <input
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={field}
              />
            </label>
            <p className="mt-1 text-[11px] text-brand-brown/60">
              Printed on the donation certificates you authorise.
            </p>

            <label className={label}>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>

            <label className={label}>
              Password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
            </label>
            <p className="mt-1 text-[11px] text-brand-brown/60">
              At least 12 characters, with an uppercase letter, a lowercase
              letter and a digit.
            </p>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating your account…' : 'Create account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setChoice(null);
                setError(null);
              }}
              className="mt-3 w-full text-center text-xs text-brand-brown/70 underline"
            >
              Back
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-brand-brown/70">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-brown underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
