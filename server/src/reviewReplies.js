import { getDb } from './db.js';
import { postGoogleReviewReply } from './google.js';
import { resolveMessageTemplates, renderBusinessTemplate } from './categoryCopy.js';

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function logReplyAudit(db, payload) {
  await db.from('review_reply_audit').insert({
    id: newId('rpa'),
    business_id: payload.businessId,
    review_id: payload.reviewId,
    action: payload.action,
    template_key: payload.templateKey || null,
    reply_text: payload.replyText || '',
    google_review_id: payload.googleReviewId || null,
    success: !!payload.success,
    error_message: payload.errorMessage || null,
    posted_at: new Date().toISOString(),
  });
}

export async function postReviewReplyIfGoogle(business, reviewRow, replyText, templateKey, action) {
  const db = getDb();
  let googlePosted = false;
  let googleError = null;

  if (reviewRow.source === 'google' && business.googleConnected && !business.isDemo && reviewRow.google_review_id) {
    try {
      await postGoogleReviewReply(business, reviewRow.google_review_id, replyText);
      googlePosted = true;
    } catch (e) {
      googleError = e.message;
      console.error('Google review reply failed:', e.message);
    }
  }

  const updates = { is_read: true };
  if (googlePosted) {
    updates.google_reply_posted_at = new Date().toISOString();
    updates.google_reply_text = replyText;
  }
  await db.from('reviews').update(updates).eq('id', reviewRow.id).eq('business_id', business.id);

  await logReplyAudit(db, {
    businessId: business.id,
    reviewId: reviewRow.id,
    action,
    templateKey,
    replyText,
    googleReviewId: reviewRow.google_review_id,
    success: googlePosted || reviewRow.source !== 'google' || business.isDemo,
    errorMessage: googleError,
  });

  return { googlePosted, googleError };
}

/** Auto-post customizable thank-you on new positive Google reviews. */
export async function autoThankPositiveGoogleReview(business, reviewRow) {
  if (!reviewRow || (reviewRow.rating || 5) < 4) return { skipped: true };
  if (reviewRow.suspected_fake) return { skipped: true };
  if (reviewRow.google_reply_posted_at) return { skipped: true, alreadyPosted: true, googlePosted: true };

  const templates = resolveMessageTemplates(business);
  const replyText = renderBusinessTemplate(templates.positiveReply, business, {
    name: reviewRow.customer_name || 'there',
  });

  return postReviewReplyIfGoogle(business, reviewRow, replyText, 'positiveReply', 'positive_reply_auto');
}
