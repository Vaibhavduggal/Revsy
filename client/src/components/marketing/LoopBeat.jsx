import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useInViewOnce } from '../../hooks/useInViewOnce.js';
import DrawGeoAccent from './DrawGeoAccent.jsx';

function CountUp({ value, duration = 1200 }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInViewOnce({ threshold: 0.35 });
  const [display, setDisplay] = useState(reduce ? value : 0);
  const target = Number(value);

  useEffect(() => {
    if (reduce || !inView || !Number.isFinite(target)) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration, reduce]);

  return <span ref={ref}>{display}</span>;
}

export default function LoopBeat({ id, step, title, body, substat, substatNumeric, index }) {
  const reduce = useReducedMotion();
  const { ref, inView } = useInViewOnce({ rootMargin: '0px 0px -12% 0px', threshold: 0.25 });

  const content = (
    <>
      <div className="mkt-loop-step">
        <DrawGeoAccent size={14} />
        <span>{step}</span>
      </div>
      <h3 className="mkt-loop-title">{title}</h3>
      <p className="mkt-loop-body">{body}</p>
      <p className="mkt-loop-substat">
        {substatNumeric != null ? (
          <>
            <CountUp value={substatNumeric} />
            {substat.replace(String(substatNumeric), '').trim() || ''}
          </>
        ) : (
          substat
        )}
      </p>
    </>
  );

  if (reduce) {
    return (
      <article
        id={id}
        className="mkt-loop-beat mkt-loop-beat--revealed"
        data-loop-beat={id}
        data-revealed="true"
      >
        {content}
      </article>
    );
  }

  return (
    <motion.article
      ref={ref}
      id={id}
      className={`mkt-loop-beat${inView ? ' mkt-loop-beat--revealed' : ''}`}
      data-loop-beat={id}
      data-revealed={inView ? 'true' : 'false'}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
    >
      {content}
    </motion.article>
  );
}
