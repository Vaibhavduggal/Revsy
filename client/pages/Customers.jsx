import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { useShell } from '../components/ShellContext.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { PhoneMockup } from '../components/PhoneMockup.jsx';
import { WhatsAppConversation } from '../components/WhatsAppConversation.jsx';
import { useToast } from '../components/useToast.jsx';
import { MESSAGE_PRESETS, renderTemplate, TEMPLATE_VARS } from '../utils/presets.js';
import { STAGES, NEXT_ACTION } from '../utils/pipeline.js';

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CustomizeModal({ customer, business, onClose, onSaved }) {
  const { show, node } = useToast();
  const [text, setText] = useState(customer.customMessage || '');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  const render = useCallback((val) => {
    const tpl = val && val.trim() ? val : business.messageTemplate;
    setPreview(renderTemplate(tpl, {
      customerName: customer.name,
      businessName: business.name,
      reviewLink: business.googleReviewLink,
    }));
  }, [customer.name, business.name, business.messageTemplate, business.googleReviewLink]);

  useEffect(() => { render(text); }, [render, text]);

  const save = async () => {
    setBusy(true);
    try {
      await api.updateCustomer(customer.id, { customMessage: text });
      show(text.trim() ? `Custom message saved for ${customer.name}` : `Reset ${customer.name} to default template`);
      onSaved();
      onClose();
    } catch (e) { show(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal
      title={`Customize message — ${customer.name}`}
      sub="Override the global template for this customer only. Same placeholders apply."
      onClose={onClose}
    >
      <div className="flex wrap" style={{ gap: 8, marginBottom: 12 }}>
        {MESSAGE_PRESETS.map((p) => (
          <button key={p.id} type="button" className="btn secondary sm" onClick={() => setText(p.template)}>
            {p.label}
          </button>
        ))}
        <button type="button" className="btn ghost sm" onClick={() => setText('')}>Clear → default</button>
      </div>
      <div className="field">
        <label>Custom message {text.trim() ? <span className="badge reviewed">Custom</span> : <span className="badge sent">Default</span>}</label>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={business.messageTemplate} />
        <span className="csv-hint">Variables: {TEMPLATE_VARS}</span>
      </div>
      <div className="flex" style={{ gap: 16, alignItems: 'flex-start', marginTop: 8 }}>
        <PhoneMockup name={customer.name} message={preview} businessName={business.name} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save message'}</button>
      </div>
      {node}
    </Modal>
  );
}

function CustomerDrawer({ customer, business, onClose, onChanged }) {
  const { show, node } = useToast();
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const stage = detail?.customer.stage || customer.stage;

  const load = useCallback(async () => {
    const r = await api.customer(customer.id);
    setDetail(r);
    setFeedbackText(r.customer.complaint || '');
  }, [customer.id]);

  useEffect(() => { load(); }, [load]);

  const run = async (apiCall, msg) => {
    setBusy(true);
    try {
      await apiCall();
      show(msg);
      await load();
      onChanged();
    } catch (e) { show(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <button className="x-btn" onClick={onClose} aria-label="Close">×</button>
        {!detail ? <div className="empty">Loading…</div> : (
          <>
            <div className="drawer-head">
              <div className="avatar lg">{initials(detail.customer.name)}</div>
              <div>
                <h2 style={{ margin: 0 }}>{detail.customer.name}</h2>
                <div className="muted" style={{ fontSize: 13 }}>{detail.customer.phone}</div>
              </div>
              <span className={`badge ${stage}`} style={{ marginLeft: 'auto' }}>{stageLabel(stage)}</span>
            </div>

            <div className="drawer-section">
              <div className="flex between" style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Simulated conversation</h3>
                <span className="pill demo"><Icon.play width={12} height={12} /> demo mode</span>
              </div>
              <WhatsAppConversation
                conversation={detail.conversation}
                businessName={business?.name}
                interactive={stage === 'opened'}
                onReaction={(reaction) => run(() => api.replyCustomer(customer.id, reaction),
                  reaction === 'positive' ? `${detail.customer.name} replied 👍 — positive follow-up sent` : `${detail.customer.name} replied 👎 — private feedback link sent`)}
              />
            </div>

            <div className="drawer-actions">
              {next?.api === 'send' && (
                <button className="btn" disabled={busy} onClick={() => run(() => api.sendNow(customer.id), 'Review request sent')}>Send request</button>
              )}
              {next?.api === 'open' && (
                <button className="btn" disabled={busy} onClick={() => run(() => api.openCustomer(customer.id), 'Marked as opened')}>Simulate opened</button>
              )}
              {(next?.api === 'reply') && (
                <div className="flex wrap" style={{ gap: 8 }}>
                  <button className="btn green" disabled={busy} onClick={() => run(() => api.replyCustomer(customer.id, 'positive'), '👍 Positive — Google link sent')}>Simulate 👍 reply</button>
                  <button className="btn warn" disabled={busy} onClick={() => run(() => api.replyCustomer(customer.id, 'negative'), '👎 Negative — feedback link sent')}>Simulate 👎 reply</button>
                </div>
              )}
              {next?.api === 'review' && (
                <button className="btn green" disabled={busy} onClick={() => run(() => api.reviewCustomer(customer.id), 'Marked as reviewed on Google')}>Mark reviewed on Google</button>
              )}
              {next?.api === 'feedback' && (
                <div className="flex wrap" style={{ gap: 8, width: '100%' }}>
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Private feedback from customer…"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />
                  <button className="btn" disabled={busy} onClick={() => run(() => api.feedbackCustomer(customer.id, { complaint: feedbackText }), 'Private feedback saved')}>
                    Save feedback
                  </button>
                </div>
              )}
              {stage === 'reviewed' && <div className="ok-note"><Icon.check width={15} height={15} /> Completed — review is public on Google.</div>}
            </div>
          </>
        )}
      </div>
      {node}
    </div>
  );
}

function stageLabel(id) {
  return STAGES.find((s) => s.id === id)?.label || id;
}

function CustomerCard({ c, onOpen }) {
  const stage = c.stage || 'to_send';
  return (
    <button className={`kanban-card ${stage}`} onClick={() => onOpen(c)}>
      <div className="card-row">
        <div className="avatar">{initials(c.name)}</div>
        <div className="card-id">
          <div className="card-name">{c.name}</div>
          <div className="card-phone">{c.phone}</div>
        </div>
        {c.sentiment && <span className={`sentiment-dot ${c.sentiment}`}>{c.sentiment === 'positive' ? '👍' : '👎'}</span>}
      </div>
      <div className="card-foot">
        <span className={`badge ${stage}`}>{stageLabel(stage)}</span>
        {c.hasCustomMessage && <span className="badge reviewed sm">Custom msg</span>}
      </div>
    </button>
  );
}

export default function Customers() {
  const { business } = useAuth();
  const { search, sentiment, view } = useShell();
  const { show, node } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.customers();
      setCustomers(r.customers);
    } catch (e) { show(e.message); } finally { setLoading(false); }
  }, [show]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = customers;
    if (sentiment !== 'all') list = list.filter((c) => c.sentiment === sentiment);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
    }
    return list;
  }, [customers, search, sentiment]);

  const byStage = useMemo(() => {
    const map = {};
    for (const s of STAGES) map[s.id] = [];
    for (const c of filtered) map[c.stage || 'to_send'].push(c);
    return map;
  }, [filtered]);

  const doImport = async () => {
    const rows = parseCsv(csvText);
    if (rows.length === 0) { show('No valid rows found (need name, phone).'); return; }
    try {
      const r = await api.importCustomers(rows);
      show(`Imported ${r.added} customers${r.skipped ? `, skipped ${r.skipped}` : ''}`);
      setCsvText(''); setImportOpen(false); load();
    } catch (e) { show(e.message); }
  };

  const downloadSample = () => {
    const sample = 'name,phone\nRahul Sharma,+91 98123 45678\nPriya Nair,+91 98234 56789\nAmit Verma,+91 98345 67890\n';
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers-sample.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <div className="sub">Review pipeline · from first message to a Google review</div>
        </div>
        <div className="flex wrap" style={{ gap: 8 }}>
          {sentiment === 'all' ? (
            <button className={`btn ghost sm ${sentiment === 'all' ? 'active' : ''}`} disabled>All sentiment</button>
          ) : (
            <button className="btn ghost sm active" onClick={() => {}})>Filtered: {sentiment}</button>
          )}
          <button className="btn secondary" onClick={() => setImportOpen(true)}><Icon.upload width={16} height={16} /> Import CSV</button>
        </div>
      </div>

      {loading ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className={`kanban ${view === 'compact' ? 'compact' : ''}`}>
          {STAGES.map((s) => {
            const items = byStage[s.id] || [];
            const accent = s.id === 'positive' ? 'pos' : s.id === 'negative' ? 'neg' : '';
            return (
              <div className={`kanban-col ${accent}`} key={s.id}>
                <div className="col-head">
                  <span className="col-title">{s.label}</span>
                  <span className="col-count">{items.length}</span>
                  <button className="icon-btn sq" title="More"><Icon.dots width={15} height={15} /></button>
                </div>
                <div className="col-items">
                  {items.length === 0 ? (
                    <div className="col-empty">—</div>
                  ) : (
                    items.map((c) => <CustomerCard key={c.id} c={c} onOpen={setOpenId} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {importOpen && (
        <Modal title="Import customers (CSV)" sub="Columns: name, phone. Header row optional." onClose={() => setImportOpen(false)}>
          <div className="field">
            <label>Paste CSV</label>
            <textarea className="textarea" value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={'name,phone\nRahul Sharma,+91 98123 45678'} rows={6} />
          </div>
          <div className="csv-hint">Need a template? <button className="btn ghost sm" onClick={downloadSample}>Download sample.csv</button></div>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setImportOpen(false)}>Cancel</button>
            <button type="button" className="btn" onClick={doImport}>Import</button>
          </div>
        </Modal>
      )}

      {openCustomer && (
        <CustomerDrawer
          customer={openCustomer}
          business={business}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}

      {node}
    </div>
  );
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /name/i.test(cols[0] || '')) continue;
    const name = cols[0];
    const phone = cols[1] || (cols.length > 2 ? cols[2] : '');
    if (name && phone) rows.push({ name, phone });
  }
  return rows;
}