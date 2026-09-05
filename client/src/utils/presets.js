import { getCopy, messagePresetsFor } from './categoryCopy.js';

export const MESSAGE_PRESETS = messagePresetsFor('restaurant');
export function presetsFor(category) {
  return messagePresetsFor(category);
}

export function renderTemplate(template, { customerName, businessName, reviewLink }) {
  return String(template)
    .replaceAll('[customer name]', customerName)
    .replaceAll('[business name]', businessName)
    .replaceAll('[google review link]', reviewLink);
}

export const TEMPLATE_VARS = '[customer name], [business name], [google review link]';
