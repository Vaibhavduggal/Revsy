import { getDb, getBusiness, mapBusiness, mapSession, mapAdminSession, mapAdmin } from './db.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

async function findSession(token) {
  const db = getDb();
  const { data } = await db
    .from('sessions')
    .select('*')
    .eq('token', token)
    .single();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > SESSION_TTL_MS) return null;
  return mapSession(data);
}

async function findAdminSession(token) {
  const db = getDb();
  const { data } = await db
    .from('admin_sessions')
    .select('*')
    .eq('token', token)
    .single();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > SESSION_TTL_MS) return null;
  return mapAdminSession(data);
}

export async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const session = await findSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const business = await getBusiness(session.businessId);
  if (!business) return res.status(401).json({ error: 'Unauthorized' });
  req.business = business;
  next();
}

export async function adminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const session = await findAdminSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const { data } = await db
    .from('admins')
    .select('*')
    .eq('id', session.adminId)
    .single();
  if (!data) return res.status(401).json({ error: 'Unauthorized' });
  req.admin = mapAdmin(data);
  next();
}

export async function recordActivity(businessId, activity) {
  const db = getDb();
  const entry = {
    id: `act_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    business_id: businessId,
    created_at: new Date().toISOString(),
    type: activity.type,
    customer_name: activity.customerName,
    phone: activity.phone,
    message: activity.message,
    status: activity.status,
  };
  await db.from('activities').insert(entry);
  return entry;
}

export function publicBusiness(b) {
  const { passwordHash, whatsapp, googleAccessToken, googleRefreshToken, ...rest } = b;
  return {
    ...rest,
    whatsapp: {
      bsp: whatsapp?.bsp || '',
      status: whatsapp?.status || 'not_connected',
      phoneNumberId: whatsapp?.phoneNumberId ? 'set' : '',
      campaignName: whatsapp?.campaignName || '',
    },
  };
}

export { getDb };
