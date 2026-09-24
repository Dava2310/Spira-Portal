import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  DonationReason,
  ExpiryKind,
  ProductCategory,
  UnitOfMeasure,
} from '@/api-client';
import { useAuth } from '@/auth/useAuth';
import {
  CATEGORY_LABELS,
  createLot,
  REASON_LABELS,
} from '@/features/inventory/_logic';
import {
  createProduct,
  getProducts,
  matchProducts,
  productsQueryKey,
  type ProductVM,
} from '@/features/products/_logic';

const field =
  'mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber';
const label = 'mt-3 block text-xs font-medium text-brand-brown/80';

const UNIT_LABELS: Record<UnitOfMeasure, string> = {
  [UnitOfMeasure.Unit]: 'units',
  [UnitOfMeasure.Pack]: 'packs',
  [UnitOfMeasure.Crate]: 'crates',
  [UnitOfMeasure.Box]: 'boxes',
  [UnitOfMeasure.Kg]: 'kg',
};

/**
 * Logging surplus: pick the product, say how much and why.
 *
 * The product comes first because it is reused — the same bread is logged most
 * mornings — so the catalogue is searched before anything is typed, and a new product
 * is only created when nothing matches.
 *
 * The expiry asks which *kind* of date it is rather than guessing. Past a best-before
 * a lot may still be given away; past a use-by it may not, and Spira refuses to offer
 * it. Getting that backwards is the one mistake here that reaches someone's dinner.
 */
export function LogLotPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const retailerId = session?.retailer?.id ?? '';
  const locationId = session?.primaryLocationId ?? '';

  const [product, setProduct] = useState<ProductVM | null>(null);
  const [search, setSearch] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<UnitOfMeasure>(UnitOfMeasure.Unit);
  const [weightKg, setWeightKg] = useState('');
  const [retailValue, setRetailValue] = useState('');
  const [reason, setReason] = useState<DonationReason>(
    DonationReason.NearExpiry,
  );
  const [reasonDescription, setReasonDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [expiryKind, setExpiryKind] = useState<ExpiryKind | ''>('');
  const [listNow, setListNow] = useState(true);

  const products = useQuery({
    queryKey: productsQueryKey(retailerId),
    queryFn: () => getProducts(retailerId),
    enabled: retailerId !== '',
  });

  const matches = useMemo(
    () => matchProducts(products.data ?? [], search),
    [products.data, search],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!product) {
        throw new Error('Pick a product first.');
      }

      if (expiresAt !== '' && expiryKind === '') {
        throw new Error(
          'Say whether that date is a best-before or a use-by: the two are treated differently.',
        );
      }

      return await createLot({
        locationId,
        productId: product.id,
        quantity: Number(quantity),
        unit,
        weightKg: Number(weightKg),
        reason,
        reasonDescription: reasonDescription.trim() || undefined,
        retailValue: retailValue === '' ? undefined : Number(retailValue),
        expiresAt:
          expiresAt === '' ? undefined : new Date(expiresAt).toISOString(),
        expiryKind: expiryKind === '' ? undefined : expiryKind,
        isListed: listNow,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['retailer'] });
      navigate('/retailer/inventory', { replace: true });
    },
  });

  return (
    <section className="p-4">
      <Link
        to="/retailer/inventory"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-brown/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to inventory
      </Link>

      <h1 className="text-lg font-semibold text-brand-brown">Log surplus</h1>
      <p className="mt-0.5 text-xs text-brand-brown/70">
        Anything you will not sell but somebody can still eat.
      </p>

      {product === null ? (
        <ProductPicker
          matches={matches}
          isPending={products.isPending}
          search={search}
          onSearch={setSearch}
          onPick={setProduct}
          creating={creatingProduct}
          onCreating={setCreatingProduct}
          retailerId={retailerId}
          onCreated={(created) => {
            setProduct(created);
            setCreatingProduct(false);
          }}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-brand-amber bg-brand-amber/10 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-ink">
                {product.name}
              </p>
              <p className="truncate text-[11px] text-brand-brown/70">
                {product.brand ? `${product.brand} · ` : ''}
                {CATEGORY_LABELS[product.category]}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProduct(null)}
              className="shrink-0 text-[11px] font-semibold text-brand-brown underline"
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              How many
              <input
                required
                type="number"
                min="0.001"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              Counted in
              <select
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as UnitOfMeasure)
                }
                className={field}
              >
                {Object.values(UnitOfMeasure).map((value) => (
                  <option key={value} value={value}>
                    {UNIT_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Total weight (kg)
              <input
                required
                type="number"
                min="0"
                step="any"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                className={field}
              />
            </label>
            <label className={label}>
              Retail value <span className="font-normal">(optional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={retailValue}
                onChange={(event) => setRetailValue(event.target.value)}
                className={field}
              />
            </label>
          </div>
          <p className="mt-1 text-[11px] text-brand-brown/60">
            Weight is what the impact figures are reckoned from, so it is worth
            getting roughly right.
          </p>

          <label className={label}>
            Why it cannot be sold
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as DonationReason)
              }
              className={field}
            >
              {Object.values(DonationReason).map((value) => (
                <option key={value} value={value}>
                  {REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            Anything to add <span className="font-normal">(optional)</span>
            <input
              value={reasonDescription}
              onChange={(event) => setReasonDescription(event.target.value)}
              placeholder="Crushed outer film, bottles intact"
              className={field}
            />
          </label>

          <label className={label}>
            Date on the pack <span className="font-normal">(optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className={field}
            />
          </label>

          {expiresAt !== '' && (
            <>
              <p className="mt-3 text-xs font-medium text-brand-brown/80">
                Which date is that?
              </p>
              <div className="mt-1.5 space-y-1.5">
                <KindChoice
                  active={expiryKind === ExpiryKind.BestBefore}
                  onClick={() => setExpiryKind(ExpiryKind.BestBefore)}
                  title="Best before"
                  detail="Quality. Still donatable after this date."
                />
                <KindChoice
                  active={expiryKind === ExpiryKind.UseBy}
                  onClick={() => setExpiryKind(ExpiryKind.UseBy)}
                  title="Use by"
                  detail="Safety. Cannot be donated after this date, and Spira will stop offering it."
                />
              </div>
            </>
          )}

          <label className="mt-4 flex items-start gap-2.5 text-xs text-brand-brown/80">
            <input
              type="checkbox"
              checked={listNow}
              onChange={(event) => setListNow(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-amber"
            />
            <span>
              Publish to the shelf now, so foodbanks nearby can claim it. You
              can withdraw it at any time.
            </span>
          </label>

          {save.error && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {save.error instanceof Error
                ? save.error.message
                : 'Could not log that lot.'}
            </p>
          )}

          <button
            type="submit"
            disabled={save.isPending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Log it
          </button>
        </form>
      )}
    </section>
  );
}

function KindChoice({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-brand-amber bg-brand-amber/10'
          : 'border-border-tan hover:bg-surface-cream'
      }`}
    >
      <span className="block text-xs font-semibold text-brand-ink">
        {title}
      </span>
      <span className="block text-[11px] leading-relaxed text-brand-brown/70">
        {detail}
      </span>
    </button>
  );
}

function ProductPicker({
  matches,
  isPending,
  search,
  onSearch,
  onPick,
  creating,
  onCreating,
  retailerId,
  onCreated,
}: {
  matches: ProductVM[];
  isPending: boolean;
  search: string;
  onSearch: (value: string) => void;
  onPick: (product: ProductVM) => void;
  creating: boolean;
  onCreating: (value: boolean) => void;
  retailerId: string;
  onCreated: (product: ProductVM) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<ProductCategory>(
    ProductCategory.Bakery,
  );

  const create = useMutation({
    mutationFn: () =>
      createProduct({
        retailerId,
        name,
        category,
        brand: brand.trim() || undefined,
        barcode: barcode.trim() || undefined,
      }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKey(retailerId),
      });
      onCreated(created);
    },
  });

  if (creating) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="mt-4"
      >
        <p className="text-xs font-semibold text-brand-brown/70">New product</p>
        <label className={label}>
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sourdough loaf 500g"
            className={field}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Brand <span className="font-normal">(optional)</span>
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className={field}
            />
          </label>
          <label className={label}>
            Barcode <span className="font-normal">(optional)</span>
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              className={field}
            />
          </label>
        </div>
        <label className={label}>
          Category
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as ProductCategory)
            }
            className={field}
          >
            {Object.values(ProductCategory).map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        {create.error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {create.error instanceof Error
              ? create.error.message
              : 'Could not save that product.'}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onCreating(false)}
            className="flex-1 rounded-xl border border-border-tan py-2.5 text-xs font-semibold text-brand-brown"
          >
            Back to search
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-amber py-2.5 text-xs font-semibold text-brand-brown disabled:opacity-60"
          >
            {create.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Save and continue
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-brown/40" />
        <input
          autoFocus
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search your products, or scan a barcode"
          className="w-full rounded-xl border border-border-tan py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-amber"
        />
      </div>

      {isPending ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-brand-brown/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your products…
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onPick(item)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border-tan p-3 text-left transition hover:border-brand-amber"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-brand-ink">
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-brand-brown/70">
                    {item.brand ? `${item.brand} · ` : ''}
                    {CATEGORY_LABELS[item.category]}
                    {item.barcode ? ` · ${item.barcode}` : ''}
                  </span>
                </span>
                <Check className="h-4 w-4 shrink-0 text-brand-brown/30" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => onCreating(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-tan py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream"
      >
        <Plus className="h-3.5 w-3.5" />
        {search.trim() === ''
          ? 'Add a product you have not logged before'
          : `Add "${search.trim()}" as a new product`}
      </button>
    </div>
  );
}
