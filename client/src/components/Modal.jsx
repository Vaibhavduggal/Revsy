import { useEffect } from 'react';

export function Modal({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
        {title && <h2>{title}</h2>}
        {sub && <div className="sub">{sub}</div>}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
