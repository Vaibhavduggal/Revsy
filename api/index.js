import { getApp } from '../server/src/app.js';

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
