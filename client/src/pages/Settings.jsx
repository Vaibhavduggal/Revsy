import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
import { Toggle } from '../components/Toggle.jsx';
import { PhoneMockup } from '../components/PhoneMockup.jsx';
import { useToast } from '../components/useToast.jsx';

const TEMPLATE_VARS = '[customer name], [business name], [google review link]';

export default function Settings() {
  const { business, setBusiness } = useAuth();
  const { show, node } = useToast();
  const [form, setForm] = useState({ businessName: '', googleReviewLink: '', messageTemplate: '', delaySeconds: 7200, demoMode: false });
  const [preview, setPreview] = useState('');
  const [effectiveDelay, setEffectiveDelay] = useState(7200);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings().then((s) => {
      setForm({
        businessName: s.businessName,
        googleReviewLink: s.googleReviewLink,
        messageTemplate: s.messageTemplate,
        delaySeconds: s.delaySeconds,
        demoMode: s.demoMode,
      });
      setLoaded(true);
    }).catch((e) => show(e.message));
  }, [show]);

  useEffect(() => {
    if (!loaded) return;
    api.messagePreview().then((p) => { setPreview(p.message); setEffectiveDelay(p.effectiveDelay); }).catch(() => {});
  }, [loaded, form.demoMode, form.businessName, form.googleReviewLink, form.messageTemplate]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.updateSettings(form);
      setBusiness((b) => ({ ...b, name: r.businessName }));
      show('Settings saved');
    } catch (err) { show(err.message); } finally { setSaving(false); }
  };

  const delayLabel = form.demoMode
    ? 'Demo mode: send 10 seconds after a customer is added'
    : `Normal: ${Number(form.delaySeconds) / 3600} hour(s) after a customer is added`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Branding, review link, message template and timing.</div>
        </div>
      </div>

      <div className="row two">
        <form className="card" onSubmit={save}>
          <h3>Business & messaging</h3>
          <div className="sub">These power every review request you send.</div>
          <div className="spacer" />
          <div className="field">
            <label>Business name</label>
            <input className="input" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
          </div>
          <div className="field">
            <label>Google Review direct link</label>
            <input className="input" value={form.googleReviewLink} onChange={(e) => update('googleReviewLink', e.target.value)} placeholder="https://g.page/your-business/review" />
          </div>
          <div className="field">
            <label>Message template</label>
            <textarea className="textarea" value={form.messageTemplate} onChange={(e) => update('messageTemplate', e.target.value)} rows={4} />
            <span className="csv-hint">Available variables: {TEMPLATE_VARS}</span>
          </div>
          <div className="field">
            <label>Delay before sending (seconds)</label>
            <input className="input" type="number" min="0" value={form.delaySeconds} onChange={(e) => update('delaySeconds', Number(e.target.value))} disabled={form.demoMode} />
          </div>
          <div className="field">
            <div className="flex between">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Demo mode</div>
                <div className="csv-hint">Send 10 seconds after adding a customer (for live pitches).</div>
              </div>
              <Toggle on={form.demoMode} onChange={(v) => update('demoMode', v)} />
            </div>
          </div>
          <div className="csv-hint" style={{ marginBottom: 14 }}><Icon.clock width={14} height={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {delayLabel}</div>
          <button className="btn" type="submit" disabled={saving || !loaded}>{saving ? 'Saving…' : 'Save settings'}</button>
        </form>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>Live preview</h3>
          <div className="sub" style={{ alignSelf: 'flex-start' }}>Updates as you type</div>
          <div className="spacer" />
          <PhoneMockup
            name="Rahul Sharma"
            message={preview || 'Hi [customer name], thank you for visiting [business name]! …'}
            businessName={form.businessName}
          />
          <div className="csv-hint" style={{ marginTop: 12, textAlign: 'center' }}>
            Effective send delay: {form.demoMode ? '10 seconds' : `${Number(form.delaySeconds) / 3600} hour(s)`}
          </div>
        </div>
      </div>
      {node}
    </div>
  );
}
