import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { getApp } from './app.js';
import { resumeScheduledSends } from './routes.js';
import { startSendPoller, resumePendingSends } from './queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const PORT = process.env.PORT || 4000;

async function main() {
  const app = await getApp();

  const distPath = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log('API server running on http://localhost:' + PORT);
    resumeScheduledSends();
    resumePendingSends();
    startSendPoller(60000);
    global.__reviewbotPollNow = () => {};
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
