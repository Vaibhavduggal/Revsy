// Starter tone presets, kept in sync with the backend MESSAGE_PRESETS.
export const MESSAGE_PRESETS = [
  {
    id: 'casual',
    label: 'Casual',
    template: 'Hey [customer name]! Hope you enjoyed [business name] today 😄 Drop us a quick Google review if you can: [google review link]',
  },
  {
    id: 'warm',
    label: 'Warm / Thankful',
    template: 'Hi [customer name], thank you so much for visiting [business name]! We would be grateful if you shared your experience: [google review link]',
  },
  {
    id: 'first_time',
    label: 'First-time visitor',
    template: 'Welcome to [business name], [customer name]! We hope it was love at first bite. If so, a 30-second Google review would mean the world: [google review link]',
  },
];

// Render a template with the same placeholders the backend uses.
export function renderTemplate(template, { customerName, businessName, reviewLink }) {
  return String(template)
    .replaceAll('[customer name]', customerName)
    .replaceAll('[business name]', businessName)
    .replaceAll('[google review link]', reviewLink);
}

export const TEMPLATE_VARS = '[customer name], [business name], [google review link]';
