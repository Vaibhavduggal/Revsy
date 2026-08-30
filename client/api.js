const TOKEN_KEY = 'reviewbot_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  // Use base URL from environment variable, default to /api for development
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE || '/api';
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (email, password) => request('POST', '/login', { email, password }),
  dashboard: () => request('GET', '/dashboard'),
  customers: () => request('GET', '/customers'),
  customer: (id) => request('GET', `/customers/${id}`),
  addCustomer: (name, phone) => request('POST', '/customers', { name, phone }),
  importCustomers: (customers) => request('POST', '/customers/import', { customers }),
  updateCustomer: (id, fields) => request('PUT', `/customers/${id}`, fields),
  sendNow: (id) => request('POST', `/customers/${id}/send`),
  openCustomer: (id) => request('POST', `/customers/${id}/open`),
  replyCustomer: (id, reaction) => request('POST', `/customers/${id}/reply`, { reaction }),
  reviewCustomer: (id) => request('POST', `/customers/${id}/review`),
  feedbackCustomer: (id, payload) => request('POST', `/customers/${id}/feedback`, payload),
  resetCustomer: (id) => request('POST', `/customers/${id}/reset`),
  renderMessage: (payload) => request('POST', '/render', payload),
  feedback: () => request('GET', '/feedback'),
  activity: () => request('GET', '/activity'),
  settings: () => request('GET', '/settings'),
  updateSettings: (s) => request('PUT', '/settings', s),
  messagePreview: () => request('GET', '/message-preview'),
  reviews: () => request('GET', '/reviews'),
  addReview: (payload) => request('POST', '/reviews', payload),
  removeLastReview: () => request('DELETE', '/reviews/last'),
  incrementReviews: () => request('POST', '/reviews/increment'),
  decrementReviews: () => request('POST', '/reviews/decrement'),
  analytics: () => request('GET', '/analytics'),
  adminBusinesses: () => request('GET', '/admin/businesses'),
  adminLogin: (email, password) => request('POST', '/admin/login', { email, password }),
  syncGoogleReviews: (payload) => request('POST', '/sync-google-reviews', payload),
  resetDb: () => request('POST', '/reset-db'),
  failedSends: () => request('GET', '/pending-sends/failed'),
  retrySend: (id) => request('POST', `/pending-sends/${id}/retry`),
};