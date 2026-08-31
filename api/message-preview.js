import { supabase } from '../_lib/supabase.js';
import { auth, cors } from '../_lib/auth.js';

function renderTemplate(template, vars) {
  return String(template).replaceAll('[customer name]', vars.customerName).replaceAll('[business name]', vars.businessName).replaceAll('[google review link]', vars.reviewLink);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const business = await auth(req, res);
  if (!business) return;

  const message = renderTemplate(business.message_template || business.messageTemplate, {
    customerName: 'Rahul Sharma', businessName: business.name, reviewLink: business.google_review_link || business.googleReviewLink,
  });
  res.json({ message, effectiveDelay: business.demo_mode ? 10 : (business.delay_seconds || business.delaySeconds || 7200) });
}
