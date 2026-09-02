import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb } from './db.js';
import router, { resumeScheduledSends } from './routes.js';
import { startSendPoller, resumePendingSends } from './queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
      const db = getDb();
      const due = db.data.pendingSends.filter(
        (s) => s.status === 'pending' && s.scheduledTime <= new Date().toISOString()
      );
      (async () => {
        for (const row of due) {
          const { processDueNow } = await import('./queue.js');
          await processDueNow(row);
        }
        await db.write();
      })();
    };
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
