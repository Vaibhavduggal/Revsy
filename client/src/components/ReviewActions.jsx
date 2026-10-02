/** Shared review action buttons for dashboard and reviews list. */
export default function ReviewActions({
  review,
  negative,
  googleReportUrl,
  busy,
  onMarkRead,
  onAcknowledge,
  onFlagFake,
  onRetryThankYou,
}) {
  const unread = review.isRead === false;
  const isGoogle = review.source === 'google' && review.id && !String(review.id).startsWith('fb_');
  const positive = !negative && (review.rating || 5) >= 4;

  if (review.suspectedFake) {
    return (
      <div className="review-actions">
        <span className="badge warn sm">Suspected fake</span>
        {googleReportUrl && (
          <a className="btn secondary sm touch-target" href={googleReportUrl} target="_blank" rel="noopener noreferrer">
            Report to Google
          </a>
        )}
      </div>
    );
  }

  if (positive && isGoogle && review.googleReplyPostedAt) {
    return <span className="csv-hint">Thank-you sent on Google</span>;
  }

  if (!unread || !review.id || String(review.id).startsWith('fb_')) {
    if (review.googleReplyPostedAt) {
      return <span className="csv-hint">Thank-you sent on Google</span>;
    }
    return null;
  }

  if (positive && isGoogle) {
    return (
      <div className="review-actions">
        {!review.googleReplyPostedAt && onRetryThankYou && (
          <button type="button" className="btn sm touch-target" disabled={busy} onClick={() => onRetryThankYou(review.id)}>
            Retry thank-you
          </button>
        )}
        <button type="button" className="btn ghost sm touch-target" disabled={busy} onClick={() => onMarkRead(review.id)}>
          Dismiss
        </button>
      </div>
    );
  }

  if (negative && isGoogle) {
    return (
      <div className="review-actions">
        <button type="button" className="btn sm touch-target" disabled={busy} onClick={() => onAcknowledge(review.id)}>
          Acknowledge
        </button>
        <button type="button" className="btn secondary sm touch-target" disabled={busy} onClick={() => onFlagFake(review.id)}>
          Flag fake
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="btn ghost sm touch-target" disabled={busy} onClick={() => onMarkRead(review.id)}>
      Dismiss
    </button>
  );
}
