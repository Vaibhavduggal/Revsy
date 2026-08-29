export function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      className="toggle"
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className={`track ${on ? 'on' : ''}`}><span className="knob" /></span>
      {label && <span className="label">{label}</span>}
    </button>
  );
}
