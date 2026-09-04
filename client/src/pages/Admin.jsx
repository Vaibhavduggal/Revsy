import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api.js';
import { useAdminAuth } from '../admin-auth-context.jsx';
import { Icon, Logo } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { useToast } from '../components/useToast.jsx';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS = { trial: { label: 'Trial', cls: 'sent' }, active: { label: 'Active', cls: 'reviewed' }, cancelled: { label: 'Cancelled', cls: 'opened' } };
const BSP_OPTIONS = ['RichAutomate', 'AiSensy', 'Gupshup', 'Interakt', 'Wati', 'Other'];

function AddClientModal({ onClose, onAdded }) {
  const { show, node } = useToast();
  const [form, setForm] = useState({ name: '', ownerEmail: '', password: '', googleReviewLink: '' });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ownerEmail.trim() || !form.password.trim()) return;
    setBusy(true);
    try {
      await adminApi.addBusiness(form);
      show(`${form.name} added — they can log in with ${form.ownerEmail}`);
      onAdded();
      onClose();
    } catch (err) { show(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Add client" sub="Creates their login. Share the email + password with them so they can sign in." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Business name</label><input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Punjabi Tadka" autoFocus /></div>
        <div className="field"><label>Owner email (their login)</label><input className="input" type="email" value={form.ownerEmail} onChange={(e) => update('ownerEmail', e.target.value)} placeholder="owner@theirbusiness.com" /></div>
        <div className="field"><label>Initial password</label><input className="input" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Set a temporary password" /></div>
        <div className="field"><label>Google review link (optional, can add later)</label><input className="input" value={form.googleReviewLink} onChange={(e) => update('googleReviewLink', e.target.value)} placeholder="https://g.page/.../review" /></div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add client'}</button>
        </div>
      </form>
      {node}
    </Modal>
  );
}

function InviteModal({ onClose, onAdded }) {
  const { show, node } = useToast();
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await adminApi.invite(email.trim(), businessName.trim());
      show(`Invite sent to ${email.trim()}`);
      onAdded();
      onClose();
    } catch (err) { show(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Invite by email" sub="Sends an invite — they will create their own login and be pre-approved." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Email *</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@theirbusiness.com" autoFocus required /></div>
        <div className="field"><label>Business name (optional)</label><input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Punjabi Tadka" /></div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</button>
        </div>
      </form>
      {node}
    </Modal>
  );
}

function WhatsappModal({ biz, onClose, onSaved }) {
  const { show, node } = useToast();
  const [form, setForm] = useState({ bsp: biz.whatsapp?.bsp || 'AiSensy', apiKey: '', phoneNumberId: biz.whatsapp?.phoneNumberId || '', campaignName: biz.whatsapp?.campaignName || '' });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi.onboardWhatsapp(biz.id, form);
      show(`WhatsApp connected for ${biz.name}`);
      onSaved();
      onClose();
    } catch (err) { show(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Onboard WhatsApp — ${biz.name}`} sub="Enter the client's own BSP credentials (their account, their billing)." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>BSP</label>
          <select className="select" value={form.bsp} onChange={(e) => update('bsp', e.target.value)}>
            {BSP_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="field"><label>Phone number ID</label><input className="input" value={form.phoneNumberId} onChange={(e) => update('phoneNumberId', e.target.value)} placeholder="From the BSP dashboard" /></div>
        <div className="field"><label>AiSensy campaign name</label><input className="input" value={form.campaignName} onChange={(e) => update('campaignName', e.target.value)} placeholder="Live API campaign name" /></div>
        <div className="field">
          <label>API key {biz.whatsapp?.status === 'connected' ? <span className="badge reviewed sm">Already connected</span> : null}</label>
          <input className="input" value={form.apiKey} onChange={(e) => update('apiKey', e.target.value)} placeholder="Leave blank to keep the existing key" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save connection'}</button>
        </div>
      </form>
      {node}
    </Modal>
  );
}

function GoogleModal({ biz, onClose, onSaved }) {
  const { show, node } = useToast();
  const [form, setForm] = useState({ placeId: biz.placeId || '', googleReviewLink: biz.googleReviewLink || '' });
  const [busy, setBusy] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminApi.setGoogle(biz.id, form);
      show(`Google Reviews connection saved for ${biz.name}`);
      onSaved();
      onClose();
    } catch (err) { show(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Google Reviews — ${biz.name}`} sub="Used to pull real reviews. 4★ and above file as positive, below 4★ as negative." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field"><label>Google Place ID</label><input className="input" value={form.placeId} onChange={(e) => update('placeId', e.target.value)} placeholder="ChIJ..." /></div>
        <div className="field"><label>Direct review link</label><input className="input" value={form.googleReviewLink} onChange={(e) => update('googleReviewLink', e.target.value)} placeholder="https://g.page/.../review" /></div>
        <div className="csv-hint" style={{ marginBottom: 14 }}>Requires a <code>GOOGLE_PLACES_API_KEY</code> set on the server — the sync button on the client dashboard will say so if it's missing.</div>
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      {node}
    </Modal>
  );
}

export default function Admin() {
  const { logout } = useAdminAuth() || {};
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [tab, setTab] = useState('clients');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [waTarget, setWaTarget] = useState(null);
  const [googleTarget, setGoogleTarget] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [invites, setInvites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.businesses()
      .then((r) => setList(Array.isArray(r.businesses) ? r.businesses : []))
      .catch((e) => {
        show(e.message);
        if (String(e.message).toLowerCase().includes('unauthorized')) navigate('/admin/login');
      })
      .finally(() => setLoading(false));
  }, [show, navigate]);

  const loadInvites = useCallback(() => {
    adminApi.invites().then((r) => setInvites(Array.isArray(r.invites) ? r.invites : [])).catch(() => {});
  }, []);

  const loadRequests = useCallback(() => {
    setReqLoading(true);
    adminApi.requests().then((r) => setRequests(Array.isArray(r.requests) ? r.requests : [])).catch((e) => show(e.message)).finally(() => setReqLoading(false));
  }, [show]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'invites') loadInvites(); if (tab === 'requests') loadRequests(); }, [tab, loadInvites, loadRequests]);

  const remove = async (biz) => {
    if (!window.confirm(`Remove ${biz.name} and all of their data? This can't be undone.`)) return;
    setRemoving(biz.id);
    try {
      await adminApi.removeBusiness(biz.id);
      show(`${biz.name} removed`);
      load();
    } catch (err) { show(err.message); } finally { setRemoving(null); }
  };

  const approve = async (id) => {
    try { await adminApi.approve(id); show('Approved'); loadRequests(); load(); } catch (e) { show(e.message); }
  };
  const reject = async (id) => {
    if (!window.confirm('Reject this business? They will see a not-approved message.')) return;
    try { await adminApi.reject(id); show('Rejected'); loadRequests(); load(); } catch (e) { show(e.message); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft)' }}>
      <header className="topbar" style={{ position: 'static' }}>
        <div className="brand"><Logo /><span>Revsy Admin</span></div>
        <button className="btn secondary sm" onClick={() => { logout(); navigate('/admin/login'); }}>
          <Icon.logout width={15} height={15} /> Logout
        </button>
      </header>

      <div className="page">
        <div className="page-head">
          <div>
            <h1>Clients</h1>
            <div className="sub">Add clients, onboard their WhatsApp Business API, and connect Google Reviews.</div>
          </div>
          <div className="flex" style={{ gap: 10 }}>
            <button className="btn secondary" onClick={() => setInviting(true)}><Icon.plus width={16} height={16} /> Invite by email</button>
            <button className="btn" onClick={() => setAdding(true)}><Icon.plus width={16} height={16} /> Add client</button>
          </div>
        </div>

        <div className="flex" style={{ gap: 8, marginBottom: 16 }}>
          <button className={`btn sm ${tab === 'clients' ? '' : 'secondary'}`} onClick={() => setTab('clients')}>Clients ({list.length})</button>
          <button className={`btn sm ${tab === 'requests' ? '' : 'secondary'}`} onClick={() => setTab('requests')}>Requests ({requests.length})</button>
          <button className={`btn sm ${tab === 'invites' ? '' : 'secondary'}`} onClick={() => setTab('invites')}>Invites ({invites.length})</button>
        </div>

        {tab === 'clients' && (
          <div className="card mb">
            {loading ? (
              <div className="empty">Loading…</div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Business</th><th>Owner email</th><th>Status</th><th>WhatsApp</th><th>Google</th><th>Reviews</th><th>Requests</th><th>Customers</th><th>Created</th><th></th></tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id}>
                      <td><b>{b.name}</b>{b.isDemo && <span className="badge sent sm" style={{ marginLeft: 6 }}>Demo</span>}</td>
                      <td className="muted">{b.ownerEmail}</td>
                      <td><span className={`badge ${STATUS[b.subscriptionStatus]?.cls || 'sent'}`}>{STATUS[b.subscriptionStatus]?.label || b.subscriptionStatus || 'Trial'}</span></td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setWaTarget(b)}>
                          {b.whatsapp?.status === 'connected'
                            ? <span className="badge reviewed sm">{b.whatsapp.bsp || 'Connected'}</span>
                            : <span className="badge sent sm">Not connected</span>}
                        </button>
                      </td>
                      <td>
                        <button className="btn ghost sm" onClick={() => setGoogleTarget(b)}>
                          {b.googleConnected || b.placeId ? <span className="badge reviewed sm">Connected</span> : <span className="badge sent sm">Not connected</span>}
                        </button>
                      </td>
                      <td>{b.reviewsCount ?? 0}</td>
                      <td>{b.requestsSent}</td>
                      <td>{b.customersCount}</td>
                      <td className="muted">{fmtDate(b.createdAt)}</td>
                      <td>
                        {!b.isDemo && (
                          <button className="btn ghost sm" disabled={removing === b.id} onClick={() => remove(b)} title="Remove client">
                            <Icon.trash width={15} height={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div className="card mb">
            <h3>Pending approval ({requests.length})</h3>
            <div className="sub">Businesses that signed up and connected Google — approve to let them continue to WhatsApp.</div>
            <div className="spacer" />
            {reqLoading ? <div className="empty">Loading…</div> : requests.length === 0 ? <div className="empty">No pending requests.</div> : (
              <table className="table">
                <thead><tr><th>Business</th><th>Owner email</th><th>Google</th><th>Created</th><th></th></tr></thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.name}</b></td>
                      <td className="muted">{r.ownerEmail}</td>
                      <td>{r.googleConnected ? <span className="badge reviewed sm">{r.googleAccountEmail || 'Connected'}</span> : <span className="badge sent sm">Not connected</span>}</td>
                      <td className="muted">{fmtDate(r.createdAt)}</td>
                      <td>
                        <div className="flex" style={{ gap: 6 }}>
                          <button className="btn green sm" onClick={() => approve(r.id)}>Accept</button>
                          <button className="btn secondary sm" onClick={() => reject(r.id)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'invites' && (
          <div className="card mb">
            <h3>Invited emails ({invites.length})</h3>
            <div className="sub">Pre-approved invites — they skip the waiting screen after Google connect.</div>
            <div className="spacer" />
            {invites.length === 0 ? <div className="empty">No invites yet.</div> : (
              <table className="table">
                <thead><tr><th>Email</th><th>Business name</th><th>Invited</th><th>Used</th></tr></thead>
                <tbody>
                  {invites.map((iv) => (
                    <tr key={iv.id}>
                      <td><b>{iv.email}</b></td>
                      <td className="muted">{iv.business_name || '—'}</td>
                      <td className="muted">{fmtDate(iv.invited_at)}</td>
                      <td>{iv.used ? <span className="badge reviewed sm">Used</span> : <span className="badge sent sm">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {adding && <AddClientModal onClose={() => setAdding(false)} onAdded={load} />}
      {inviting && <InviteModal onClose={() => setInviting(false)} onAdded={() => { loadInvites(); load(); }} />}
      {waTarget && <WhatsappModal biz={waTarget} onClose={() => setWaTarget(null)} onSaved={load} />}
      {googleTarget && <GoogleModal biz={googleTarget} onClose={() => setGoogleTarget(null)} onSaved={load} />}
      {node}
    </div>
  );
}
