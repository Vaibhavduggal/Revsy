import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { useToast } from '../components/useToast.jsx';

export default function Onboarding() {
  const nav = useNavigate();
  const { business } = useAuth();
  const { show, node } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const s = await api.onboardingStatus();
      setStatus(s);
      if (s.onboardingCompleted) nav('/dashboard', { replace: true });
    } catch (e) { show(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
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
    // Use query token because browser redirect won't send Authorization header
    window.location.href = `/api/auth/google?token=${encodeURIComponent(token)}`;
  };

  const saveWhatsapp = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return show('API key is required');
    setSaving(true);
    try {
      await api.onboardingWhatsapp(apiKey.trim(), phoneId.trim());
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

  const googleDone = status?.googleConnected;
  const waDone = status?.whatsappConnected;
  const bothDone = googleDone && waDone;

  return (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1>Welcome to Revsy</h1>
      <div className="sub">Complete these two steps to unlock your dashboard. Both are required.</div>

      <div className="card" style={{ marginTop: 20, borderLeft: googleDone ? '4px solid var(--ok)' : '4px solid var(--warn)' }}>
        <h3>1. Connect your Google Business Profile {googleDone && <span style={{ color: 'var(--ok)' }}>✓ Connected</span>}</h3>
        <div className="sub">We need read access to fetch your real Google reviews. Stored as google_access_token / refresh_token, google_connected=true.</div>
        {googleDone ? (
          <div className="muted" style={{ marginTop: 10 }}>Connected as {status.googleAccountEmail || 'your Google account'} — you can reconnect to switch accounts.</div>
        ) : null}
        <button className="btn" style={{ marginTop: 14 }} onClick={connectGoogle}>
          {googleDone ? 'Reconnect Google account' : 'Connect your Google account'}
        </button>
        {!googleDone && <div className="csv-hint">If OAuth is not configured, this will show an error — ask Vaibhav for GOOGLE_CLIENT_ID/SECRET.</div>}
      </div>

      <div className="card" style={{ marginTop: 16, borderLeft: waDone ? '4px solid var(--ok)' : '4px solid var(--warn)' }}>
        <h3>2. Paste your AiSensy WhatsApp API key {waDone && <span style={{ color: 'var(--ok)' }}>✓ Connected</span>}</h3>
        <div className="sub">Saved to whatsapp_api_key / whatsapp_bsp='AiSensy' / whatsapp_status='connected'.</div>
        <form onSubmit={saveWhatsapp} style={{ marginTop: 14 }}>
          <div className="field">
            <label>AiSensy API key *</label>
            <input className="input" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="aisensy_..." />
          </div>
          <div className="field">
            <label>Phone number ID (optional)</label>
            <input className="input" value={phoneId} onChange={e => setPhoneId(e.target.value)} placeholder="e.g. 1234567890" />
          </div>
          <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : waDone ? 'Update key' : 'Save and connect'}</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16, background: bothDone ? 'var(--ok-soft)' : 'var(--bg-soft)' }}>
        <div className="flex between">
          <div>
            <b>Ready to unlock dashboard?</b>
            <div className="muted" style={{ fontSize: 13 }}>Both steps must be complete. {googleDone ? '✓ Google' : '✗ Google'} · {waDone ? '✓ WhatsApp' : '✗ WhatsApp'}</div>
          </div>
          <button className="btn green" disabled={!bothDone} onClick={complete}>Go to dashboard</button>
        </div>
        {!bothDone && <div className="csv-hint" style={{ marginTop: 8, color: 'var(--warn)' }}>Complete both steps above — you will stay on this page until done.</div>}
      </div>
      {node}
    </div>
  );
}
