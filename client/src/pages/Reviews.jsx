import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/useToast.jsx';

export default function Reviews() {
  const { show, node } = useToast();
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const r = await api.reviewsAll(p);
      setReviews(r.reviews);
      setPage(r.page);
      setPages(r.pages);
      setTotal(r.total);
    } catch (e) { show(e.message); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(1); }, [load]);

  const markRead = async (id) => {
    try {
      await api.markReviewRead(id);
      setReviews((list) => list.map((r) => (r.id === id ? { ...r, isRead: true } : r)));
    } catch (e) { show(e.message); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>All Google reviews</h1>
          <div className="sub">Newest to oldest · {total} total · <Link to="/dashboard" style={{ fontWeight: 700 }}>back to dashboard</Link></div>
        </div>
      </div>
      {loading ? <div className="empty">Loading…</div> : reviews.length === 0 ? <div className="empty">No reviews yet.</div> : (
        <>
          <div className="flex col" style={{ gap: 10 }}>
            {reviews.map((r) => (
              <div key={r.id} className="card" style={{ background: r.isRead ? '#fff' : 'var(--accent-soft)' }}>
                <div className="flex between">
                  <b style={{ fontWeight: r.isRead ? 600 : 800 }}>
                    {!r.isRead && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: (r.rating || 5) >= 4 ? 'var(--ok)' : 'var(--warn)', marginRight: 6 }} />}
                    {r.customerName || 'Anonymous'} · {(r.rating || 5)}★
                  </b>
                  <span className="csv-hint">{new Date(r.createdAt).toLocaleString()} · {r.source}</span>
                </div>
                {r.text && <div className="muted" style={{ marginTop: 6 }}>{r.text}</div>}
                <div className="flex between" style={{ marginTop: 6 }}>
                  <span>
                    {r.aiFlag === 'repeated' && <span className="badge opened sm">Repeated issue</span>}
                    {r.aiFlag === 'new_issue' && <span className="badge reviewed sm">New issue</span>}
                  </span>
                  {!r.isRead && <button className="btn ghost sm" onClick={() => markRead(r.id)}>Mark as read</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex between" style={{ marginTop: 16 }}>
            <button className="btn secondary sm" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
            <span className="muted">Page {page} of {pages}</span>
            <button className="btn secondary sm" disabled={page >= pages} onClick={() => load(page + 1)}>Next →</button>
          </div>
        </>
      )}
      {node}
    </div>
  );
}
