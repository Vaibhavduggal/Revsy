/** Recurring brand motif — stylized review star / bubble (Spade-style line illustration). */
export default function ReviewMotif({ size = 120, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="60" cy="60" r="36" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path
        d="M60 28 L68 48 L90 50 L74 64 L78 86 L60 74 L42 86 L46 64 L30 50 L52 48 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M60 74 V92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <ellipse cx="60" cy="98" rx="14" ry="4" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </svg>
  );
}
