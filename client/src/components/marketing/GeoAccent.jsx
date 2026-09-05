export default function GeoAccent({ shape = 'diamond', size = 16, className = '' }) {
  const s = Number(size) || 16;
  if (shape === 'circle') {
    return (
      <svg className={`geo-accent ${className}`.trim()} width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7.25" stroke="currentColor" strokeWidth="0.85" />
      </svg>
    );
  }
  return (
    <svg className={`geo-accent ${className}`.trim()} width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 1.6 16.4 9 9 16.4 1.6 9 9 1.6Z" stroke="currentColor" strokeWidth="0.85" />
    </svg>
  );
}
