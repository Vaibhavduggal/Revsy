import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../components/useToast.jsx';
import ReviewActions from '../components/ReviewActions.jsx';

export default function Reviews() {
  const { show, node } = useToast();
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [googleReportUrl, setGoogleReportUrl] = useState('');

  const load = useCallback(async (p) => {
    setLoading(true);
    try {
      const [r, rl] = await Promise.all([
        api.reviewsAll(p),
        api.reviewsList().catch(() => ({ googleReportUrl: '' })),
      ]);
      setReviews(r.reviews);
      setPage(r.page);
      setPages(r.pages);
      setTotal(r.total);
      setGoogleReportUrl(rl.googleReportUrl || '');
    } catch (e) { show(e.message); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(1); }, [load]);

  const patchReview = (id, patch) => {
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const markRead = async (id) => {
    setBusy(id);
    try {
      const r = await api.markReviewRead(id);
      patchReview(id, { isRead: true, googleReplyPostedAt: r.googleReplyPosted ? new Date().toISOString() : null });
      if (r.warning) show(r.warning);
      else show(r.googleReplyPosted ? 'Thank-you reply posted on Google' : 'Marked as read');
    } catch (e) { show(e.message); }
    finally { setBusy(null); }
  };

  const acknowledgeReview = async (id) => {
    setBusy(id);
    try {
      const r = await api.acknowledgeReview(id);
      patchReview(id, { isRead: true, googleReplyPostedAt: r.googleReplyPosted ? new Date().toISOString() : null });
      if (r.warning) show(r.warning);
      else show(r.googleReplyPosted ? 'Acknowledgement posted on Google' : 'Review acknowledged');
    } catch (e) { show(e.message); }
    finally { setBusy(null); }
  };

  const flagFake = async (id) => {
    setBusy(id);
    try {
      const r = await api.flagReviewFake(id);
      patchReview(id, { isRead: true, suspectedFake: true });
      if (r.reportUrl) setGoogleReportUrl(r.reportUrl);
      show('Flagged internally');
    } catch (e) { show(e.message); }
    finally { setBusy(null); }
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
            {reviews.map((r) => {
              const negative = (r.rating || 5) < 4;
              return (
                <div key={r.id} className="card" style={{ background: r.isRead ? '#fff' : 'var(--accent-soft)' }}>
                  <div className="flex between wrap">
                    <b style={{ fontWeight: r.isRead ? 600 : 800 }}>
                      {!r.isRead && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: negative ? 'var(--warn)' : 'var(--ok)', marginRight: 6 }} />}
                      {r.customerName || 'Anonymous'} · {(r.rating || 5)}★
                    </b>
                    <span className="csv-hint">{new Date(r.createdAt).toLocaleString()} · {r.source}</span>
                  </div>
                  {r.text && <div className="muted" style={{ marginTop: 6 }}>{r.text}</div>}
                  <div className="flex between wrap" style={{ marginTop: 8, gap: 8 }}>
                    <span>
                      {r.suspectedFake && <span className="badge warn sm">Suspected fake</span>}
                      {r.aiFlag === 'repeated' && <span className="badge opened sm">Repeated issue</span>}
                      {r.aiFlag === 'new_issue' && <span className="badge reviewed sm">New issue</span>}
                    </span>
                    <ReviewActions
                      review={r}
                      negative={negative}
                      googleReportUrl={googleReportUrl}
                      busy={busy === r.id}
                      onMarkRead={markRead}
                      onAcknowledge={acknowledgeReview}
                      onFlagFake={flagFake}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex between" style={{ marginTop: 16 }}>
            <button className="btn secondary sm touch-target" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
            <span className="muted">Page {page} of {pages}</span>
            <button className="btn secondary sm touch-target" disabled={page >= pages} onClick={() => load(page + 1)}>Next →</button>
          </div>
        </>
      )}
      {node}
    </div>
  );
}
