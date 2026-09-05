export const CATEGORIES = ['gym', 'restaurant'];

export const CATEGORY_COPY = {
  restaurant: {
    category: 'restaurant',
    categoryLabel: 'Restaurant',
    person: 'customer',
    personPlural: 'customers',
    personTitle: 'Customer',
    personPluralTitle: 'Customers',
    visit: 'visit',
    visitGerund: 'visiting',
    visitPast: 'visited',
    session: 'table',
    firstVisit: 'first-time visitor',
    firstVisitFlavor: 'We hope it was love at first bite.',
    suggestionsTitle: 'Customer Suggestions',
    suggestionsSub: 'Happy customers who still have an idea — not a complaint.',
    complaintsTitle: 'Private Complaints',
    complaintsSub: 'Unhappy customers. Owner-only, never sent to Google.',
    addPerson: 'Add customer',
    quickAddTitle: 'Quick add customer',
    searchPlaceholder: 'Search customers…',
    pipelineSub: 'Review pipeline · from first message to a Google review',
    delayAfterAdd: 'after a customer is added',
    importTitle: 'Import customers (CSV)',
    awaitingReply: 'Opened — awaiting 😊 or 😞',
    dashboardSub: 'review requests, Google sync, and AI issue tracking',
    locationPick: 'Pick the location Revsy should track.',
    approvalWait: 'The Revsy platform owner still needs to approve your business before WhatsApp setup unlocks.',
  },
  gym: {
    category: 'gym',
    categoryLabel: 'Gym',
    person: 'member',
    personPlural: 'members',
    personTitle: 'Member',
    personPluralTitle: 'Members',
    visit: 'workout',
    visitGerund: 'working out at',
    visitPast: 'worked out at',
    session: 'session',
    firstVisit: 'new member',
    firstVisitFlavor: 'We hope the first session felt great.',
    suggestionsTitle: 'Member Suggestions',
    suggestionsSub: 'Happy members who still have an idea — not a complaint.',
    complaintsTitle: 'Private Complaints',
    complaintsSub: 'Unhappy members. Owner-only, never sent to Google.',
    addPerson: 'Add member',
    quickAddTitle: 'Quick add member',
    searchPlaceholder: 'Search members…',
    pipelineSub: 'Review pipeline · from first message to a Google review',
    delayAfterAdd: 'after a member is added',
    importTitle: 'Import members (CSV)',
    awaitingReply: 'Opened — awaiting 😊 or 😞',
    dashboardSub: 'review requests, Google sync, and AI issue tracking',
    locationPick: 'Pick the gym location Revsy should track.',
    approvalWait: 'The Revsy platform owner still needs to approve your gym before WhatsApp setup unlocks.',
  },
};

export function normalizeCategory(value) {
  const v = String(value || '').trim().toLowerCase();
  return CATEGORIES.includes(v) ? v : 'restaurant';
}

export function getCopy(category) {
  return CATEGORY_COPY[normalizeCategory(category)] || CATEGORY_COPY.restaurant;
}

export function sentimentGateMessage(copy, { name, businessName }) {
  const who = name || 'there';
  const biz = businessName || 'us';
  return `Hi ${who}, thanks for ${copy.visitGerund} ${biz} today! How was your experience? 😊 or 😞\nReply 1 for 😊, 2 for 😞`;
}

export function defaultTemplateFor(category) {
  const copy = getCopy(category);
  return `Hi [customer name], thanks for ${copy.visitGerund} [business name] today! How was your experience? 😊 or 😞\nReply 1 for 😊, 2 for 😞`;
}

export function messagePresetsFor(category) {
  const copy = getCopy(category);
  return [
    {
      id: 'casual',
      label: 'Casual',
      template: `Hey [customer name]! Thanks for ${copy.visitGerund} [business name] today 😄 How was it? 😊 or 😞\nReply 1 for 😊, 2 for 😞`,
    },
    {
      id: 'warm',
      label: 'Warm / Thankful',
      template: sentimentGateMessage(copy, { name: '[customer name]', businessName: '[business name]' }),
    },
    {
      id: 'first_time',
      label: copy.firstVisit[0].toUpperCase() + copy.firstVisit.slice(1),
      template: `Welcome to [business name], [customer name]! ${copy.firstVisitFlavor} How was your experience? 😊 or 😞\nReply 1 for 😊, 2 for 😞`,
    },
  ];
}
