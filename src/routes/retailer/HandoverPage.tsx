import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  confirmHandover,
  verifyPass,
  type PassVerdictVM,
} from '@/features/donations/_logic';
import { openReceiptPdf, pickupsQueryKey } from '@/features/receipts/_logic';

/** Whether this browser can read a QR code from the camera. */
function hasBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Completing a handover: check the driver's pass, then release the crates.
 *
 * Typing the six-digit PIN is the primary path, not the fallback. A phone screen in a
 * loading bay is often unreadable, the driver can read the PIN aloud, and the API
 * accepts either — so the keypad always works and the camera is an accelerant.
 *
 * Checking is deliberately separate from confirming. The check consumes nothing, so
 * the shop can see who is asking and what they are owed before releasing anything.
 */
export function HandoverPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [verdict, setVerdict] = useState<PassVerdictVM | null>(null);
  const [receivedBy, setReceivedBy] = useState('');
  const [done, setDone] = useState<{
    receiptId: string;
    receiptNumber: string;
  } | null>(null);

  const check = useMutation({
    mutationFn: () => verifyPass(code),
    onSuccess: (result) => {
      setVerdict(result);

      if (result.contactPerson) {
        setReceivedBy(result.contactPerson);
      }
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!verdict?.donationId) {
        throw new Error('Check a pass first.');
      }

      return await confirmHandover(
        verdict.donationId,
        code,
        receivedBy.trim() || undefined,
      );
    },
    onSuccess: async (result) => {
      setDone(result);
      await queryClient.invalidateQueries({ queryKey: ['donations'] });
      await queryClient.invalidateQueries({ queryKey: ['retailer'] });
      await queryClient.invalidateQueries({ queryKey: pickupsQueryKey });
    },
  });

  const reset = () => {
    setCode('');
    setVerdict(null);
    setReceivedBy('');
    setDone(null);
    check.reset();
    confirm.reset();
  };

  if (done) {
    return (
      <section className="p-4">
        <div className="rounded-3xl border border-border-tan bg-white p-8 text-center">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-urgency-standard/15 text-urgency-standard">
            <Check className="h-8 w-8" />
          </span>
          <h1 className="text-base font-semibold text-brand-ink">
            Handed over
          </h1>
          <p className="mt-1 text-xs text-brand-brown/70">
            Certificate{' '}
            <span className="font-mono font-semibold">
              {done.receiptNumber}
            </span>{' '}
            has been issued to both sides.
          </p>
          <button
            onClick={() =>
              void openReceiptPdf(done.receiptId, done.receiptNumber)
            }
            className="mt-4 w-full rounded-xl bg-brand-amber px-4 py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-brand-amber-hover"
          >
            Open the certificate
          </button>
          <button
            onClick={reset}
            className="mt-2 w-full rounded-xl border border-border-tan px-4 py-2.5 text-xs font-semibold text-brand-brown transition hover:bg-surface-cream"
          >
            Hand over another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4">
      <Link
        to="/retailer/donations"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-brand-brown/70"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to donations
      </Link>

      <h1 className="text-lg font-semibold text-brand-brown">Hand over</h1>
      <p className="mt-0.5 text-xs text-brand-brown/70">
        Ask the driver for their PIN, or scan the code on their phone.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          check.mutate();
        }}
        className="mt-4"
      >
        <label className="block text-xs font-medium text-brand-brown/80">
          PIN or code
          <input
            autoFocus
            required
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setVerdict(null);
            }}
            placeholder="075528"
            inputMode="text"
            autoCapitalize="characters"
            className="mt-1 w-full rounded-xl border border-border-tan px-3 py-3 text-center font-mono text-xl tracking-[0.2em] text-brand-ink outline-none focus:border-brand-amber"
          />
        </label>

        <div className="mt-3 flex gap-2">
          <ScanButton
            onScanned={(scanned) => {
              setCode(scanned);
              setVerdict(null);
            }}
          />
          <button
            type="submit"
            disabled={check.isPending || code.trim() === ''}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-2.5 text-sm font-semibold text-brand-brown transition hover:bg-brand-amber-hover disabled:opacity-60"
          >
            {check.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Check it
          </button>
        </div>
      </form>

      {check.error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {check.error instanceof Error
            ? check.error.message
            : 'Could not check that code.'}
        </p>
      )}

      {verdict && !verdict.valid && (
        <div className="mt-4 rounded-2xl border border-urgency-critical/40 bg-urgency-critical/10 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-urgency-critical">
            <X className="h-4 w-4" /> Not a valid pass
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-brand-brown/80">
            {verdict.message ??
              'That code does not match anything waiting for collection.'}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-brand-brown/70">
            Do not release the crates. Ask the driver to reopen their pass — it
            may have expired, or already been used.
          </p>
        </div>
      )}

      {verdict?.valid && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-urgency-standard/40 bg-urgency-standard/10 p-3.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-urgency-standard">
              <Check className="h-4 w-4" /> Valid pass
            </p>

            <div className="mt-2.5 flex items-center gap-3 border-t border-border-tan/60 pt-2.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-tan bg-white text-brand-brown/70">
                <Truck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-xs font-semibold text-brand-ink">
                  {verdict.recipientName}
                  {verdict.recipientIsVerified && (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
                  )}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-brand-brown/70">
                  {[verdict.contactPerson, verdict.vehiclePlate]
                    .filter(Boolean)
                    .join(' · ') || 'Driver not named'}
                </p>
              </div>
            </div>

            <p className="mt-2.5 border-t border-border-tan/60 pt-2.5 text-[11px] font-medium text-brand-brown/80">
              {verdict.lineCount} {verdict.lineCount === 1 ? 'lot' : 'lots'} ·{' '}
              {verdict.totalWeightKg} kg
              {verdict.estimatedMeals !== null &&
                verdict.estimatedMeals > 0 &&
                ` · ~${verdict.estimatedMeals} meals`}
            </p>
          </div>

          <label className="block text-xs font-medium text-brand-brown/80">
            Who is signing for it
            <input
              value={receivedBy}
              onChange={(event) => setReceivedBy(event.target.value)}
              placeholder="Name as it should read on the certificate"
              className="mt-1 w-full rounded-xl border border-border-tan px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-amber"
            />
          </label>

          {confirm.error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {confirm.error instanceof Error
                ? confirm.error.message
                : 'Could not complete the handover.'}
            </p>
          )}

          <button
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-brown disabled:opacity-60"
          >
            {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Release the crates
          </button>
          <p className="text-center text-[11px] leading-relaxed text-brand-brown/60">
            This uses up the pass and issues the certificate. Do it as the
            crates leave, not before.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Reads a QR code from the camera, where the browser can.
 *
 * Uses the platform's own `BarcodeDetector` rather than shipping a decoder: it is
 * present in Chrome on Android, which is what a shop floor actually holds, and where
 * it is absent the PIN keypad above already covers the job.
 */
function ScanButton({ onScanned }: { onScanned: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());

          return;
        }

        stream.current = media;

        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }

        const Detector = (
          window as unknown as {
            BarcodeDetector: new (options?: { formats?: string[] }) => {
              detect: (
                source: HTMLVideoElement,
              ) => Promise<{ rawValue: string }[]>;
            };
          }
        ).BarcodeDetector;
        const detector = new Detector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !video.current) {
            return;
          }

          try {
            const found = await detector.detect(video.current);

            if (found[0]?.rawValue) {
              onScanned(found[0].rawValue);
              setOpen(false);

              return;
            }
          } catch {
            // A frame that cannot be decoded is the normal case between reads.
          }

          timer = window.setTimeout(() => void tick(), 250);
        };

        void tick();
      } catch {
        setProblem(
          'Could not open the camera. Type the PIN the driver reads out instead.',
        );
      }
    };

    void start();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }

      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [open, onScanned]);

  if (!hasBarcodeDetector()) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setProblem(null);
          setOpen(true);
        }}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border-tan px-3 py-2.5 text-sm font-semibold text-brand-brown transition hover:bg-surface-cream"
      >
        <Camera className="h-4 w-4" />
        Scan
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-brand-ink/95 p-6">
          <video
            ref={video}
            playsInline
            muted
            className="max-h-[60vh] w-full rounded-2xl object-cover"
          />
          <p className="text-xs text-white/80">
            {problem ?? "Point it at the code on the driver's phone."}
          </p>
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-brand-ink"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
