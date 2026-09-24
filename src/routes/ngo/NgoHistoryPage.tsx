import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { FileText, HeartHandshake, Loader2, Truck } from 'lucide-react';

import {
  getPickups,
  openReceiptPdf,
  pickupsQueryKey,
  type ReceiptVM,
} from '@/features/receipts/_logic';

/**
 * What this organisation has actually collected.
 *
 * Built from the certificates rather than from the donations, because the
 * certificate is the record that was signed: the names and tax IDs on it were
 * captured at handover, so a shop renaming itself later does not rewrite history.
 *
 * Reads the recipient portal's own route, which is scoped to the caller —
 * `GET /api/donation-receipts` is not scoped at all.
 */
export function NgoHistoryPage() {
  const history = useInfiniteQuery({
    queryKey: pickupsQueryKey,
    queryFn: ({ pageParam }) => getPickups(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const receipts = history.data?.pages.flatMap((page) => page.receipts) ?? [];
  const total = history.data?.pages[0]?.total ?? 0;

  const totals = receipts.reduce(
    (sum, receipt) => ({
      weightKg: sum.weightKg + receipt.totalWeightKg,
      meals: sum.meals + (receipt.estimatedMeals ?? 0),
    }),
    { weightKg: 0, meals: 0 },
  );

  return (
    <section className="p-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-brand-brown">Collected</h1>
        <p className="mt-0.5 text-xs text-brand-brown/70">
          {history.isSuccess
            ? `${total} ${total === 1 ? 'collection' : 'collections'}`
            : 'Loading…'}
        </p>
      </header>

      {receipts.length > 0 && (
        <div className="mb-4 grid grid-cols-2 divide-x divide-border-tan rounded-2xl border border-border-tan bg-white py-3 text-center">
          <div className="px-2">
            <span className="text-base font-bold tracking-tight text-brand-ink">
              {Math.round(totals.weightKg * 10) / 10} kg
            </span>
            <p className="mt-0.5 text-[10px] font-medium text-brand-brown/70">
              Rescued{receipts.length < total ? ' so far' : ''}
            </p>
          </div>
          <div className="px-2">
            <span className="text-base font-bold tracking-tight text-brand-ink">
              ~{Math.round(totals.meals)}
            </span>
            <p className="mt-0.5 text-[10px] font-medium text-brand-brown/70">
              Meals
            </p>
          </div>
        </div>
      )}

      {history.isPending && (
        <p className="flex items-center gap-2 py-8 text-sm text-brand-brown/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your collections…
        </p>
      )}

      {history.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {history.error instanceof Error
            ? history.error.message
            : 'Could not load your collection history.'}
        </p>
      )}

      {history.isSuccess && receipts.length === 0 && (
        <div className="py-10 text-center">
          <HeartHandshake className="mx-auto h-8 w-8 text-brand-brown/30" />
          <p className="mt-2 text-sm text-brand-brown/70">
            Nothing collected yet. Your certificates appear here after each
            handover.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {receipts.map((receipt) => (
          <ReceiptRow key={receipt.id} receipt={receipt} />
        ))}
      </ul>

      {history.hasNextPage && (
        <button
          onClick={() => void history.fetchNextPage()}
          disabled={history.isFetchingNextPage}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border-tan py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
        >
          {history.isFetchingNextPage && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Load more ({total - receipts.length} remaining)
        </button>
      )}
    </section>
  );
}

function ReceiptRow({ receipt }: { receipt: ReceiptVM }) {
  const download = useMutation({
    mutationFn: () => openReceiptPdf(receipt.id, receipt.receiptNumber),
  });

  return (
    <li className="rounded-2xl border border-border-tan bg-white p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold text-brand-ink">
            {receipt.receiptNumber}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-brand-ink">
            {receipt.retailerName}
          </p>
          <p className="truncate text-[11px] text-brand-brown/70">
            {receipt.storeLabel}
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-brand-brown/70">
          {receipt.issuedAt.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      <p className="mt-2 text-[11px] font-medium text-brand-brown/80">
        {receipt.lineCount} {receipt.lineCount === 1 ? 'lot' : 'lots'} ·{' '}
        {receipt.totalWeightKg} kg
        {receipt.totalRetailValue !== null &&
          ` · ${receipt.totalRetailValue} ${receipt.currency}`}
        {receipt.estimatedMeals !== null &&
          receipt.estimatedMeals > 0 &&
          ` · ~${receipt.estimatedMeals} meals`}
      </p>

      {(receipt.driverName ?? receipt.vehiclePlate) && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-brown/70">
          <Truck className="h-3.5 w-3.5 shrink-0 text-brand-brown/40" />
          {[receipt.driverName, receipt.vehiclePlate]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <p className="mt-1 text-[10px] text-brand-brown/60">
        Released by {receipt.authorizedByName}
        {receipt.receivedByLabel && ` · received by ${receipt.receivedByLabel}`}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border-tan/60 pt-2.5">
        <span className="min-w-0 truncate text-[10px] text-brand-brown/60">
          {receipt.legalReference ??
            (receipt.verificationCode
              ? `Verification ${receipt.verificationCode}`
              : '')}
        </span>
        <button
          onClick={() => download.mutate()}
          disabled={download.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-tan px-2.5 py-1.5 text-[11px] font-semibold text-brand-brown transition hover:bg-surface-cream disabled:opacity-60"
        >
          {download.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Certificate
        </button>
      </div>

      {download.error && (
        <p role="alert" className="mt-2 text-[11px] text-red-700">
          {download.error instanceof Error
            ? download.error.message
            : 'Could not open that certificate.'}
        </p>
      )}
    </li>
  );
}
