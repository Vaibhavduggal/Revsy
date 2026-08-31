import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  const { data: reqs } = await supabase.from('requests').select('*').eq('business_id', business.id);
  const { data: reviews } = await supabase.from('reviews').select('*').eq('business_id', business.id);
  const { data: customers } = await supabase.from('customers').select('*').eq('business_id', business.id);
  const { data: feedback } = await supabase.from('feedback').select('*').eq('business_id', business.id);

  const now = new Date();
  const thisMonth = now.getMonth(), thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const reviewsThisMonth = (reviews || []).filter(r => { const d = new Date(r.created_at); return d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).length;
  const reviewsLastMonth = (reviews || []).filter(r => { const d = new Date(r.created_at); return d.getFullYear() === lastYear && d.getMonth() === lastMonth; }).length;
  const momPct = reviewsLastMonth ? Math.round(((reviewsThisMonth - reviewsLastMonth) / reviewsLastMonth) * 1000) / 10 : (reviewsThisMonth ? 100 : 0);

  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const count = (reviews || []).filter(r => { const d = new Date(r.created_at); return d >= weekStart && d < upper; }).length;
    weeks.push({ label: `W${12 - i}`, count });
  }

  const dow = [0, 0, 0, 0, 0, 0, 0];
  (reviews || []).forEach(r => dow[new Date(r.created_at).getDay()]++);

  const linked = (reviews || []).filter(r => r.sent_at && r.created_at);
  let avgTimeToReview = null;
  if (linked.length) { const totalMs = linked.reduce((sum, r) => sum + (new Date(r.created_at) - new Date(r.sent_at)), 0); avgTimeToReview = Math.round(totalMs / linked.length / 3600000); }

  const sent = (reqs || []).filter(r => r.status !== 'Scheduled').length;
  const opened = (reqs || []).filter(r => r.status === 'Opened' || r.status === 'Reviewed').length;
  const reviewed = (reviews || []).length;
  const funnel = { sent, opened, reviewed, sentToOpenedPct: sent ? Math.round((opened / sent) * 1000) / 10 : 0, openedToReviewedPct: opened ? Math.round((reviewed / opened) * 1000) / 10 : 0, sentToReviewedPct: sent ? Math.round((reviewed / sent) * 1000) / 10 : 0 };

  const positives = (customers || []).filter(c => c.sentiment === 'positive').length;
  const negatives = (customers || []).filter(c => c.sentiment === 'negative').length;
  const totalReacted = positives + negatives;
  const positiveRate = totalReacted ? Math.round((positives / totalReacted) * 1000) / 10 : 0;

  const sentimentWeeks = [];
  for (let i = 11; i >= 0; i--) {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
    const upper = i === 0 ? now : weekEnd;
    const pos = (customers || []).filter(c => { if (c.sentiment !== 'positive') return false; const d = new Date(c.reacted_at || c.created_at); return d >= weekStart && d < upper; }).length;
    const neg = (customers || []).filter(c => { if (c.sentiment !== 'negative') return false; const d = new Date(c.reacted_at || c.created_at); return d >= weekStart && d < upper; }).length;
    const tot = pos + neg;
    sentimentWeeks.push({ label: `W${12 - i}`, positive: pos, negative: neg, rate: tot ? Math.round((pos / tot) * 1000) / 10 : null });
  }

  const keptOffGoogleThisMonth = (feedback || []).filter(f => { const d = new Date(f.created_at); return d.getFullYear() === thisYear && d.getMonth() === thisMonth; }).length;
  const recentFeedback = (feedback || []).slice(0, 8).map(f => ({ id: f.id, customerName: f.customer_name, phone: f.phone, complaint: f.complaint, date: f.created_at }));

  res.json({ total: reviewed, reviewsThisMonth, reviewsLastMonth, momPct, weeks, dow, dowLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], avgTimeToReview, funnel, sentiment: { positives, negatives, totalReacted, positiveRate, weeks: sentimentWeeks, keptOffGoogleThisMonth, recentFeedback } });
}
