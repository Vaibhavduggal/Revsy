import { getCopy, messagePresetsFor } from './categoryCopy.js';

export const MESSAGE_PRESETS = messagePresetsFor('restaurant');
export function presetsFor(category) {
  return messagePresetsFor(category);
}

export function renderTemplate(template, { customerName, businessName, reviewLink, category }) {
  const copy = getCopy(category);
  const name = customerName || 'there';
  const biz = businessName || 'us';
  const link = reviewLink || '';
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

export const TEMPLATE_VARS = '{{customer_name}}, {{business_name}}, {{visit_verb}}, {{google_review_link}}';
