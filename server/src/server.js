import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import router, { resumeScheduledSends } from './routes.js';
import { startSendPoller, resumePendingSends } from './queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const PORT = process.env.PORT || 4000;

async function main() {
  await initDb();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', router);

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
    global.__reviewbotPollNow = () => {
      // Poller nudge - the poller itself handles processing
    };
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
