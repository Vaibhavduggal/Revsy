import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useInViewOnce } from '../../hooks/useInViewOnce.js';

export default function DrawGeoAccent({ shape = 'diamond', size = 16, className = '' }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInViewOnce({ rootMargin: '0px 0px -5% 0px', threshold: 0.5 });
  const pathRef = useRef(null);
  const [length, setLength] = useState(0);
  const [drawn, setDrawn] = useState(reduce);

  useEffect(() => {
    if (reduce || !pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    setLength(len);
  }, [reduce, shape]);

  useEffect(() => {
    if (reduce || !inView || !length) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [inView, length, reduce]);

  const s = Number(size) || 16;
  const strokeProps = {
    stroke: 'currentColor',
    strokeWidth: 0.85,
    fill: 'none',
    strokeDasharray: length || 1,
    strokeDashoffset: drawn ? 0 : length || 1,
    style: reduce ? undefined : { transition: 'stroke-dashoffset 1.1s ease-out' },
  };

  return (
    <span ref={ref} className={`geo-accent-wrap ${className}`.trim()} data-geo-drawn={drawn ? 'true' : 'false'}>
      {shape === 'circle' ? (
        <svg className="geo-accent" width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle ref={pathRef} cx="9" cy="9" r="7.25" {...strokeProps} />
        </svg>
      ) : (
        <svg className="geo-accent" width={s} height={s} viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path ref={pathRef} d="M9 1.6 16.4 9 9 16.4 1.6 9 9 1.6Z" {...strokeProps} />
        </svg>
      )}
    </span>
  );
}
