import { supabase, auth, cors, generateId } from './_lib.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  const url = req.url || '';
  const match = url.match(/\/api\/customers\/([^/]+)\/(\w+)/);
  if (!match) return res.status(400).json({ error: 'Invalid URL' });
  const [, id, action] = match;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', business.id).single();
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const now = new Date().toISOString();
  const tpl = business.message_template || 'Hi [customer name], thank you for visiting [business name]!';

  if (action === 'send') {
    const message = renderTemplate(tpl, { customerName: customer.name, businessName: business.name, reviewLink: business.google_review_link || '' });
    const { data: requests } = await supabase.from('requests').select('*').eq('customer_id', id).eq('status', 'Scheduled').limit(1);
    let request = requests?.[0];
    if (!request) {
      request = { id: generateId('req'), business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, message, status: 'Scheduled' };
      await supabase.from('requests').insert(request);
    }
    await supabase.from('pending_sends').insert({ id: generateId('ps'), business_id: business.id, customer_id: id, phone: customer.phone, message, scheduled_time: now, status: 'pending' });
    await supabase.from('requests').update({ message, sent_at: now, status: 'Sent' }).eq('id', request.id);
    await supabase.from('customers').update({ stage: 'sent', last_request_at: now, last_request_status: 'Sent' }).eq('id', id);
    return res.json({ request: { ...request, status: 'Sent' }, customer: { id, stage: 'sent' } });
  }

  if (action === 'open') {
    if (customer.stage !== 'sent' && customer.stage !== 'to_send') return res.status(400).json({ error: `Cannot open from stage "${customer.stage}"` });
    const { data: reqs } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
    if (reqs?.[0]) await supabase.from('requests').update({ opened_at: now, status: 'Opened' }).eq('id', reqs[0].id);
    await supabase.from('customers').update({ stage: 'opened', last_request_status: 'Opened' }).eq('id', id);
    return res.json({ customer: { id, stage: 'opened' } });
  }

  if (action === 'reply') {
    if (customer.stage !== 'opened') return res.status(400).json({ error: `Cannot reply from stage "${customer.stage}"` });
    const { reaction } = req.body || {};
    if (reaction !== 'positive' && reaction !== 'negative') return res.status(400).json({ error: 'reaction must be "positive" or "negative"' });
    const { data: reqs } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
    if (reqs?.[0]) await supabase.from('requests').update({ reaction }).eq('id', reqs[0].id);
    await supabase.from('customers').update({ sentiment: reaction, reacted_at: now, stage: reaction }).eq('id', id);
    if (reaction === 'negative') {
      const { data: existing } = await supabase.from('feedback').select('*').eq('customer_id', id).single();
      if (!existing) await supabase.from('feedback').insert({ id: `fb_${customer.id}`, business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, complaint: customer.complaint || '', created_at: now });
      await supabase.from('activities').insert({ id: generateId('act'), business_id: business.id, type: 'negative_reply', customer_name: customer.name, phone: customer.phone, message: `Sorry. Tell us: ${business.feedback_link || ''}`, status: 'Negative' });
    } else {
      await supabase.from('activities').insert({ id: generateId('act'), business_id: business.id, type: 'positive_reply', customer_name: customer.name, phone: customer.phone, message: `Review: ${business.google_review_link || ''}`, status: 'Positive' });
    }
    return res.json({ customer: { id, stage: reaction, sentiment: reaction } });
  }

  if (action === 'review') {
    if (customer.stage !== 'positive') return res.status(400).json({ error: `Cannot review from stage "${customer.stage}"` });
    const { data: reqs } = await supabase.from('requests').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1);
    if (reqs?.[0]) await supabase.from('requests').update({ status: 'Reviewed', reviewed_at: now }).eq('id', reqs[0].id);
    await supabase.from('customers').update({ stage: 'reviewed', reviewed_google_at: now, last_request_status: 'Reviewed' }).eq('id', id);
    const { data: existing } = await supabase.from('reviews').select('*').eq('customer_id', id).single();
    if (!existing) {
      await supabase.from('reviews').insert({ id: `rev_${customer.id}`, business_id: business.id, customer_id: id, customer_name: customer.name, rating: 5, request_id: reqs?.[0]?.id || null, sent_at: reqs?.[0]?.sent_at || null, created_at: now });
      const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
      await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id);
      return res.json({ customer: { id, stage: 'reviewed' }, reviewsReceived: count });
    }
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    return res.json({ customer: { id, stage: 'reviewed' }, reviewsReceived: count });
  }

  if (action === 'feedback') {
    if (customer.stage !== 'negative') return res.status(400).json({ error: `Cannot submit feedback from stage "${customer.stage}"` });
    const { complaint } = req.body || {};
    const text = (complaint && String(complaint).trim()) || customer.complaint || '';
    const { data: existing } = await supabase.from('feedback').select('*').eq('customer_id', id).single();
    if (!existing) await supabase.from('feedback').insert({ id: `fb_${customer.id}`, business_id: business.id, customer_id: id, customer_name: customer.name, phone: customer.phone, complaint: text, created_at: now, submitted_at: now });
    else await supabase.from('feedback').update({ complaint: text, submitted_at: now }).eq('id', existing.id);
    await supabase.from('customers').update({ complaint: text }).eq('id', id);
    return res.json({ feedback: { complaint: text }, customer: { id, stage: 'negative' } });
  }

  if (action === 'reset') {
    await supabase.from('customers').update({ stage: 'to_send', sentiment: null, complaint: '', reacted_at: null, reviewed_google_at: null }).eq('id', id);
    await supabase.from('feedback').delete().eq('customer_id', id);
    const { data: oldRev } = await supabase.from('reviews').select('*').eq('customer_id', id);
    await supabase.from('reviews').delete().eq('customer_id', id);
    if (oldRev?.length) { const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id); await supabase.from('businesses').update({ reviews_received: count }).eq('id', business.id); }
    const { data: reqs } = await supabase.from('requests').select('*').eq('customer_id', id);
    for (const r of (reqs || [])) await supabase.from('requests').update({ status: 'Scheduled', reaction: null, opened_at: null, reviewed_at: null }).eq('id', r.id);
    const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('business_id', business.id);
    return res.json({ customer: { id, stage: 'to_send' }, reviewsReceived: count });
  }

  res.status(404).json({ error: `Unknown action: ${action}` });
}
