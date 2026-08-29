import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = useCallback((msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const node = toast ? <div className="toast">{toast}</div> : null;
  return { show, node };
}
