import { getDb, getBusiness } from './db.js';

// Real session-based auth: /login and /admin/login issue a random opaque token that
// is stored server-side in db.data.sessions / db.data.adminSessions, mapped to the
// business/admin id. Requests are only authenticated if the token matches a live
// session row — a client can no longer "log in" simply by sending a business id.
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function findSession(db, token) {
  const row = db.data.sessions.find((s) => s.token === token);
  if (!row) return null;
  if (Date.now() - new Date(row.createdAt).getTime() > SESSION_TTL_MS) return null;
  return row;
}
function findAdminSession(db, token) {
  const row = db.data.adminSessions.find((s) => s.token === token);
  if (!row) return null;
  if (Date.now() - new Date(row.createdAt).getTime() > SESSION_TTL_MS) return null;
  return row;
}

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const session = findSession(db, token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const business = getBusiness(session.businessId);
  if (!business) return res.status(401).json({ error: 'Unauthorized' });
  req.business = business;
  next();
}

export function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const session = findAdminSession(db, token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const admin = db.data.admins.find((a) => a.id === session.adminId);
  if (!admin) return res.status(401).json({ error: 'Unauthorized' });
  req.admin = admin;
  next();
}

export async function recordActivity(db, businessId, activity) {
  const entry = {
    id: `act_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    businessId,
    createdAt: new Date().toISOString(),
    ...activity,
  };
  db.data.activities.unshift(entry);
  if (db.data.activities.length > 200) db.data.activities.length = 200;
  await db.write();
  return entry;
}

export function publicBusiness(b) {
  const { passwordHash, whatsapp, ...rest } = b;
  // Never leak the WhatsApp API key to the client bundle; expose only connection status.
  return { ...rest, whatsapp: { bsp: whatsapp?.bsp || '', status: whatsapp?.status || 'not_connected' } };
}

export { getDb };
