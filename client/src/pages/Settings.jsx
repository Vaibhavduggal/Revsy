import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth-context.jsx';
import { Icon } from '../components/Icons.jsx';
import { Toggle } from '../components/Toggle.jsx';
import { PhoneMockup } from '../components/PhoneMockup.jsx';
import { useToast } from '../components/useToast.jsx';
import { getCopy } from '../utils/categoryCopy.js';
import { renderTemplate } from '../utils/presets.js';

const TEMPLATE_VARS = '{{customer_name}}, {{business_name}}, {{visit_verb}}, {{google_review_link}}';

const SINGLE_TEMPLATE_FIELD = {
  key: 'single',
  label: 'Review request message',
  hint: 'One WhatsApp with your Google link and an invite to reply with suggestions. Replies are clustered in AI insights.',
};

const MULTI_TEMPLATE_FIELDS = [
  { key: 'gate', label: 'Message 1 — Sentiment gate (sent first)', hint: 'First WhatsApp after a customer is added.' },
  { key: 'happyFollowup', label: 'Message 2a — After 😊 Great!', hint: 'Ask for suggestions or a simple thank-you.' },
  { key: 'googleAsk', label: 'Message 3a — Google review ask', hint: 'Sent when happy and no complaint detected.' },
  { key: 'sadFollowup', label: 'Message 2b — After 😞 Not great', hint: 'Private complaint prompt — never public.' },
];

const REPLY_TEMPLATE_FIELDS = [
  { key: 'positiveReply', label: 'Google reply — positive review', hint: 'Posted when you mark a positive Google review as read.' },
  { key: 'negativeAcknowledge', label: 'Google reply — negative acknowledge', hint: 'Posted when you acknowledge a negative Google review.' },
];

const EMPTY_TEMPLATES = { single: '', gate: '', happyFollowup: '', googleAsk: '', sadFollowup: '', positiveReply: '', negativeAcknowledge: '' };

export default function Settings() {
  const { business, setBusiness } = useAuth();
  const copy = getCopy(business?.category);
  const { show, node } = useToast();
  const [form, setForm] = useState({
    businessName: '',
    googleReviewLink: '',
    messageTemplate: '',
    messageTemplates: { ...EMPTY_TEMPLATES },
    delaySeconds: 1800,
    demoMode: false,
    whatsappCampaignName: '',
    whatsappBsp: 'SMSwala',
    whatsappTemplateId: '',
    messageFlowMode: 'single',
  });
  const [delayUnit, setDelayUnit] = useState('minutes');
  const [previews, setPreviews] = useState({ ...EMPTY_TEMPLATES });
  const [previewKey, setPreviewKey] = useState('single');
  const [effectiveDelay, setEffectiveDelay] = useState(7200);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings().then((s) => {
      const templates = s.messageTemplates || { gate: s.messageTemplate || '' };
      setForm({
        businessName: s.businessName,
        googleReviewLink: s.googleReviewLink,
        messageTemplate: templates.gate || s.messageTemplate || '',
        messageTemplates: { ...EMPTY_TEMPLATES, ...templates },
        delaySeconds: s.delaySeconds,
        demoMode: s.demoMode,
        whatsappCampaignName: s.whatsappCampaignName || '',
        whatsappBsp: s.whatsappBsp || 'SMSwala',
        whatsappTemplateId: s.whatsappTemplateId || '',
        messageFlowMode: s.messageFlowMode === 'multi' ? 'multi' : 'single',
      });
      setPreviewKey(s.messageFlowMode === 'multi' ? 'gate' : 'single');
      const secs = Number(s.delaySeconds) || 0;
      setDelayUnit(secs >= 3600 && secs % 3600 === 0 ? 'hours' : 'minutes');
      setLoaded(true);
    }).catch((e) => show(e.message));
  }, [show]);

  useEffect(() => {
    if (!loaded) return;
    const ctx = {
      customerName: 'Rahul Sharma',
      businessName: form.businessName || business?.name || 'Your business',
      reviewLink: form.googleReviewLink || 'https://g.page/your-business/review',
      category: business?.category,
    };
    setPreviews({
      single: renderTemplate(form.messageTemplates.single, ctx),
      gate: renderTemplate(form.messageTemplates.gate || form.messageTemplate, ctx),
      happyFollowup: renderTemplate(form.messageTemplates.happyFollowup, ctx),
      googleAsk: renderTemplate(form.messageTemplates.googleAsk, ctx),
      sadFollowup: renderTemplate(form.messageTemplates.sadFollowup, ctx),
    });
    api.messagePreview().then((p) => {
      setEffectiveDelay(p.effectiveDelay);
    }).catch(() => {});
  }, [loaded, form.demoMode, form.businessName, form.googleReviewLink, form.messageTemplates, form.messageTemplate, form.messageFlowMode, business?.category, business?.name]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateTemplate = (key, value) => setForm((f) => ({
    ...f,
    messageTemplates: { ...f.messageTemplates, [key]: value },
    messageTemplate: key === 'gate' ? value : f.messageTemplate,
  }));

  const isMulti = form.messageFlowMode === 'multi';
  const templateFields = isMulti ? MULTI_TEMPLATE_FIELDS : [SINGLE_TEMPLATE_FIELD];
  const previewFields = isMulti ? MULTI_TEMPLATE_FIELDS : [SINGLE_TEMPLATE_FIELD];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        messageTemplate: form.messageTemplates.gate || form.messageTemplate,
        messageTemplates: form.messageTemplates,
      };
      const r = await api.updateSettings(payload);
      setBusiness((b) => ({ ...b, name: r.businessName }));
      show('Settings saved');
    } catch (err) { show(err.message); } finally { setSaving(false); }
  };

  const delayLabel = form.demoMode
    ? `Demo mode: send 10 seconds ${copy.delayAfterAdd}`
    : Number(form.delaySeconds) === 0
      ? `Send immediately ${copy.delayAfterAdd}`
      : `Send after ${Math.round(Number(form.delaySeconds) / 60)} minute(s) (${form.delaySeconds}s) ${copy.delayAfterAdd}`;

  const activePreview = previews[previewKey] || previews.single || previews.gate || '';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <div className="sub">Review link, WhatsApp (SMSwala), message style, and send timing.</div>
        </div>
      </div>

      <div className="row two">
        <form className="card glass-card" onSubmit={save}>
          <h3>Business & messaging</h3>
          <div className="field">
            <label>WhatsApp message style</label>
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn sm ${!isMulti ? '' : 'secondary'}`}
                onClick={() => { update('messageFlowMode', 'single'); setPreviewKey('single'); }}
              >
                Single message (default)
              </button>
              <button
                type="button"
                className={`btn sm ${isMulti ? '' : 'secondary'}`}
                onClick={() => { update('messageFlowMode', 'multi'); setPreviewKey('gate'); }}
              >
                Multi-message gate
              </button>
            </div>
            <span className="csv-hint">
              {isMulti
                ? 'Classic 😊/😞 flow with follow-up messages.'
                : 'One message with Google link; customers reply with suggestions in plain text for AI insights.'}
            </span>
          </div>
          <div className="spacer" />
          <div className="field">
            <label>Business name</label>
            <input className="input" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
          </div>
          <div className="field">
            <label>Google Review direct link</label>
            <input className="input" value={form.googleReviewLink} onChange={(e) => update('googleReviewLink', e.target.value)} placeholder="https://g.page/your-business/review" />
          </div>
          {templateFields.map(({ key, label, hint }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <textarea
                className="textarea"
                value={form.messageTemplates[key] || ''}
                onChange={(e) => updateTemplate(key, e.target.value)}
                onFocus={() => setPreviewKey(key)}
                rows={key === 'gate' || key === 'single' ? 6 : 4}
              />
              <span className="csv-hint">{hint}</span>
            </div>
          ))}
          <div className="divider" />
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Google review auto-replies</h3>
          <div className="sub" style={{ marginBottom: 12 }}>Posted on your behalf when you mark reviews read from the dashboard.</div>
          {REPLY_TEMPLATE_FIELDS.map(({ key, label, hint }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <textarea
                className="textarea"
                value={form.messageTemplates[key] || ''}
                onChange={(e) => updateTemplate(key, e.target.value)}
                rows={3}
              />
              <span className="csv-hint">{hint} Variables: {'{{business_name}}'}</span>
            </div>
          ))}
          <div className="csv-hint" style={{ marginBottom: 14 }}>Available variables: {TEMPLATE_VARS}</div>
          <div className="field">
            <label>Automation timing</label>
            <select
              className="select"
              value={form.demoMode ? 'demo' : form.delaySeconds === 0 ? 'immediate' : 'custom'}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'immediate') { update('delaySeconds', 0); update('demoMode', false); }
                else if (v === 'custom' && form.delaySeconds === 0) { update('delaySeconds', 1800); update('demoMode', false); }
              }}
            >
              <option value="immediate">Send immediately</option>
              <option value="custom">Send after: custom delay below</option>
            </select>
          </div>
          <div className="field">
            <label>WhatsApp provider</label>
            <select className="select" value={form.whatsappBsp} onChange={(e) => update('whatsappBsp', e.target.value)}>
              <option>SMSwala</option>
              <option>AiSensy</option>
              <option>Gupshup</option>
              <option>Meta Cloud API</option>
              <option>Other</option>
            </select>
          </div>
          <div className="field">
            <label>SMSwala template ID</label>
            <input className="input" value={form.whatsappTemplateId} onChange={(e) => update('whatsappTemplateId', e.target.value)} placeholder="Approved template ID from smswala.in" />
            <span className="csv-hint">For template-based sends. Session text uses your connected Meta phone number ID from onboarding.</span>
          </div>
          <div className="field">
            <label>Campaign name (optional)</label>
            <input className="input" value={form.whatsappCampaignName} onChange={(e) => update('whatsappCampaignName', e.target.value)} placeholder="SMSwala / AiSensy campaign label" />
          </div>
          <div className="field">
            <label>Custom delay</label>
            <div className="flex" style={{ gap: 8 }}>
              <input
                className="input" type="number" min="0"
                value={delayUnit === 'hours'
                  ? Math.round(Number(form.delaySeconds) / 3600)
                  : Math.round(Number(form.delaySeconds) / 60)}
                onChange={(e) => {
                  const n = Math.max(0, Number(e.target.value) || 0);
                  update('delaySeconds', delayUnit === 'hours' ? n * 3600 : n * 60);
                }}
                disabled={form.demoMode} placeholder="30"
              />
              <select
                className="select" style={{ maxWidth: 130 }}
                value={delayUnit}
                onChange={(e) => {
                  const next = e.target.value;
                  const currentVal = delayUnit === 'hours'
                    ? Math.round(Number(form.delaySeconds) / 3600)
                    : Math.round(Number(form.delaySeconds) / 60);
                  setDelayUnit(next);
                  update('delaySeconds', next === 'hours' ? currentVal * 3600 : currentVal * 60);
                }}
                disabled={form.demoMode}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
            <span className="csv-hint">Default is 30 minutes. Choose immediate above to send as soon as a {copy.person} is added.</span>
          </div>
          <div className="field">
            <div className="flex between">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Demo mode</div>
                <div className="csv-hint">Send 10 seconds after adding a {copy.person} (for live pitches).</div>
              </div>
              <Toggle on={form.demoMode} onChange={(v) => update('demoMode', v)} />
            </div>
          </div>
          <div className="csv-hint" style={{ marginBottom: 14 }}><Icon.clock width={14} height={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {delayLabel}</div>
          <button className="btn" type="submit" disabled={saving || !loaded}>{saving ? 'Saving…' : 'Save settings'}</button>
        </form>

        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start' }}>Live preview</h3>
          <div className="sub" style={{ alignSelf: 'flex-start' }}>
            {previewFields.find((f) => f.key === previewKey)?.label || 'Message preview'}
          </div>
          <div className="flex" style={{ gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start', marginTop: 10 }}>
            {previewFields.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`btn sm ${previewKey === key ? '' : 'secondary'}`}
                onClick={() => setPreviewKey(key)}
              >
                {label.split('—')[0].trim()}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <PhoneMockup
            name="Rahul Sharma"
            message={activePreview || `Hi Rahul Sharma! Thanks for ${copy.visitGerund} ${form.businessName || '[business name]'} today 🙏 …`}
            businessName={form.businessName}
            category={business?.category}
          />
          <div className="csv-hint" style={{ marginTop: 12, textAlign: 'center' }}>
            Effective send delay: {form.demoMode ? '10 seconds' : Number(form.delaySeconds) === 0 ? 'immediate' : `${Math.round(Number(form.delaySeconds) / 60)} min (${form.delaySeconds}s)`}
          </div>
        </div>
      </div>
      {node}
    </div>
  );
}
