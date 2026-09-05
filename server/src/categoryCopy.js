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
    aiPromptKind: 'restaurant',
    logoEmoji: '🍽️',
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
    aiPromptKind: 'gym',
    logoEmoji: '🏋️',
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

export function defaultMessageTemplates(category) {
  return {
    gate: `Hi {{customer_name}}! Thanks for {{visit_verb}} {{business_name}} today 🙏 How was your experience?\n\n😊 Great!\n😞 Not great`,
    happyFollowup:
      'Awesome to hear! Got any suggestions for us, or should we just say thanks? 🙌\nReply "nothing, you\'re awesome" or tell us what you\'d like to see improved.',
    googleAsk:
      'That means a lot to us! Would you mind dropping us a quick Google review? It takes less than a minute and really helps us out 🙏\n{{google_review_link}}',
    sadFollowup:
      'Sorry to hear that. Please tell us what went wrong so we can make it right — this goes straight to the owner, not anywhere public.',
  };
}

export function defaultTemplateFor(category) {
  return defaultMessageTemplates(category).gate;
}

export function resolveMessageTemplates(business) {
  const defaults = defaultMessageTemplates(business?.category);
  const stored = business?.messageTemplates && typeof business.messageTemplates === 'object'
    ? business.messageTemplates
    : {};
  const gate = (business?.messageTemplate && String(business.messageTemplate).trim())
    || (stored.gate && String(stored.gate).trim())
    || defaults.gate;
  return {
    gate,
    happyFollowup: (stored.happyFollowup && String(stored.happyFollowup).trim()) || defaults.happyFollowup,
    googleAsk: (stored.googleAsk && String(stored.googleAsk).trim()) || defaults.googleAsk,
    sadFollowup: (stored.sadFollowup && String(stored.sadFollowup).trim()) || defaults.sadFollowup,
  };
}

export function renderBusinessTemplate(template, business, customer) {
  const copy = getCopy(business?.category);
  const name = customer?.name || 'there';
  const biz = business?.name || 'us';
  const link = business?.googleReviewLink || '';
  const verb = copy.visitGerund;
  return String(template || '')
    .replaceAll('{{customer_name}}', name)
    .replaceAll('{{business_name}}', biz)
    .replaceAll('{{google_review_link}}', link)
    .replaceAll('{{visit_verb}}', verb)
    .replaceAll('[customer name]', name)
    .replaceAll('[business name]', biz)
    .replaceAll('[google review link]', link);
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

export const SUGGESTION_THANKS = "Thanks, we'll take a look! 🙏";

/** @deprecated use resolveMessageTemplates(business).happyFollowup */
export const HAPPY_FOLLOWUP = defaultMessageTemplates('restaurant').happyFollowup;

/** @deprecated use resolveMessageTemplates(business).sadFollowup */
export const SAD_FOLLOWUP = defaultMessageTemplates('restaurant').sadFollowup;

/** @deprecated use renderBusinessTemplate(templates.googleAsk, business, customer) */
export function googleReviewAsk(link) {
  return defaultMessageTemplates('restaurant').googleAsk.replace('{{google_review_link}}', link || '').trim();
}
