import { useState, useEffect, useCallback } from 'react';
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
      show(`Added ${name.trim()} — review request scheduled`);
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
        <Icon.plus width={16} height={16} /> Quick Add Customer
      </button>
      {open && (
        <Modal title="Quick add customer" sub="Name + phone only. A review request is scheduled automatically." onClose={() => setOpen(false)}>
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

function SentimentDonut({ s }) {
  const pos = s?.positives || 0;
  const neg = s?.negatives || 0;
  const total = pos + neg || 1;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const posLen = (pos / total) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--warn)" strokeWidth="16" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke="var(--ok)" strokeWidth="16"
        strokeDasharray={`${posLen} ${circ - posLen}`} strokeDashoffset="0"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="47" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--ink)">{pos + neg}</text>
      <text x="50" y="62" textAnchor="middle" fontSize="9" fill="var(--muted)">reactions</text>
    </svg>
  );
}
function BarChart({ weekly }) {
  const max = Math.max(1, ...weekly.map((w) => w.count));
  return (
    <div className="chart">
      {weekly.map((w, i) => (
        <div className="bar-col" key={i}>
          <span className="val">{w.count}</span>
          <div className="bar" style={{ height: `${(w.count / max) * 100}%` }} title={`${w.count} requests`} />
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

export default function Dashboard() {
  const { business, setBusiness } = useAuth();
  const { show, node } = useToast();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [failed, setFailed] = useState([]);
  const [retrying, setRetrying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [reviewList, setReviewList] = useState({ positive: [], negative: [] });
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, a, an, f, rl] = await Promise.all([
        api.dashboard(), api.activity(), api.analytics(), api.failedSends(), api.reviewsList(),
      ]);
      setData(d);
      setActivity(a.activities);
      setSentiment(an.sentiment);
      setFailed(f.failed || []);
      setReviewList(rl);
    } catch (e) {
      show(e.message);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Welcome back, {business?.name}. Here's how your review engine is performing.</div>
        </div>
        <QuickAdd onAdded={load} />
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

      <div className="row two" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="flex between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h3><span className="dot pos" /> Positive reviews</h3>
              <div className="sub">4★ and above · {reviewList.positive.length} total</div>
            </div>
            <button className="btn ghost sm" onClick={syncGoogle} disabled={syncing}>
              <Icon.star width={13} height={13} /> {syncing ? 'Syncing…' : 'Sync Google Reviews'}
            </button>
          </div>
          <div className="spacer" />
          {reviewList.positive.length === 0 ? (
            <div className="empty">No positive reviews yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {reviewList.positive.slice(0, 8).map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                  <div className="flex between">
                    <b style={{ fontSize: 13 }}>{r.customerName}</b>
                    <span style={{ color: 'var(--ok)', fontWeight: 700, fontSize: 13 }}>{'★'.repeat(r.rating || 5)}</span>
                  </div>
                  {r.text && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.text}</div>}
                  <div className="csv-hint" style={{ marginTop: 4 }}>{r.source === 'google' ? 'Google' : 'Internal'} · {timeAgo(r.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3><span className="dot neg" /> Negative reviews</h3>
          <div className="sub">Below 4★ · kept private, not sent to Google · {reviewList.negative.length} total</div>
          <div className="spacer" />
          {reviewList.negative.length === 0 ? (
            <div className="empty">No negative feedback yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 280, overflowY: 'auto' }}>
              {reviewList.negative.slice(0, 8).map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                  <div className="flex between">
                    <b style={{ fontSize: 13 }}>{r.customerName}</b>
                    {r.rating ? <span style={{ color: 'var(--warn)', fontWeight: 700, fontSize: 13 }}>{'★'.repeat(r.rating)}</span> : <span className="badge opened sm">Private feedback</span>}
                  </div>
                  {r.text && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.text}</div>}
                  <div className="csv-hint" style={{ marginTop: 4 }}>{r.source === 'google' ? 'Google' : 'Internal'} · {timeAgo(r.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="row two" style={{ marginTop: 16 }}>
        <div className="card sentiment-snap">
          <h3>Sentiment split</h3>
          <div className="sub">How customers reacted to the 👍 / 👎 prompt</div>
          <div className="flex" style={{ gap: 20, alignItems: 'center', marginTop: 12 }}>
            <SentimentDonut s={sentiment} />
            <div className="flex col" style={{ gap: 10 }}>
              <div className="flex between" style={{ width: 180 }}><span><span className="dot pos" /> Positive</span><b>{sentiment?.positives ?? 0}</b></div>
              <div className="flex between" style={{ width: 180 }}><span><span className="dot neg" /> Negative</span><b>{sentiment?.negatives ?? 0}</b></div>
              <div className="flex between" style={{ width: 180 }}><span className="muted">Positive rate</span><b style={{ color: 'var(--ok)' }}>{sentiment?.positiveRate ?? 0}%</b></div>
              <div className="flex between" style={{ width: 180 }}><span className="muted">Kept off Google</span><b style={{ color: 'var(--warn)' }}>{sentiment?.keptOffGoogleThisMonth ?? 0}</b></div>
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Reviews per week</h3>
          <div className="sub">Last 8 weeks</div>
          <div className="spacer" />
          <BarChart weekly={weekly} />
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
                  <td>{r.hasCustomMessage ? <span className="badge reviewed">Custom</span> : <span className="badge sent">Default</span>}</td>
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
          <div className="sub">These messages couldn't be delivered after 3 retries. Retry manually below.</div>
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
