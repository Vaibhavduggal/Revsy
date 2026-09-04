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
  signup: (email, password, businessName) => request('POST', '/signup', { email, password, businessName }),
  logout: () => request('POST', '/logout'),
  onboardingStatus: () => request('GET', '/onboarding/status'),
  onboardingWhatsapp: (apiKey, phoneNumberId, extra = {}) => request('POST', '/onboarding/whatsapp', { apiKey, phoneNumberId, ...extra }),
  googleLocations: () => request('GET', '/onboarding/google/locations'),
  selectGoogleLocation: (payload) => request('POST', '/onboarding/google/location', payload),
  onboardingComplete: () => request('POST', '/onboarding/complete'),
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
  reviewsAll: (page) => request('GET', `/reviews/all?page=${page||1}`),
  markReviewRead: (id) => request('POST', `/reviews/${id}/read`),
  summaries: () => request('GET', '/reviews/summaries'),
  markSummaryRead: (id) => request('POST', `/reviews/summaries/${id}/read`),
  markIssueRead: (issueId) => request('POST', `/reviews/summaries/issues/${issueId}/read`),
};

export const adminApi = {
  login: (email, password) => adminRequest('POST', '/admin/login', { email, password }),
  logout: () => adminRequest('POST', '/admin/logout'),
  businesses: () => adminRequest('GET', '/admin/businesses'),
  addBusiness: (payload) => adminRequest('POST', '/admin/businesses', payload),
  removeBusiness: (id) => adminRequest('DELETE', `/admin/businesses/${id}`),
  onboardWhatsapp: (id, payload) => adminRequest('PUT', `/admin/businesses/${id}/whatsapp`, payload),
  setGoogle: (id, payload) => adminRequest('PUT', `/admin/businesses/${id}/google`, payload),
  invites: () => adminRequest('GET', '/admin/invites'),
  invite: (email, businessName) => adminRequest('POST', '/admin/invites', { email, businessName }),
  requests: () => adminRequest('GET', '/admin/requests'),
  approve: (id) => adminRequest('POST', `/admin/businesses/${id}/approve`),
  reject: (id) => adminRequest('POST', `/admin/businesses/${id}/reject`),
};