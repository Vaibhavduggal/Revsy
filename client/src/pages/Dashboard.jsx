import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
import { useToast } from '../components/useToast.jsx';
import { getCopy } from '../utils/categoryCopy.js';
import ReviewTrendChart from '../components/dashboard/ReviewTrendChart.jsx';

function StatusBadge({ status }) {
  const map = { Sent: 'sent', Opened: 'opened', Reviewed: 'reviewed', Scheduled: 'scheduled' };
  return <span className={`badge ${map[status] || 'sent'}`}>{status}</span>;
}

function QuickAdd({ onAdded, copy, initialOpen = false, onClose }) {
  const [open, setOpen] = useState(initialOpen);
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
      onClose?.();
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
        <Icon.plus width={16} height={16} /> {copy.addPerson}
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 0 }}>
      <form onSubmit={add} className="flex col" style={{ gap: 10 }}>
        <b style={{ fontSize: 15 }}>{copy.quickAddTitle}</b>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${copy.personTitle} name`} autoFocus />
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (+91…)" />
        <div className="flex" style={{ gap: 8 }}>
          <button type="button" className="btn secondary" onClick={() => { setOpen(false); onClose?.(); }}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add & schedule'}</button>
        </div>
      </form>
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

function Panel({ title, subtitle, badge, borderColor, children, testId }) {
  return (
    <div className="card" style={borderColor ? { borderTop: `3px solid ${borderColor}` } : undefined} data-testid={testId}>
      <div className="flex between">
        <div>
          <h3 style={borderColor ? { color: borderColor } : undefined}>{title}</h3>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
        {badge}
      </div>
      <div className="spacer" />
      {children}
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
  const [reviewList, setReviewList] = useState({ positive: [], negative: [], suggestions: [], complaints: [] });
  const [summaries, setSummaries] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
        ...rl,
        positive: (rl.positive || []).map((r) => (r.id === id ? { ...r, isRead: true } : r)),
        negative: (rl.negative || []).map((r) => (r.id === id ? { ...r, isRead: true } : r)),
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

  const copy = getCopy(business?.category);
  const { stats, recent } = data;
  const chartWeeks = (analytics?.weeks || []).map((w) => ({
    ...w,
    positive: w.positive ?? 0,
    negative: w.negative ?? 0,
    count: w.count ?? ((w.positive || 0) + (w.negative || 0)),
  }));
  const issues = summaries?.issues || [];
  const unreadPos = (reviewList.positive || []).filter((r) => r.isRead === false).length;
  const unreadNeg = (reviewList.negative || []).filter((r) => r.isRead === false).length;
  const suggestions = reviewList.suggestions || [];
  const complaints = reviewList.complaints || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{business?.name}</div>
        </div>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setQuickAddOpen((v) => !v)}>
            <Icon.plus width={16} height={16} /> {copy.addPerson}
          </button>
          <Link className="btn secondary sm" to="/customers">{copy.personPluralTitle}</Link>
          <Link className="btn secondary sm" to="/reviews">All reviews</Link>
          <Link className="btn secondary sm" to="/analytics">Analytics</Link>
          <button className="btn ghost sm" onClick={syncGoogle} disabled={syncing}>
            <Icon.star width={13} height={13} /> {syncing ? 'Syncing…' : 'Sync Google'}
          </button>
        </div>
      </div>

      {quickAddOpen && (
        <div className="card" style={{ marginBottom: 16 }}>
          <QuickAdd copy={copy} initialOpen onClose={() => setQuickAddOpen(false)} onAdded={load} />
        </div>
      )}

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

      <div style={{ marginBottom: 16 }}>
        <ReviewTrendChart weeks={chartWeeks} onRefresh={load} />
      </div>

      <div className="row even" style={{ marginBottom: 16, alignItems: 'start' }}>
        <Panel
          title="AI insights"
          subtitle="Recurring problems from negative Google reviews"
          badge={<span className="badge sent sm">{issues.length} issues</span>}
          borderColor="var(--accent)"
        >
          {issues.length === 0 ? (
            <div className="empty">No issues yet — they appear after negative reviews are analyzed.</div>
          ) : (
            <div className="flex col" style={{ gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {issues.slice(0, 5).map((iss) => (
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
        </Panel>

        <Panel title="Recent review requests" subtitle="Latest WhatsApp review asks">
          {recent.length === 0 ? (
            <div className="empty">No requests yet — add a {copy.person} to get started.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>{copy.personTitle}</th><th>Status</th><th>When</th></tr>
              </thead>
              <tbody>
                {recent.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.customerName}</b><div className="muted">{r.phone}</div></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="muted">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="row even" style={{ marginBottom: 16 }}>
        <Panel
          title="Positive reviews"
          badge={unreadPos > 0 ? <span className="badge reviewed sm">{unreadPos} unread</span> : null}
          borderColor="var(--ok)"
        >
          {(reviewList.positive || []).length === 0 ? (
            <div className="empty">No positive reviews yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {reviewList.positive.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} r={r} negative={false} onRead={markRead} />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Negative reviews"
          badge={unreadNeg > 0 ? <span className="badge opened sm">{unreadNeg} unread</span> : null}
          borderColor="var(--warn)"
        >
          {(reviewList.negative || []).length === 0 ? (
            <div className="empty">No negative feedback yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {reviewList.negative.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} r={r} negative onRead={markRead} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="row even" style={{ marginBottom: 16 }}>
        <Panel
          title={copy.suggestionsTitle}
          subtitle={copy.suggestionsSub}
          badge={<span className="badge sent sm">{suggestions.length}</span>}
          borderColor="var(--accent)"
          testId="suggestions-section"
        >
          {suggestions.length === 0 ? (
            <div className="empty">No suggestions yet — they appear when a happy {copy.person} replies with an idea.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {suggestions.slice(0, 8).map((f) => (
                <div key={f.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>{f.customerName}</b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{f.complaint || f.text}</div>
                  <div className="csv-hint">{timeAgo(f.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={copy.complaintsTitle}
          subtitle={copy.complaintsSub}
          badge={<span className="badge opened sm">{complaints.length}</span>}
          borderColor="var(--warn)"
          testId="complaints-section"
        >
          {complaints.length === 0 ? (
            <div className="empty">No private complaints yet.</div>
          ) : (
            <div className="flex col" style={{ gap: 10, maxHeight: 260, overflowY: 'auto' }}>
              {complaints.slice(0, 8).map((f) => (
                <div key={f.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <b style={{ fontSize: 13 }}>{f.customerName}</b>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{f.complaint || f.text}</div>
                  <div className="csv-hint">{timeAgo(f.createdAt)} · private</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {failed.length > 0 && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--warn)' }}>
          <h3>Failed WhatsApp sends ({failed.length})</h3>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>{copy.personTitle}</th><th>Error</th><th></th></tr>
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
