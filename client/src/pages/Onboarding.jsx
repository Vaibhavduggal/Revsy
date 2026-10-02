import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api.js';
import { useToast } from '../components/useToast.jsx';
import { useAuth } from '../auth-context.jsx';
import { getCopy } from '../utils/categoryCopy.js';
import { clearOnboardingIntent, markOnboardingIntent } from '../utils/onboardingIntent.js';

const ONB_STEPS = [
  { n: 1, label: 'Your business' },
  { n: 2, label: 'Connect Google' },
  { n: 3, label: 'Admin approval' },
  { n: 4, label: 'Connect WhatsApp' },
];
const ONB_TITLES = {
  1: 'Step 1 of 4: Your business',
  2: 'Step 2 of 4: Connect Google',
  3: 'Step 3 of 4: Waiting for approval',
  4: 'Step 4 of 4: Connect WhatsApp',
};

function OnboardingProgress({ current }) {
  return (
    <>
      <div className="onb-current">{ONB_TITLES[current]}</div>
      <div className="onb-steps" aria-label={`Step ${current} of 4`}>
        {ONB_STEPS.map((s) => (
          <div key={s.n} className={`onb-step ${s.n === current ? 'active' : ''} ${s.n < current ? 'done' : ''}`}>
            <span className="onb-step-num">{s.n < current ? '✓' : s.n}</span>
            {s.label}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Onboarding() {
  const nav = useNavigate();
  const { show, node } = useToast();
  const { setBusiness } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [provider, setProvider] = useState('SMSwala');
  const [campaignName, setCampaignName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [picking, setPicking] = useState(false);
  const [bizName, setBizName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const load = async () => {
    try {
      const s = await api.onboardingStatus();
      setStatus(s);
      if (s.name) setBizName(s.name);
      if (s.address) setAddress(s.address);
      if (s.phone) setPhone(s.phone);
      if (s.onboardingCompleted) {
        clearOnboardingIntent();
        nav('/dashboard', { replace: true });
      }
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
      markOnboardingIntent();
      show('Google Business Profile connected!');
      load();
      window.history.replaceState({}, '', '/onboarding');
    }
    if (p.get('google') === 'signin') {
      show('Signed in with Google — connect your Business Profile below.');
      window.history.replaceState({}, '', '/onboarding');
    }
    if (p.get('google') === 'error') show('Google Business connect failed. Add your Gmail as an OAuth test user if the app is in Testing mode.');
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!bizName.trim()) return show('Business name is required');
    setSavingProfile(true);
    try {
      const r = await api.onboardingProfile({
        name: bizName.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      setBusiness((b) => (b ? { ...b, categorySet: true, name: r.name } : b));
      show('Business profile saved');
      await load();
    } catch (err) { show(err.message); }
    finally { setSavingProfile(false); }
  };

  const connectGoogle = () => {
    const token = getToken();
    if (!token) return show('Not authenticated');
    markOnboardingIntent();
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
    if (provider === 'SMSwala' && !templateId.trim()) return show('SMSwala template ID is required');
    if (provider === 'SMSwala' && !phoneId.trim()) return show('Meta phone number ID is required for sending your review message text');
    if (provider === 'AiSensy' && !campaignName.trim()) return show('AiSensy live campaign name is required');
    setSaving(true);
    try {
      await api.onboardingWhatsapp(apiKey.trim(), phoneId.trim(), {
        provider,
        campaignName: campaignName.trim(),
        templateId: templateId.trim(),
      });
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

  if (loading) return <div className="editorial-shell"><div className="page"><div className="empty">Loading onboarding…</div></div></div>;

  if (status?.approvalStatus === 'rejected') {
    return (
      <div className="editorial-shell">
        <div className="page" style={{ maxWidth: 640 }}>
          <div className="card" style={{ borderLeft: '4px solid var(--warn)', background: 'var(--warn-soft)' }}>
            <h3>Not approved</h3>
            <div className="sub">Your business was not approved for Revsy. Contact the platform owner if you believe this is a mistake.</div>
          </div>
          {node}
        </div>
      </div>
    );
  }

  if (status?.approvalStatus === 'pending_approval' && status?.googleConnected && !status?.needsLocation) {
    return (
      <div className="editorial-shell">
        <div className="page" style={{ maxWidth: 640 }}>
          <OnboardingProgress current={3} />
          <div className="card" style={{ textAlign: 'center', padding: 40, borderLeft: '4px solid var(--accent)', marginTop: 16 }}>
            <h3>Waiting for admin approval</h3>
            <div className="sub" style={{ marginTop: 8 }}>
              Your Google account and review permissions are connected. The Revsy platform owner still needs to approve your business before WhatsApp setup unlocks.
            </div>
            <div className="pill" style={{ marginTop: 16, display: 'inline-block' }}>Checking every few seconds…</div>
            <div className="csv-hint" style={{ marginTop: 12 }}>Connected as {status.googleAccountEmail || 'your Google account'}</div>
          </div>
          {node}
        </div>
      </div>
    );
  }

  const googleDone = status?.googleConnected;
  const waDone = status?.whatsappConnected;
  const canDoWhatsapp = status?.approvalStatus === 'approved';
  const bothDone = googleDone && waDone && status?.approvalStatus === 'approved' && !status?.needsLocation;
  const copy = getCopy(status?.category);

  if (!status?.categorySet) {
    return (
      <div className="editorial-shell">
        <div className="page" style={{ maxWidth: 640 }}>
          <h1>Welcome to Revsy</h1>
          <OnboardingProgress current={1} />
          <div className="sub">Tell us about your business — then connect Google and WhatsApp.</div>
          <form className="card glass-card" style={{ marginTop: 20 }} onSubmit={saveProfile} data-testid="profile-step">
            <h3>Business details</h3>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Business name</label>
              <input className="input" value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Your business name" required />
            </div>
            <div className="field">
              <label>Address</label>
              <input className="input" data-testid="onboarding-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, PIN" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input className="input" data-testid="onboarding-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
            </div>
            <button type="submit" className="btn" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Continue'}</button>
          </form>
          {node}
        </div>
      </div>
    );
  }

  return (
    <div className="editorial-shell">
      <div className="page" style={{ maxWidth: 640 }}>
        <h1>Welcome to Revsy</h1>
        <OnboardingProgress current={canDoWhatsapp ? 4 : 2} />
        <div className="sub">Finish these steps in order. Your dashboard stays locked until Google, approval, and WhatsApp are all done.</div>

        <div className="card glass-card" style={{ marginTop: 20, borderLeft: googleDone ? '4px solid var(--accent)' : '4px solid var(--line)' }}>
          <h3>1. Connect Google Business Profile {googleDone && <span style={{ color: 'var(--accent)' }}> ✓</span>}</h3>
          <div className="sub">Revsy needs read access to your Google reviews for the last 12 months.</div>
          {googleDone ? (
            <div className="muted" style={{ marginTop: 10 }}>Connected as {status.googleAccountEmail || 'your Google account'}.</div>
          ) : null}
          <button className="btn" style={{ marginTop: 14 }} onClick={connectGoogle}>
            {googleDone ? 'Reconnect Google account' : 'Connect your Google account'}
          </button>
          {status?.needsLocation && (
            <div style={{ marginTop: 16 }}>
              <div className="sub">{copy.locationPick}</div>
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

        <div className="card glass-card" style={{ marginTop: 16, borderLeft: waDone ? '4px solid var(--accent)' : '4px solid var(--line)', opacity: canDoWhatsapp ? 1 : 0.6 }}>
          <h3>2. Connect WhatsApp {waDone && <span style={{ color: 'var(--accent)' }}> ✓</span>}</h3>
          <div className="sub">Use your SMSwala.in WhatsApp Business API credentials. Revsy sends review requests and reads replies for your AI dashboard.</div>
          {!canDoWhatsapp && <div className="csv-hint" style={{ marginTop: 8 }}>Connect Google and wait for approval before this step.</div>}
          <form onSubmit={saveWhatsapp} style={{ marginTop: 14 }}>
            <div className="field">
              <label>Provider</label>
              <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!canDoWhatsapp}>
                <option>SMSwala</option>
                <option>AiSensy</option>
                <option>Gupshup</option>
                <option>Meta Cloud API</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label>API key / token *</label>
              <input className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="SMSwala ApiToken" disabled={!canDoWhatsapp} />
            </div>
            {provider === 'SMSwala' && (
              <>
                <div className="field">
                  <label>WhatsApp template ID *</label>
                  <input className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="Approved template ID from SMSwala dashboard" disabled={!canDoWhatsapp} />
                  <span className="csv-hint">Used for template broadcasts. Session text uses the phone number ID below.</span>
                </div>
                <div className="field">
                  <label>Meta phone number ID *</label>
                  <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="From Meta / SMSwala WhatsApp setup" disabled={!canDoWhatsapp} />
                  <span className="csv-hint">Required to send your single-message review text with the Google link.</span>
                </div>
                <div className="field">
                  <label>Campaign name (optional)</label>
                  <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="For your records in SMSwala" disabled={!canDoWhatsapp} />
                </div>
              </>
            )}
            {provider === 'AiSensy' && (
              <>
                <div className="field">
                  <label>Live API campaign name *</label>
                  <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Exact name of the live AiSensy API campaign" disabled={!canDoWhatsapp} />
                </div>
                <div className="field">
                  <label>Phone number ID (optional)</label>
                  <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Optional" disabled={!canDoWhatsapp} />
                </div>
              </>
            )}
            {provider !== 'SMSwala' && provider !== 'AiSensy' && (
              <div className="field">
                <label>Phone number ID *</label>
                <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="WhatsApp phone number ID" disabled={!canDoWhatsapp} />
              </div>
            )}
            <button type="submit" className="btn" disabled={saving || !canDoWhatsapp}>{saving ? 'Saving…' : waDone ? 'Update credentials' : 'Save and connect'}</button>
          </form>
        </div>

        <div className="card glass-card" style={{ marginTop: 16, background: bothDone ? 'var(--accent-soft)' : 'var(--bg-soft)' }}>
          <div className="flex between">
            <div>
              <b>Ready for your dashboard?</b>
              <div className="muted" style={{ fontSize: 13 }}>Need: {googleDone && !status?.needsLocation ? '✓ Google' : '✗ Google'} · {status?.approvalStatus === 'approved' ? '✓ Approved' : '✗ Approved'} · {waDone ? '✓ WhatsApp' : '✗ WhatsApp'}</div>
            </div>
            <button className="btn" disabled={!bothDone} onClick={complete}>Go to dashboard</button>
          </div>
        </div>
        {node}
      </div>
    </div>
  );
}
