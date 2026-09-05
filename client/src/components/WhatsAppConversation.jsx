import { Icon } from './Icons.jsx';
import { getCopy } from '../utils/categoryCopy.js';

function fmtTime(date) {
  const d = new Date(date || Date.now());
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// Renders the simulated WhatsApp conversation from the bubbles the server produces.
// `interactive` shows tappable quick-reply buttons (for demo mode).
export function WhatsAppConversation({ conversation, businessName = 'Your Business', interactive, onReaction, category }) {
  const copy = getCopy(category);
  const avatar = copy.category === 'gym' ? '🏋️' : '🍽️';
  return (
    <div className="wa-screen">
      <div className="wa-bar">
        <div className="wa-avatar">{avatar}</div>
        <div>
          <div className="wa-name">{businessName}</div>
          <div className="wa-status">online</div>
        </div>
      </div>
      <div className="wa-thread">
        {conversation.map((b, i) => {
          if (b.type === 'text') {
            const cls = b.from === 'business' ? 'bubble biz' : (b.private ? 'bubble cust private' : 'bubble cust');
            return (
              <div className={cls} key={i}>
                {b.private && <span className="priv-tag"><Icon.lock width={11} height={11} /> private</span>}
                <span className="bubble-text">{b.text}</span>
                <span className="time">{fmtTime()} ✓✓</span>
              </div>
            );
          }
          if (b.type === 'link') {
            return (
              <div className="bubble biz" key={i}>
                <span className="bubble-text">{b.text}</span>
                <span className="time">{fmtTime()} ✓✓</span>
              </div>
            );
          }
          if (b.type === 'quickreply') {
            return (
              <div className="bubble biz qr" key={i}>
                <span className="bubble-text">{b.text}</span>
                <div className="qr-buttons">
                  {b.buttons.map((btn) => (
                    <button
                      key={btn.value}
                      className={`qr-btn ${btn.value}`}
                      disabled={!interactive}
                      onClick={() => interactive && onReaction && onReaction(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          if (b.type === 'reaction') {
            return (
              <div className="bubble cust reaction" key={i}>
                <span className="bubble-text">{b.text}</span>
                <span className="time">{fmtTime()} ✓✓</span>
              </div>
            );
          }
          return null;
        })}
      </div>
      <div className="wa-foot"><Icon.chat width={16} height={16} /> &nbsp;Type a message…</div>
    </div>
  );
}
