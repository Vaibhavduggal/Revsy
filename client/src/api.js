export function getToken() {
  return localStorage.getItem('reviewbot_token');
}
export function setToken(t) {
  if (t) localStorage.setItem('reviewbot_token', t);
  else localStorage.removeItem('reviewbot_token');
}
export function getAdminToken() {
  return localStorage.getItem('reviewbot_admin_token');
}
export function setAdminToken(t) {
  if (t) localStorage.setItem('reviewbot_admin_token', t);
  else localStorage.removeItem('reviewbot_admin_token');
}

const API_BASE = import.meta.env.VITE_API_URL || '';

async function baseRequest(method, path, body, tokenGetter) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api${path}`, {
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

const request = (method, path, body) => baseRequest(method, path, body, getToken);
const adminRequest = (method, path, body) => baseRequest(method, path, body, getAdminToken);

export const api = {
  login: (email, password) => request('POST', '/login', { email, password }),
  demoLogin: () => request('POST', '/login/demo'),
  logout: () => request('POST', '/logout'),
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
  reviewsList: () => request('GET', '/reviews/list'),
  syncGoogleReviews: () => request('POST', '/reviews/google/sync'),
  addReview: (payload) => request('POST', '/reviews', payload),
  removeLastReview: () => request('DELETE', '/reviews/last'),
  incrementReviews: () => request('POST', '/reviews/increment'),
  decrementReviews: () => request('POST', '/reviews/decrement'),
  analytics: () => request('GET', '/analytics'),
  resetDb: () => request('POST', '/reset-db'),
  failedSends: () => request('GET', '/pending-sends/failed'),
  retrySend: (id) => request('POST', `/pending-sends/${id}/retry`),
};

export const adminApi = {
  login: (email, password) => adminRequest('POST', '/admin/login', { email, password }),
  logout: () => adminRequest('POST', '/admin/logout'),
  businesses: () => adminRequest('GET', '/admin/businesses'),
  addBusiness: (payload) => adminRequest('POST', '/admin/businesses', payload),
  removeBusiness: (id) => adminRequest('DELETE', `/admin/businesses/${id}`),
  onboardWhatsapp: (id, payload) => adminRequest('PUT', `/admin/businesses/${id}/whatsapp`, payload),
  setGoogle: (id, payload) => adminRequest('PUT', `/admin/businesses/${id}/google`, payload),
};