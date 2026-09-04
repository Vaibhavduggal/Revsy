import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
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
      setName('');
      setPhone('');
      setOpen(false);
      onAdded();
    } catch (err) {
      show(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        <Icon.plus width={16} height={16} /> Add customer
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 0 }}>
      <form onSubmit={add} className="flex col" style={{ gap: 10 }}>
        <b style={{ fontSize: 15 }}>Quick add customer</b>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" autoFocus />
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (+91…)" />
        <div className="flex" style={{ gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add & schedule'}</button>
        </div>
      </form>
    </div>
  );
}

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
  return `${Math.floor(h / 24)}d ago`;
}

function ReviewCard({ r, negative, onRead }) {
  const unread = r.isRead === false;
  return (
    <div style={{
      borderBottom: '1px solid var(--line)',
      background: unread ? 'var(--accent-soft)' : 'transparent',
      borderRadius: 8,
      padding: unread ? 8 : '0 0 10px 0',
    }}>
      <div className="flex between">
        <b style={{ fontSize: 13, fontWeight: unread ? 800 : 600 }}>
          {unread && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: negative ? 'var(--warn)' : 'var(--ok)', marginRight: 6 }} />}
          {r.customerName}
        </b>
        <span style={{ color: negative ? 'var(--warn)' : 'var(--ok)', fontWeight: 700, fontSize: 13 }}>
          {r.rating ? '★'.repeat(r.rating) : <span className="badge opened sm">Private</span>}
        </span>
      </div>
      {r.text && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{r.text}</div>}
      <div className="flex between" style={{ marginTop: 4 }}>
        <div className="csv-hint" style={{ marginTop: 0 }}>
          {r.source === 'google' ? 'Google' : 'Internal'} · {timeAgo(r.createdAt)}
          {r.aiFlag === 'repeated' && <span className="badge opened sm" style={{ marginLeft: 6 }}>Repeated</span>}
          {r.aiFlag === 'new_issue' && <span className="badge reviewed sm" style={{ marginLeft: 6 }}>New issue</span>}
        </div>
        {unread && r.id && !String(r.id).startsWith('fb_') && (
          <button className="btn ghost sm" onClick={() => onRead(r.id)}>Mark read</button>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { business } = useAuth();
  const { show, node } = useToast();
  const [data, setData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [failed, setFailed] = useState([]);
  const [retrying, setRetrying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewList, setReviewList] = useState({ positive: [], negative: [] });
  const [summaries, setSummaries] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, an, f, rl, sm] = await Promise.all([
        api.dashboard(),
        api.analytics(),
        api.failedSends(),
        api.reviewsList(),
        api.summaries().catch(() => ({ current: null })),
      ]);
      setData(d);
      setAnalytics(an);
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
    } catch (e) { show(e.message); }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    try {
      const r = await api.syncGoogleReviews();
      if (!r.connected) show(r.message || 'Connect Google in Settings first.');
      else {
        show(`Synced — ${r.added} new review${r.added === 1 ? '' : 's'}`);
        load();
      }
    } catch (err) {
      show(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const retry = async (id) => {
    setRetrying(id);
    try {
      await api.retrySend(id);
      show('Retry queued');
      setFailed((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      show(err.message);
    } finally {
      setRetrying(null);
    }
  };

  if (loading || !data) return <div className="page"><div className="empty">Loading dashboard…</div></div>;

  const { stats, recent } = data;
  const chartWeeks = analytics?.weeks || data.weekly;
  const issues = summaries?.issues || [];
  const unreadPos = reviewList.positive.filter((r) => r.isRead === false).length;
  const unreadNeg = reviewList.negative.filter((r) => r.isRead === false).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{business?.name} · review requests, Google sync, and AI issue tracking</div>
        </div>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary sm" to="/customers">Customers</Link>
          <Link className="btn secondary sm" to="/reviews">All reviews</Link>
          <button className="btn ghost sm" onClick={syncGoogle} disabled={syncing}>
            <Icon.star width={13} height={13} /> {syncing ? 'Syncing…' : 'Sync Google'}
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat accent">
          <div className="icon"><Icon.send width={20} height={20} /></div>
          <div className="label">Requests sent</div>
          <div className="value">{stats.totalSent}</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.star width={20} height={20} /></div>
          <div className="label">Reviews received</div>
          <div className="value">{stats.totalReceived}</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.rocket width={20} height={20} /></div>
          <div className="label">Conversion</div>
          <div className="value">{stats.conversionRate}%</div>
        </div>
        <div className="stat">
          <div className="icon"><Icon.users width={20} height={20} /></div>
          <div className="label">Unread reviews</div>
          <div className="value">{unreadPos + unreadNeg}</div>
        </div>
      </div>

      <div className="row even" style={{ marginBottom: 16, alignItems: 'start' }}>
        <div className="card">
          <QuickAdd onAdded={load} />
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div className="flex between">
            <h3>AI insights</h3>
            <span className="badge sent sm">{issues.length} issues</span>
          </div>
          <div className="sub">Recurring problems from negative Google reviews</div>
          <div className="spacer" />
          {issues.length === 0 ? (
            <div className="empty">No issues yet — they appear after negative reviews are analyzed.</div>
          ) : (
            <div className="flex col" style={{ gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {issues.slice(0, 4).map((iss) => (
                <div key={iss.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, background: iss.is_read ? '#fff' : 'var(--accent-soft)' }}>
                  <div className="flex between">
                    <b style={{ fontSize: 13 }}>{iss.theme} · {iss.occurrences || 1}×</b>
                    {!iss.is_read && <button className="btn ghost sm" onClick={() => markIssueRead(iss.id)}>Read</button>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{iss.improvement}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Positive vs negative · last 12 weeks</h3>
        <div className="sub"><span style={{ color: 'var(--ok)', fontWeight: 700 }}>Green</span> = 4★+ · <span style={{ color: 'var(--warn)', fontWeight: 700 }}>Red</span> = below 4★</div>
        <div className="spacer" />
        <PnChart weeks={chartWeeks} />
      </div>

      <div className="row even" style={{ marginBottom: 16 }}>
        <div className="card" style={{ borderTop: '3px solid var(--ok)' }}>
          <div className="flex between">
            <h3 style={{ color: 'var(--ok)' }}>Positive reviews</h3>
            {unreadPos > 0 && <span className="badge reviewed sm">{unreadPos} unread</span>}
          </div>
          <div className="spacer" />
          {reviewList.positive.length === 0 ? (
            <div className="empty">No positive reviews yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {reviewList.positive.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} r={r} negative={false} onRead={markRead} />
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--warn)' }}>
          <div className="flex between">
            <h3 style={{ color: 'var(--warn)' }}>Negative reviews</h3>
            {unreadNeg > 0 && <span className="badge opened sm">{unreadNeg} unread</span>}
          </div>
          <div className="spacer" />
          {reviewList.negative.length === 0 ? (
            <div className="empty">No negative feedback yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {reviewList.negative.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} r={r} negative onRead={markRead} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Recent review requests</h3>
        <div className="sub">Latest WhatsApp review asks</div>
        <div className="spacer" />
        {recent.length === 0 ? (
          <div className="empty">No requests yet — add a customer to get started.</div>
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
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--warn)' }}>
          <h3>Failed WhatsApp sends ({failed.length})</h3>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Customer</th><th>Error</th><th></th></tr>
            </thead>
            <tbody>
              {failed.map((f) => (
                <tr key={f.id}>
                  <td><b>{f.customerName}</b><div className="muted">{f.phone}</div></td>
                  <td className="muted">{f.error}</td>
                  <td>
                    <button className="btn secondary sm" disabled={retrying === f.id} onClick={() => retry(f.id)}>
                      {retrying === f.id ? '…' : 'Retry'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {node}
    </div>
  );
}
