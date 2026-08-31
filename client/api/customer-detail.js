import { supabase, auth, cors, generateId } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const { data: requests } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false });
    return res.json({
      customer: { id: customer.id, name: customer.name, phone: customer.phone, customMessage: customer.custom_message, hasCustomMessage: !!(customer.custom_message && customer.custom_message.trim()), stage: customer.stage, sentiment: customer.sentiment, complaint: customer.complaint, createdAt: customer.created_at },
      requests: requests || [], conversation: [],
      config: { googleReviewLink: business.google_review_link || business.googleReviewLink, feedbackLink: business.feedback_link || business.feedbackLink, messageTemplate: business.message_template || business.messageTemplate },
    });
  }

  if (req.method === 'PUT') {
    const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const { name, phone, customMessage } = req.body || {};
    const updates = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof phone === 'string' && phone.trim()) updates.phone = phone.trim();
    if (typeof customMessage === 'string') updates.custom_message = customMessage;
    await supabase.from('customers').update(updates).eq('id', id);
    return res.json({ customer: { id, ...customer, ...updates } });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
