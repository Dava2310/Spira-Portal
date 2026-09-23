const SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
} as const;

/**
 * The Spira wordmark.
 *
 * One copy. Both prototypes shipped their own `SpiraLogo.tsx` with different
 * colours — the retailer's in orange, the NGO's in amber — which is how a brand
 * splits in two. This uses the token so there is a single source of truth.
 */
export function SpiraLogo({
  size = 'md',
  className = '',
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center font-semibold tracking-tight text-brand-brown ${SIZES[size]} ${className}`}
    >
      Spir
      <span className="relative inline-block">
        a
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 text-brand-amber"
        >
          <path
            d="M12 3a9 9 0 1 0 9 9 6 6 0 1 1-6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}
