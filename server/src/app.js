import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import router from './routes.js';
import { apiRateLimiter, buildCorsOptions, securityHeaders } from './securityMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let appInstance = null;

export async function getApp() {
  if (appInstance) return appInstance;
  await initDb();
  const app = express();
  app.disable('x-powered-by');
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    app.set('trust proxy', 1);
  }
  app.use(securityHeaders);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '64kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', apiRateLimiter, router);
  appInstance = app;
  return app;
}
