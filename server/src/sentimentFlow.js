const HAPPY_EMOJI = /😊|🙂|😃|😄|😁|👍|❤️|❤|😍/;
const SAD_EMOJI = /😞|🙁|😠|😡|😢|👎|💔/;

const NO_COMPLAINT = [
  /\bnothing\b/i,
  /you'?re awesome/i,
  /you are awesome/i,
  /\bno suggestion/i,
  /\ball good\b/i,
  /\ball great\b/i,
  /\bno complaints?\b/i,
  /\bkeep it up\b/i,
  /\bjust thanks?\b/i,
  /\bn\/?a\b/i,
  /\bnone\b/i,
  /\bno thanks needed\b/i,
  /\ball awesome\b/i,
  /\bno ideas?\b/i,
  /\bnot really\b/i,
  /\bi'?m good\b/i,
  /\bnope\b/i,
];

export function normalizeInboundText(raw) {
  return String(raw || '').replace(/\u200d/g, '').trim();
}

export function detectSentimentReply(raw) {
  const text = normalizeInboundText(raw);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (HAPPY_EMOJI.test(text)) return 'positive';
  if (SAD_EMOJI.test(text)) return 'negative';
  if (/^(1|one|happy|great|good|awesome|loved it|love it|amazing|excellent|positive)$/i.test(lower)) return 'positive';
  if (/^(2|two|sad|bad|poor|unhappy|terrible|awful|negative|not great|not good)$/i.test(lower)) return 'negative';
  if (/\breply\s*1\b|\boption\s*1\b|\bchoose\s*1\b/i.test(lower)) return 'positive';
  if (/\breply\s*2\b|\boption\s*2\b|\bchoose\s*2\b/i.test(lower)) return 'negative';
  if (/^(yes|yep|yeah)\b/i.test(lower) && HAPPY_EMOJI.test(text)) return 'positive';
  return null;
}

export function isNoComplaintReply(raw) {
  const text = normalizeInboundText(raw);
  if (!text) return false;
  if (text.length <= 40 && NO_COMPLAINT.some((re) => re.test(text))) return true;
  if (/^nothing[,.]?\s*you'?re awesome[.!]*$/i.test(text)) return true;
  if (/^you'?re awesome[.!]*$/i.test(text)) return true;
  return false;
}

export function digitsPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function phoneTail(phone) {
  const d = digitsPhone(phone);
  return d.slice(-10);
}

export function extractInboundMessages(payload) {
  const out = [];
  const seen = new Set();
  const push = (phone, text, extra = {}) => {
    const p = digitsPhone(phone);
    const t = normalizeInboundText(text);
    if (!p || !t) return;
    const key = `${p}:${t}:${extra.id || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ phone: p, text: t, id: extra.id || null, name: extra.name || null });
  };

  const walk = (node, ctx = {}) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, ctx));
      return;
    }

    const phone =
      node.from || node.mobile || node.waId || node.wa_id || node.phone ||
      node.destination || node.sender || node.msisdn || ctx.phone;
    const name = node.profile?.name || node.userName || node.name || ctx.name;
    const id = node.id || node.messageId || node.message_id || ctx.id;

    if (node.text && typeof node.text === 'object' && node.text.body) {
      push(phone, node.text.body, { id, name });
    }
    if (typeof node.text === 'string') push(phone, node.text, { id, name });
    if (typeof node.body === 'string' && (node.from || node.mobile || node.phone)) {
      push(phone, node.body, { id, name });
    }
    if (typeof node.message === 'string') push(phone, node.message, { id, name });
    if (node.button?.text) push(phone, node.button.text, { id, name });
    if (node.interactive?.button_reply?.title) {
      push(phone, node.interactive.button_reply.title, { id, name });
    }
    if (node.interactive?.list_reply?.title) {
      push(phone, node.interactive.list_reply.title, { id, name });
    }
    if (Array.isArray(node.messages)) walk(node.messages, { phone, name, id });
    if (Array.isArray(node.entry)) walk(node.entry, ctx);
    if (Array.isArray(node.changes)) walk(node.changes, ctx);
    if (node.value) walk(node.value, ctx);
    if (node.data) walk(node.data, ctx);
  };

  walk(payload);
  return out;
}
