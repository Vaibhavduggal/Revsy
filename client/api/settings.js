import { supabase, auth, cors } from './_lib.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const business = await auth(req, res);
  if (!business) return;

  if (req.method === 'GET') {
    return res.json({ businessName: business.name, googleReviewLink: business.google_review_link || business.googleReviewLink, feedbackLink: business.feedback_link || business.feedbackLink, messageTemplate: business.message_template || business.messageTemplate, delaySeconds: business.delay_seconds || business.delaySeconds, demoMode: business.demo_mode || business.demoMode, reviewsReceived: business.reviews_received || 0 });
  }
  if (req.method === 'PUT') {
    const { businessName, googleReviewLink, feedbackLink, messageTemplate, delaySeconds, demoMode, googlePlaceId } = req.body || {};
    const updates = {};
    if (typeof businessName === 'string' && businessName.trim()) updates.name = businessName.trim();
    if (typeof googleReviewLink === 'string') updates.google_review_link = googleReviewLink.trim();
    if (typeof feedbackLink === 'string') updates.feedback_link = feedbackLink.trim();
    if (typeof messageTemplate === 'string' && messageTemplate.trim()) updates.message_template = messageTemplate.trim();
    if (Number.isFinite(Number(delaySeconds))) updates.delay_seconds = Number(delaySeconds);
    if (typeof demoMode === 'boolean') updates.demo_mode = demoMode;
    if (typeof googlePlaceId === 'string') updates.google_place_id = googlePlaceId.trim();
    await supabase.from('businesses').update(updates).eq('id', business.id);
    return res.json({ businessName: updates.name || business.name, ...updates });
  }
  res.status(405).json({ error: 'Method not allowed' });
}
