import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api.js';
import { useToast } from '../components/useToast.jsx';

export default function Onboarding() {
  const nav = useNavigate();
  const { show, node } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [provider, setProvider] = useState('AiSensy');
  const [campaignName, setCampaignName] = useState('');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [picking, setPicking] = useState(false);

  const load = async () => {
    try {
      const s = await api.onboardingStatus();
      setStatus(s);
      if (s.onboardingCompleted) nav('/dashboard', { replace: true });
      if (s.googleConnected && s.needsLocation) {
        try {
          const loc = await api.googleLocations();
          setLocations(loc.locations || []);
        } catch { /* listing can fail until APIs are enabled */ }
      }
    } catch (e) { show(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (status?.approvalStatus === 'pending_approval' && status?.googleConnected) {
      const id = setInterval(load, 3000);
      return () => clearInterval(id);
    }
  }, [status?.approvalStatus, status?.googleConnected]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('google') === 'success') {
      show('Google account connected!');
      load();
      window.history.replaceState({}, '', '/onboarding');
    }
    if (p.get('google') === 'error') show('Google connect failed — try again');
  }, []);

  const connectGoogle = () => {
    const token = getToken();
    if (!token) return show('Not authenticated');
    window.location.href = `/api/auth/google?token=${encodeURIComponent(token)}`;
  };

  const pickLocation = async (loc) => {
    setPicking(true);
    try {
      await api.selectGoogleLocation(loc);
      show(`Using ${loc.title}`);
      await load();
    } catch (e) { show(e.message); }
    finally { setPicking(false); }
  };

  const saveWhatsapp = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return show('API key is required');
    if (provider === 'AiSensy' && !campaignName.trim()) return show('AiSensy live campaign name is required');
    setSaving(true);
    try {
      await api.onboardingWhatsapp(apiKey.trim(), phoneId.trim(), { provider, campaignName: campaignName.trim() });
      show('WhatsApp connected');
      load();
    } catch (err) { show(err.message); }
    finally { setSaving(false); }
  };

  const complete = async () => {
    try {
      await api.onboardingComplete();
      show('Onboarding complete!');
      nav('/dashboard', { replace: true });
    } catch (err) { show(err.message); }
  };

  if (loading) return <div className="page"><div className="empty">Loading onboarding…</div></div>;

  if (status?.approvalStatus === 'rejected') {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="card" style={{ borderLeft: '4px solid var(--warn)', background: 'var(--warn-soft)' }}>
          <h3>Not approved</h3>
          <div className="sub">Your business was not approved for Revsy. Contact the platform owner if you believe this is a mistake.</div>
        </div>
        {node}
      </div>
    );
  }

  if (status?.approvalStatus === 'pending_approval' && status?.googleConnected && !status?.needsLocation) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h3>Waiting for approval</h3>
          <div className="sub" style={{ marginTop: 8 }}>Your Google Business Profile is connected. Revsy will unlock WhatsApp setup automatically once the owner accepts your request — no refresh needed.</div>
        </div>
        {node}
      </div>
    );
  }

  const googleDone = status?.googleConnected;
  const waDone = status?.whatsappConnected;
  const canDoWhatsapp = status?.approvalStatus === 'approved';
  const bothDone = googleDone && waDone && status?.approvalStatus === 'approved' && !status?.needsLocation;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1>Welcome to Revsy</h1>
      <div className="sub">Finish these steps in order. Your dashboard stays locked until Google, approval, and WhatsApp are all done.</div>

      <div className="card" style={{ marginTop: 20, borderLeft: googleDone ? '4px solid var(--ok)' : '4px solid var(--warn)' }}>
        <h3>1. Connect Google Business Profile {googleDone && <span style={{ color: 'var(--ok)' }}> ✓</span>}</h3>
        <div className="sub">Revsy needs read access to your Google reviews for the last 12 months.</div>
        {googleDone ? (
          <div className="muted" style={{ marginTop: 10 }}>Connected as {status.googleAccountEmail || 'your Google account'}.</div>
        ) : null}
        <button className="btn" style={{ marginTop: 14 }} onClick={connectGoogle}>
          {googleDone ? 'Reconnect Google account' : 'Connect your Google account'}
        </button>
        {status?.needsLocation && (
          <div style={{ marginTop: 16 }}>
            <div className="sub">This Google account has more than one location. Pick the restaurant Revsy should track.</div>
            <div className="flex col" style={{ gap: 8, marginTop: 10 }}>
              {locations.length === 0 ? <div className="empty">Loading locations…</div> : locations.map((loc) => (
                <button key={loc.locationName} type="button" className="btn secondary" disabled={picking} onClick={() => pickLocation(loc)} style={{ textAlign: 'left' }}>
                  <b>{loc.title}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{loc.address || loc.locationName}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16, borderLeft: waDone ? '4px solid var(--ok)' : '4px solid var(--warn)', opacity: canDoWhatsapp ? 1 : 0.6 }}>
        <h3>2. Connect WhatsApp {waDone && <span style={{ color: 'var(--ok)' }}> ✓</span>}</h3>
        <div className="sub">Paste your provider credentials. Revsy stores them and uses them to send review requests — we do not host WhatsApp for you.</div>
        {!canDoWhatsapp && <div className="csv-hint" style={{ color: 'var(--warn)', marginTop: 8 }}>Connect Google and wait for approval before this step.</div>}
        <form onSubmit={saveWhatsapp} style={{ marginTop: 14 }}>
          <div className="field">
            <label>Provider</label>
            <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!canDoWhatsapp}>
              <option>AiSensy</option>
              <option>Gupshup</option>
              <option>Meta Cloud API</option>
              <option>Other</option>
            </select>
          </div>
          <div className="field">
            <label>API key *</label>
            <input className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste API key" disabled={!canDoWhatsapp} />
          </div>
          {provider === 'AiSensy' ? (
            <div className="field">
              <label>Live API campaign name *</label>
              <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Exact name of the live AiSensy API campaign" disabled={!canDoWhatsapp} />
              <span className="csv-hint">Template variables should be: 1) customer name 2) business name 3) Google review link.</span>
            </div>
          ) : (
            <div className="field">
              <label>Phone number ID *</label>
              <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="WhatsApp phone number ID" disabled={!canDoWhatsapp} />
            </div>
          )}
          {provider === 'AiSensy' && (
            <div className="field">
              <label>Phone number ID (optional)</label>
              <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Optional" disabled={!canDoWhatsapp} />
            </div>
          )}
          <button type="submit" className="btn" disabled={saving || !canDoWhatsapp}>{saving ? 'Saving…' : waDone ? 'Update credentials' : 'Save and connect'}</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16, background: bothDone ? 'var(--ok-soft)' : 'var(--bg-soft)' }}>
        <div className="flex between">
          <div>
            <b>Ready for your dashboard?</b>
            <div className="muted" style={{ fontSize: 13 }}>Need: {googleDone && !status?.needsLocation ? '✓ Google' : '✗ Google'} · {status?.approvalStatus === 'approved' ? '✓ Approved' : '✗ Approved'} · {waDone ? '✓ WhatsApp' : '✗ WhatsApp'}</div>
          </div>
          <button className="btn green" disabled={!bothDone} onClick={complete}>Go to dashboard</button>
        </div>
      </div>
      {node}
    </div>
  );
}
