// Single source of truth for the review-pipeline stages shown on the kanban board.
export const STAGES = [
  { id: 'to_send', label: 'To Send', hint: 'Awaiting first outreach' },
  { id: 'sent', label: 'Sent', hint: 'Message delivered' },
  { id: 'opened', label: 'Opened', hint: 'Awaiting 😊 or 😞' },
  { id: 'positive', label: 'Positive', hint: 'Replied 😊 — suggestion or Google ask' },
  { id: 'negative', label: 'Negative', hint: 'Replied 😞 — private complaint' },
  { id: 'reviewed', label: 'Reviewed on Google', hint: 'Left a public review' },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

export function stageLabel(id) {
  return STAGES.find((s) => s.id === id)?.label || id;
}

// What action the owner can take on a card in demo mode, and the API call to make.
export const NEXT_ACTION = {
  to_send: { verb: 'Send', api: 'send' },
  sent: { verb: 'Mark opened', api: 'open' },
  opened: { verb: 'Await reply', api: 'reply' },
  positive: { verb: 'Mark reviewed', api: 'review' },
  negative: { verb: 'Log feedback', api: 'feedback' },
  reviewed: { verb: 'Done', api: null },
};
