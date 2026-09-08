/** Animated Revsy coin motif — serif R on a spinning gold coin. */
export default function RupeeCoin({ size = 180, className = '' }) {
  const uid = `rc-${size}`;
  return (
    <div
      className={`rupee-coin ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="rupee-coin-spin">
        <svg viewBox="0 0 120 120" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`${uid}-face`} x1="20" y1="8" x2="100" y2="112">
              <stop offset="0%" stopColor="#e8c97a" />
              <stop offset="45%" stopColor="#c9a227" />
              <stop offset="100%" stopColor="#8a6a14" />
            </linearGradient>
            <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f4e3b0" />
              <stop offset="100%" stopColor="#6f5610" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="56" fill={`url(#${uid}-rim)`} />
          <circle cx="60" cy="60" r="48" fill={`url(#${uid}-face)`} />
          <circle cx="60" cy="60" r="44" stroke="#f7e7b8" strokeWidth="1.25" opacity="0.7" />
          <circle cx="60" cy="60" r="38" stroke="#7a5e12" strokeWidth="0.75" opacity="0.35" />
          <text
            x="60"
            y="76"
            textAnchor="middle"
            fontSize="52"
            fontWeight="500"
            fontFamily="Fraunces, Georgia, 'Times New Roman', serif"
            fill="#3d2e08"
          >
            R
          </text>
        </svg>
      </div>
    </div>
  );
}
