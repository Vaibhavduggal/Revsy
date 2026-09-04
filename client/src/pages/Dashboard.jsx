import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { useToast } from '../components/useToast.jsx';

function StatusBadge({ status }) {
  const map = { Sent: 'sent', Opened: 'opened', Reviewed: 'reviewed', Scheduled: 'scheduled' };
  return <span className={`badge ${map[status] || 'sent'}`}>{status}</span>;
}

function QuickAdd({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    try {
      await api.addCustomer(name.trim(), phone.trim());
      show(`Added ${name.trim()} — review request scheduled (uses your Settings delay)`);
      setName(''); setPhone('');
      setOpen(false);
      onAdded();
    } catch (err) {
      show(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <Icon.plus width={16} height={16} /> Add customer
      </button>
      {open && (
        <Modal title="Add customer" sub="Name + phone. A WhatsApp review request is scheduled via the queue using your Settings delay." onClose={() => setOpen(false)}>
          <form onSubmit={add}>
            <div className="field">
              <label>Customer name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add & schedule'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// Grouped positive vs negative over time (green/red)
function PnChart({ weeks }) {
  const data = (weeks || []).slice(-12);
  const max = Math.max(1, ...data.map((w) => Math.max(w.positive || 0, w.negative || 0, w.count || 0)));
  return (
    <div className="chart" style={{ height: 190 }}>
      {data.map((w, i) => (
        <div className="bar-col" key={i} title={`${w.label}: ${w.positive || 0} positive, ${w.negative || 0} negative`}>
          <span className="val">{(w.positive || 0) + (w.negative || 0)}</span>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
            <div className="bar" style={{ height: `${((w.positive || 0) / max) * 100}%`, background: 'var(--ok)', minWidth: 14 }} />
            <div className="bar" style={{ height: `${((w.negative || 0) / max) * 100}%`, background: 'var(--warn)', minWidth: 14 }} />
          </div>
          <span className="lbl">{w.label}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ReviewCard({ r, negative, onRead }) {
  const unread = r.isRead === false;
  return (
    <div style={{
      borderBottom: '1px solid var(--line)', paddingBottom: 10,
      background: unread ? 'var(--accent-soft)' : 'transparent',
      borderRadius: 8, padding: unread ? 8 : '0 0 10px 0',
    }}>
      <div className="flex between">
        <b style={{ fontSize: 13, fontWeight: unread ? 800 : 600 }}>
          {unread && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: negative ? 'var(--warn)' : 'var(--ok)', marginRight: 6 }} />}
          {r.customerName}
        </b>
        <span style={{ color: negative ? 'var(--warn)' : 'var(--ok)', fontWeight: 700, fontSize: 13 }}>
          {r.rating ? '★'.repeat(r.rating) : <span className="badge opened sm">Private feedback</span>}
        </span>
      </div>
      {r.text && <div className="muted" style={{ fontSize: 13, marginTop: 4, fontWeight: unread ? 600 : 400 }}>{r.text}</div>}
      <div className="flex between" style={{ marginTop: 4 }}>
        <div className="csv-hint" style={{ marginTop: 0 }}>
          {r.source === 'google' ? 'Google' : 'Internal'} · {timeAgo(r.createdAt)}
          {r.aiFlag === 'repeated' && <span className="badge opened sm" style={{ marginLeft: 6 }}>Repeated issue</span>}
          {r.aiFlag === 'new_issue' && <span className="badge reviewed sm" style={{ marginLeft: 6 }}>New issue</span>}
        </div>
        {unread && r.id && !String(r.id).startsWith('fb_') && (
          <button className="btn ghost sm" onClick={() => onRead(r.id)}>Mark as read</button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { business, setBusiness } = useAuth();
  const { show, node } = useToast();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [failed, setFailed] = useState([]);
  const [retrying, setRetrying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [reviewList, setReviewList] = useState({ positive: [], negative: [] });
  const [summaries, setSummaries] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, an, f, rl, sm] = await Promise.all([
        api.dashboard(), api.analytics(), api.failedSends(), api.reviewsList(), api.summaries().catch(() => ({ current: null })),
      ]);
      setData(d);
      setAnalytics(an);
      setSentiment(an.sentiment);
      setFailed(f.failed || []);
      setReviewList(rl);
      setSummaries(sm.current || null);
    } catch (e) {
      show(e.message);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await api.markReviewRead(id);
      setReviewList((rl) => ({
        positive: rl.positive.map((r) => (r.id === id ? { ...r, isRead: true } : r)),
        negative: rl.negative.map((r) => (r.id === id ? { ...r, isRead: true } : r)),
      }));
    } catch (e) { show(e.message); }
  };

  const markIssueRead = async (issueId) => {
    try {
      await api.markIssueRead(issueId);
      setSummaries((s) => (s ? { ...s, issues: (s.issues || []).map((i) => (i.id === issueId ? { ...i, is_read: true } : i)) } : s));
      show('Marked as read');
    } catch (e) { show(e.message); }
  };

  const inc = async () => {
    const r = await api.incrementReviews();
    setData((d) => ({ ...d, stats: { ...d.stats, totalReceived: r.reviewsReceived, conversionRate: d.stats.totalSent ? Math.round((r.reviewsReceived / d.stats.totalSent) * 1000) / 10 : 0 } }));
    setBusiness((b) => ({ ...b, reviewsReceived: r.reviewsReceived }));
  };
  const dec = async () => {
    const r = await api.decrementReviews();
    setData((d) => ({ ...d, stats: { ...d.stats, totalReceived: r.reviewsReceived, conversionRate: d.stats.totalSent ? Math.round((r.reviewsReceived / d.stats.totalSent) * 1000) / 10 : 0 } }));
    setBusiness((b) => ({ ...b, reviewsReceived: r.reviewsReceived }));
  };
  const retry = async (id) => {
    setRetrying(id);
    try {
      await api.retrySend(id);
      show('Retry sent');
      setFailed((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      show(err.message);
    } finally {
      setRetrying(null);
    }
  };
  const syncGoogle = async () => {
    setSyncing(true);
    try {
      const r = await api.syncGoogleReviews();
      if (!r.connected) {
        show(r.message || 'Google Reviews is not connected yet.');
      } else {
        show(`Synced — ${r.added} new review${r.added === 1 ? '' : 's'} pulled from Google`);
        load();
      }
    } catch (err) {
      show(err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !data) return <div className="page"><div className="empty">Loading dashboard…</div></div>;

  const { stats, weekly, recent } = data;
  const chartWeeks = analytics?.weeks || weekly;
  const issues = summaries?.issues || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Welcome back, {business?.name}. Here's how your review engine is performing.</div>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <Link className="btn secondary" to="/reviews">All reviews</Link>
          <QuickAdd onAdded={load} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Positive vs negative over time</h3>
        <div className="sub">Last 12 weeks · <span style={{ color: 'var(--ok)', fontWeight: 700 }}>green = positive (4★+)</span> · <span style={{ color: 'var(--warn)', fontWeight: 700 }}>red = negative (&lt;4★)</span></div>
        <div className="spacer" />
        <PnChart weeks={chartWeeks} />
      </div>

      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
        <div className="flex between">
          <div>
            <h3>AI Insights</h3>
            <div className="sub">Distinct recurring issues tracked over time (Groq Llama 3.3 70B). Repeated reports increment the count — no fresh alert.</div>
          </div>
          <span className="badge sent sm">{issues.length} issues</span>
        </div>
        <div className="spacer" />
        {issues.length === 0 ? (
          <div className="empty">No issues identified yet. They appear after approval once negative reviews are analyzed.</div>
        ) : (
          <div className="flex col" style={{ gap: 10 }}>
            {issues.map((iss) => (
              <div key={iss.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: iss.is_read ? '#fff' : 'var(--accent-soft)' }}>
                <div className="flex between">
                  <b style={{ fontWeight: iss.is_read ? 600 : 800 }}>
                    {!iss.is_read && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', marginRight: 6 }} />}
                    {iss.theme} — reported {iss.occurrences || 1} time{(iss.occurrences || 1) === 1 ? '' : 's'}
                  </b>
                  {!iss.is_read && <button className="btn ghost sm" onClick={() => markIssueRead(iss.id)}>Mark as read</button>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Fix: {iss.improvement}</div>
                <div className="csv-hint">First seen {new Date(iss.first_seen).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat accent">
          <div className="icon"><Icon.send width={20} height={20} /></div>
          <div className="label">Review requests sent</div>
          <div className="value">{stats.totalSent}</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.star width={20} height={20} /></div>
          <div className="label">Reviews received</div>
          <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {stats.totalReceived}
            <span className="flex" style={{ gap: 2 }}>
              <button className="btn secondary sm" onClick={dec} style={{ padding: '2px 8px' }}>−</button>
              <button className="btn green sm" onClick={inc} style={{ padding: '2px 8px' }}>+</button>
            </span>
          </div>
          <button className="btn ghost sm" style={{ marginTop: 8, padding: '4px 8px' }} onClick={() => setLogOpen(true)}>
            <Icon.plus width={13} height={13} /> Log a review
          </button>
        </div>
        <div className="stat">
          <div className="icon"><Icon.rocket width={20} height={20} /></div>
          <div className="label">Conversion rate</div>
          <div className="value">{stats.conversionRate}%</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.users width={20} height={20} /></div>
          <div className="label">Avg / week</div>
          <div className="value">{Math.round(stats.totalSent / 8)}</div>
        </div>
      </div>

      <div className="row even" style={{ marginTop: 16 }}>
        <div className="card" style={{ borderTop: '3px solid var(--ok)' }}>
          <div className="flex between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ color: 'var(--ok)' }}>Recent positive reviews</h3>
              <div className="sub">4★ and above · {reviewList.positive.length} total · <Link to="/reviews" style={{ color: 'var(--ok)', fontWeight: 700 }}>view all</Link></div>
            </div>
            <button className="btn ghost sm" onClick={syncGoogle} disabled={syncing}>
              <Icon.star width={13} height={13} /> {syncing ? 'Syncing…' : 'Sync Google Reviews'}
            </button>
          </div>
          <div className="spacer" />
          {reviewList.positive.length === 0 ? (
            <div className="empty">No positive reviews yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {reviewList.positive.slice(0, 8).map((r) => (
                <ReviewCard key={r.id} r={r} negative={false} onRead={markRead} />
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--warn)' }}>
          <h3 style={{ color: 'var(--warn)' }}>Recent negative reviews</h3>
          <div className="sub">Below 4★ · kept private · {reviewList.negative.length} total · <Link to="/reviews" style={{ color: 'var(--warn)', fontWeight: 700 }}>view all</Link></div>
          <div className="spacer" />
          {reviewList.negative.length === 0 ? (
            <div className="empty">No negative feedback yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {reviewList.negative.slice(0, 8).map((r) => (
                <ReviewCard key={r.id} r={r} negative onRead={markRead} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mb" style={{ marginTop: 16 }}>
        <h3>Most recent review requests</h3>
        <div className="sub">Latest 10</div>
        <div className="spacer" />
        {recent.length === 0 ? (
          <div className="empty">No requests yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Status</th><th>When</th></tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.customerName}</b></td>
                  <td className="muted">{r.phone}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="muted">{timeAgo(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {failed.length > 0 && (
        <div className="card mb" style={{ marginTop: 16, borderColor: 'var(--warn)' }}>
          <h3><span className="dot neg" /> Failed sends ({failed.length})</h3>
          <div className="spacer" />
          <table className="table">
            <thead>
              <tr><th>Customer</th><th>Phone</th><th>Error</th><th>Tries</th><th></th></tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.customerName}</b></td>
                  <td className="muted">{f.phone}</td>
                  <td className="muted">{f.error}</td>
                  <td>{f.retryCount}</td>
                  <td>
                    <button className="btn secondary sm" disabled={retrying === f.id} onClick={() => retry(f.id)}>
                      {retrying === f.id ? 'Retrying…' : 'Retry'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {logOpen && (
        <Modal title="Log a review" sub="Manually add a review (e.g. from Google before the API is connected)." onClose={() => setLogOpen(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const name = e.target.customerName.value.trim();
            const rating = Number(e.target.rating.value) || 5;
            try {
              await api.addReview({ customerName: name || null, rating });
              show('Review logged');
              setLogOpen(false);
              load();
            } catch (err) { show(err.message); }
          }}>
            <div className="field">
              <label>Customer name (optional)</label>
              <input className="input" name="customerName" placeholder="Leave blank for anonymous" />
            </div>
            <div className="field">
              <label>Star rating</label>
              <select className="select" name="rating" defaultValue="5">
                <option value="5">5 ★</option>
                <option value="4">4 ★</option>
                <option value="3">3 ★</option>
                <option value="2">2 ★</option>
                <option value="1">1 ★</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setLogOpen(false)}>Cancel</button>
              <button type="submit" className="btn">Log review</button>
            </div>
          </form>
        </Modal>
      )}
      {node}
    </div>
  );
}
