import { useEffect, useRef, useState } from 'react';

/** Fire once when element enters viewport (IntersectionObserver). */
export function useInViewOnce({ rootMargin = '0px 0px -8% 0px', threshold = 0.2 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin, threshold]);

  return { ref, inView };
}
