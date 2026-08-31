export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../src/api.js';
import { useAuth } from '../src/auth-context.jsx';
import { useShell } from '../src/components/ShellContext.jsx';
import { Icon } from '../src/components/Icons.jsx';
import { WhatsAppConversation } from '../src/components/WhatsAppConversation.jsx';
import { useToast } from '../src/components/useToast.jsx';
import { NEXT_ACTION } from '../src/utils/pipeline.js';

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function lastPreview(stage) {
  const map = {
    to_send: 'Awaiting first outreach',
    sent: 'Message delivered',
    opened: 'Opened — awaiting reaction',
    positive: '👍 Positive — Google link sent',
    negative: '👎 Negative — private feedback link',
    reviewed: 'Left a Google review',
  };
  return map[stage] || stage;
}

export default function Messages() {
  const { business } = useAuth();
  const { sentiment } = useShell();
  const { show, node } = useToast();
  const [customers, setCustomers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([api.customers(), api.feedback()]);
      setCustomers(c.customers);
      setFeedback(f.feedback);
    } catch (e) { show(e.message); } finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const threads = useMemo(() => {
    let list = customers.filter((c) => (c.stage || 'to_send') !== 'to_send');
    if (sentiment !== 'all') list = list.filter((c) => c.sentiment === sentiment);
    return list;
  }, [customers, sentiment]);

  const select = async (id) => {
    setSelectedId(id);
    setDetail(null);
    try {
      const r = await api.customer(id);
      setDetail(r);
    } catch (e) { show(e.message); }
  };

  useEffect(() => {
    if (!selectedId && threads.length) setSelectedId(threads[0].id);
  }, [threads, selectedId]);

  const selected = customers.find((c) => c.id === selectedId);
  const stage = detail?.customer.stage || selected?.stage || 'to_send';
  const next = NEXT_ACTION[stage];

  const run = async (apiCall, msg) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await apiCall();
      show(msg);
      const r = await api.customer(selectedId);
      setDetail(r);
      await load();
    } catch (e) { show(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <div className="sub">Simulated WhatsApp conversations (no real messages sent)</div>
        </div>
      </div>

      <div className="messages-layout">
        <div className="thread-list card">
          <h3 style={{ marginTop: 0 }}>Conversations</h3>
          <div className="sub">{threads.length} active</div>
          <div className="spacer" />
          {loading ? <div className="empty">Loading…</div> : threads.length === 0 ? (
            <div className="empty">No active conversations yet. Send a request from Customers.</div>
          ) : (
            <div className="thread-items">
              {threads.map((c) => (
                <button
                  key={c.id}
                  className={`thread-item ${c.id === selectedId ? 'active' : ''}`}
                  onClick={() => select(c.id)}
                >
                  <div className="avatar sm">{initials(c.name)}</div>
                  <div className="thread-meta">
                    <div className="thread-name">
                      {c.name}
                      {c.sentiment && <span className={`sentiment-dot ${c.sentiment}`}>{c.sentiment === 'positive' ? '👍' : '👎'}</span>}
                    </div>
                    <div className="thread-preview">{lastPreview(c.stage)}</div>
                  </div>
                  <span className={`badge ${c.stage}`}>{c.stage}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="thread-view card">
          {!detail || !selected ? (
            <div className="empty">Select a conversation</div>
          ) : (
            <>
              <div className="drawer-head">
                <div className="avatar">{initials(detail.customer.name)}</div>
                <div>
                  <h3 style={{ margin: 0 }}>{detail.customer.name}</h3>
                  <div className="muted" style={{ fontSize: 13 }}>{detail.customer.phone}</div>
                </div>
                <span className={`badge ${stage}`} style={{ marginLeft: 'auto' }}>{stageLabel(stage)}</span>
              </div>

              <WhatsAppConversation
                conversation={detail.conversation}
                businessName={business?.name}
                interactive={stage === 'opened'}
                onReaction={(reaction) => run(() => api.replyCustomer(selectedId, reaction),
                  reaction === 'positive' ? '👍 Positive — Google link sent' : '👎 Negative — feedback link sent')}
              />

              <div className="drawer-actions">
                {next?.api === 'send' && <button className="btn" disabled={busy} onClick={() => run(() => api.sendNow(selectedId), 'Review request sent')}>Send request</button>}
                {next?.api === 'open' && <button className="btn" disabled={busy} onClick={() => run(() => api.openCustomer(selectedId), 'Marked as opened')}>Simulate opened</button>}
                {next?.api === 'review' && <button className="btn green" disabled={busy} onClick={() => run(() => api.reviewCustomer(selectedId), 'Marked reviewed on Google')}>Mark reviewed on Google</button>}
                {next?.api === 'feedback' && (
                  <button className="btn warn" disabled={busy} onClick={() => run(() => api.feedbackCustomer(selectedId, { complaint: detail.customer.complaint || 'Followed up privately.' }), 'Private feedback logged')}>
                    Save private feedback
                  </button>
                )}
                {stage === 'reviewed' && <div className="ok-note"><Icon.check width={15} height={15} /> Completed — review is public on Google.</div>}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}><Icon.lock width={16} height={16} /> Private feedback <span className="badge neg">{feedback.length}</span></h3>
          <span className="pill demo">Owner-only · never on Google</span>
        </div>
        <div className="sub">Negative experiences caught before they went public — reach out directly to make it right.</div>
        <div className="spacer" />
        {feedback.length === 0 ? (
          <div className="empty">No private feedback yet. 🎉</div>
        ) : (
          <table className="table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Complaint</th><th>Date</th></tr></thead>
            <tbody>
              {feedback.slice(0, 10).map((f) => (
                <tr key={f.id}>
                  <td><b>{f.customerName}</b></td>
                  <td className="muted">{f.phone}</td>
                  <td>{f.complaint}</td>
                  <td className="muted">{fmtDate(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {node}
    </div>
  );
}

function stageLabel(id) {
  const map = {
    to_send: 'To Send', sent: 'Sent', opened: 'Opened',
    positive: 'Positive', negative: 'Negative', reviewed: 'Reviewed',
  };
  return map[id] || id;
}
