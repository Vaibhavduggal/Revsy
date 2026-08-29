import { getDb, getBusiness } from './db.js';

// Demo auth: the client stores the business id in localStorage and sends it as a
// Bearer token. This is intentionally simple for a local pitch demo, but every
// route is scoped by businessId so multi-tenant support can be layered on later.
export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const business = getBusiness(token);
  if (!business) return res.status(401).json({ error: 'Unauthorized' });
  req.business = business;
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
  const { password, ...rest } = b;
  return rest;
}

export { getDb };
