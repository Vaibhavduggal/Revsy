/** Shared review action buttons for dashboard and reviews list. */
export default function ReviewActions({
  review,
  negative,
  googleReportUrl,
  busy,
  onMarkRead,
  onAcknowledge,
  onFlagFake,
}) {
  const unread = review.isRead === false;
  const isGoogle = review.source === 'google' && review.id && !String(review.id).startsWith('fb_');

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

  if (!unread || !review.id || String(review.id).startsWith('fb_')) {
    if (review.googleReplyPostedAt) {
      return <span className="csv-hint">Replied on Google</span>;
    }
    return null;
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
      Mark read{isGoogle ? ' & reply' : ''}
    </button>
  );
}
