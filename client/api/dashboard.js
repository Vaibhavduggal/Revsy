import { supabase, auth, cors } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  const { data: reqs } = await supabase.from('requests').select('*').eq('business_id', business.id);
  const { data: reviews } = await supabase.from('reviews').select('*').eq('business_id', business.id);
  const { data: customers } = await supabase.from('customers').select('*').eq('business_id', business.id);
  const { data: activities } = await supabase.from('activities').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(10);
  const { data: failedSends } = await supabase.from('pending_sends').select('*').eq('business_id', business.id).eq('status', 'failed');

  const sent = (reqs || []).filter(r => r.status !== 'Scheduled').length;
  const received = business.reviews_received || 0;
  const weekly = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now); end.setDate(end.getDate() - i * 7); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 7);
    weekly.push({ label: `W${8 - i}`, count: (reqs || []).filter(r => { const d = new Date(r.created_at); return d >= start && d < end; }).length });
  }

  res.json({
    stats: { totalSent: sent, totalReceived: received, conversionRate: sent ? Math.round((received / sent) * 1000) / 10 : 0 },
    weekly,
    recent: (reqs || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10).map(r => {
      const cust = (customers || []).find(c => c.id === r.customer_id);
      return { id: r.id, customerName: r.customer_name, phone: r.phone, status: r.status, reaction: r.reaction || null, hasCustomMessage: !!(cust && cust.custom_message && cust.custom_message.trim()), createdAt: r.created_at };
    }),
    failedSends: (failedSends || []).map(s => ({ id: s.id, customerId: s.customer_id, customerName: (customers || []).find(c => c.id === s.customer_id)?.name || s.phone, phone: s.phone, error: s.error, retryCount: s.retry_count })),
  });
}
