import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import router from './routes.js';

let appInstance = null;

export async function getApp() {
  if (appInstance) return appInstance;
  await initDb();
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', router);
  appInstance = app;
  return app;
}
