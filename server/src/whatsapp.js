function digitsPhone(phone) {
  const raw = String(phone || '').trim();
  const plus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Invalid phone number');
  if (plus) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data.error?.message || data.message || data.error || text.slice(0, 300);
    throw new Error(String(msg));
  }
  return data;
}

export async function sendViaAiSensy({ apiKey, campaignName, phone, customerName, templateParams }) {
  if (!apiKey) throw new Error('AiSensy API key is missing');
  if (!campaignName) {
    throw new Error('AiSensy campaign name is required. Add the live API campaign name in Settings / onboarding.');
  }
  return postJson('https://backend.aisensy.com/campaign/t1/api/v2', {
    apiKey,
    campaignName,
    destination: digitsPhone(phone),
    userName: customerName || 'Customer',
    source: 'Revsy',
    templateParams: Array.isArray(templateParams) ? templateParams : [],
  });
}

export async function sendViaMetaCloud({ apiKey, phoneNumberId, phone, message }) {
  if (!apiKey) throw new Error('WhatsApp API key is missing');
  if (!phoneNumberId) throw new Error('WhatsApp phone number ID is missing');
  const to = digitsPhone(phone);
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;
  return postJson(url, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message, preview_url: true },
  }, { Authorization: `Bearer ${apiKey}` });
}

export async function sendBusinessWhatsApp(business, { phone, message, customerName, session = false, templateParams }) {
  if (message && message.includes('__FORCE_FAIL__')) {
    throw new Error('Simulated delivery failure');
  }
  if (!phone || !message) throw new Error('Missing phone or message');

  const provider = String(business.whatsapp?.bsp || 'AiSensy').toLowerCase();
  const apiKey = business.whatsapp?.apiKey;
  const phoneNumberId = business.whatsapp?.phoneNumberId;
  const campaignName = business.whatsapp?.campaignName;

  if (business.whatsapp?.status !== 'connected' || !apiKey) {
    throw new Error('WhatsApp is not connected for this business');
  }

  const params = Array.isArray(templateParams) && templateParams.length
    ? templateParams
    : [customerName || 'there', business.name, session ? message : (business.googleReviewLink || message)];

  if (session && phoneNumberId && (provider.includes('meta') || provider.includes('cloud') || provider.includes('official'))) {
    return sendViaMetaCloud({ apiKey, phoneNumberId, phone, message });
  }

  if (session && phoneNumberId && !provider.includes('aisensy')) {
    return sendViaMetaCloud({ apiKey, phoneNumberId, phone, message });
  }

  if (provider.includes('aisensy')) {
    if (session && phoneNumberId) {
      try {
        return await sendViaMetaCloud({ apiKey, phoneNumberId, phone, message });
      } catch {
        return sendViaAiSensy({ apiKey, campaignName, phone, customerName, templateParams: params });
      }
    }
    return sendViaAiSensy({ apiKey, campaignName, phone, customerName, templateParams: params });
  }

  return sendViaMetaCloud({ apiKey, phoneNumberId, phone, message });
}
