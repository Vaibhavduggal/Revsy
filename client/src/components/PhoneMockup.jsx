import { getCopy } from '../utils/categoryCopy.js';

function fmtTime(date) {
  const d = new Date(date || Date.now());
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// WhatsApp-style phone-frame mockup showing exactly what the recipient receives.
// Everything here is rendered in the browser — no real message is sent.
export function PhoneMockup({ name: _name = 'Guest', message, businessName, time, category }) {
  const copy = getCopy(category);
  return (
    <div className="phone" aria-label="Simulated WhatsApp message">
      <div className="notch" />
      <div className="wa-header">
        <div className="wa-avatar">{copy.logoEmoji}</div>
        <div>
          <div className="wa-name">{businessName || 'Your Business'}</div>
          <div className="wa-status">online</div>
        </div>
      </div>
      <div className="wa-body">
        <div className="bubble">
          {message}
          <span className="time">{fmtTime(time)} ✓✓</span>
        </div>
      </div>
      <div className="sim">SIMULATED PREVIEW · NOT SENT</div>
      <div className="wa-foot">💬 &nbsp;Type a message…</div>
    </div>
  );
}
