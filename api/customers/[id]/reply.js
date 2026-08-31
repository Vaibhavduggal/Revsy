import { supabase } from '../../../_lib/supabase.js';
import { auth, cors } from '../../../_lib/auth.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;
  const { id } = req.query;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (customer.stage !== 'opened') return res.status(400).json({ error: `Cannot reply from stage "${customer.stage}"` });

  const { reaction } = req.body || {};
  if (reaction !== 'positive' && reaction !== 'negative') return res.status(400).json({ error: 'reaction must be "positive" or "negative"' });

  const { data: requests } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
  const request = requests?.[0];
  if (request) await supabase.from('requests').update({ reaction }).eq('id', request.id);

  await supabase.from('customers').update({ sentiment: reaction, reacted_at: new Date().toISOString(), stage: reaction === 'positive' ? 'positive' : 'negative' }).eq('id', id);

  if (reaction === 'negative') {
    const fbId = `fb_${customer.id}`;
    const { data: existing } = await supabase.from('feedback').select('*').eq('customer_id', id).single();
    if (!existing) {
      await supabase.from('feedback').insert({ id: fbId, business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, complaint: customer.complaint || '', created_at: new Date().toISOString() });
    }
    const fbLink = business.feedback_link || business.feedbackLink;
    await supabase.from('activities').insert({ id: `act_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, business_id: business.id, type: 'negative_reply', customer_name: customer.name, phone: customer.phone, message: `We're sorry. Tell us what happened: ${fbLink}`, status: 'Negative' });
  } else {
    const revLink = business.google_review_link || business.googleReviewLink;
    await supabase.from('activities').insert({ id: `act_${Date.now()}_${Math.floor(Math.random() * 1e6)}`, business_id: business.id, type: 'positive_reply', customer_name: customer.name, phone: customer.phone, message: `Please leave a Google review: ${revLink}`, status: 'Positive' });
  }

  res.json({ customer: { id, stage: reaction, sentiment: reaction } });
}
