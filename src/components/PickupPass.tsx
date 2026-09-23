import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Maximize2 } from 'lucide-react';
import { useState } from 'react';

import type { PickupPassVM } from '@/features/reservations/_logic';

/**
 * The pass presented at the counter to release a collection.
 *
 * The QR is a real encoding of the token, not a decorative pattern: the shop
 * scans it, and the prototype's hashed look-alike would never have read. The PIN
 * is shown beside it because the API accepts either, and a phone screen in a
 * loading bay is not always scannable.
 */
export function PickupPass({ pass }: { pass: PickupPassVM }) {
  const [copied, setCopied] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pass.pin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the PIN is on screen to read out anyway.
    }
  };

  if (pass.consumedAt) {
    return (
      <div className="rounded-2xl border border-border-tan bg-surface-cream p-4 text-center">
        <p className="text-xs font-semibold text-brand-brown">
          Collected on{' '}
          {pass.consumedAt.toLocaleString(undefined, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <p className="mt-0.5 text-[11px] text-brand-brown/70">
          This pass has been used and cannot be presented again.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border-tan bg-white p-4">
        <div className="flex flex-col items-center">
          <button
            onClick={() => setEnlarged(true)}
            aria-label="Enlarge the pickup code"
            className="relative rounded-2xl border-2 border-border-tan bg-white p-3"
          >
            <QRCodeSVG
              value={pass.code}
              size={168}
              level="M"
              bgColor="#ffffff"
              fgColor="#372506"
            />
            <span className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-brand-brown/70">
              <Maximize2 className="h-3 w-3" /> Enlarge
            </span>
          </button>

          <p className="mt-3 font-mono text-[11px] font-semibold tracking-wide text-brand-ink">
            {pass.code}
          </p>

          <div className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-border-tan bg-surface-cream px-3 py-2.5">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-brown/60">
                Or read out this PIN
              </p>
              <p className="font-mono text-xl font-bold tracking-[0.2em] text-brand-ink">
                {pass.pin}
              </p>
            </div>
            <button
              onClick={() => void copyPin()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-tan bg-white px-2.5 py-1.5 text-[11px] font-semibold text-brand-brown transition hover:bg-surface-cream"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </>
              )}
            </button>
          </div>

          {!pass.isUsable && (
            <p
              role="alert"
              className="mt-3 w-full rounded-xl bg-red-50 px-3 py-2 text-center text-[11px] text-red-700"
            >
              This pass has expired. Ask the store to issue a new one.
            </p>
          )}

          <p className="mt-2 text-[10px] text-brand-brown/60">
            Valid until{' '}
            {pass.expiresAt.toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {enlarged && (
        <button
          onClick={() => setEnlarged(false)}
          aria-label="Close the enlarged code"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-brand-ink/95 p-6"
        >
          <QRCodeSVG
            value={pass.code}
            size={280}
            level="M"
            bgColor="#ffffff"
            fgColor="#120c02"
            // A quiet zone matters at this size: scanners need the white margin.
            marginSize={2}
          />
          <p className="font-mono text-3xl font-bold tracking-[0.2em] text-white">
            {pass.pin}
          </p>
          <p className="text-xs text-white/70">Tap anywhere to close</p>
        </button>
      )}
    </>
  );
}
