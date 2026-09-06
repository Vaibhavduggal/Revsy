import { motion, useReducedMotion } from 'motion/react';

export default function AnimatedHeadline({ text, className = '' }) {
  const reduce = useReducedMotion();
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);

  if (reduce) {
    return <h1 className={className}>{text}</h1>;
  }

  return (
    <h1 className={className} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="mkt-headline-word"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
        >
          {word}
          {i < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </h1>
  );
}
