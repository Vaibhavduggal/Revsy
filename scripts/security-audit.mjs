#!/usr/bin/env node
/**
 * Static security checks (local + CI). For dynamic pentest, run Strix separately.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];

function add(level, msg) {
  findings.push({ level, msg });
}

const secretPatterns = [
  /gsk_[a-zA-Z0-9]{20,}/,
  /GOCSPX-[a-zA-Z0-9_-]+/,
  /sk-[a-zA-Z0-9]{20,}/,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\./,
];

function scanFile(filePath) {
  const rel = path.relative(root, filePath);
  if (rel.includes('node_modules') || rel.includes('.tmp')) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const re of secretPatterns) {
    if (re.test(text)) add('high', `Possible secret in tracked file: ${rel} (rotate if real)`);
  }
}

let tracked = [];
try {
  tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
} catch {
  tracked = [];
}

for (const rel of tracked) {
  if (rel.includes('node_modules') || rel.endsWith('.env.example')) continue;
  const p = path.join(root, rel);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) scanFile(p);
}

if (!fs.existsSync(path.join(root, 'server/.env'))) {
  add('info', 'server/.env missing locally (use server/.env.example)');
} else {
  add('info', 'server/.env exists — never commit; rotate keys if exposed');
}

try {
  const hist = execSync('git log --all --oneline -- server/.env .env', { cwd: root, encoding: 'utf8' }).trim();
  if (hist) add('critical', 'server/.env or .env appears in git history — purge and rotate all keys');
} catch {
  /* no git */
}

if (!process.env.CRON_SECRET && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
  add('high', 'CRON_SECRET unset in production — cron endpoints must require it');
}

if (isProductionEnv() && !process.env.FRONTEND_URL) {
  add('high', 'FRONTEND_URL unset in production — CORS may block or misconfigure');
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

const grouped = { critical: 0, high: 0, info: 0 };
for (const f of findings) grouped[f.level] = (grouped[f.level] || 0) + 1;

console.log('Revsy security audit (static)\n');
for (const f of findings) console.log(`[${f.level}] ${f.msg}`);
console.log(`\nSummary: ${findings.length} finding(s)`);
console.log('Dynamic scan: install Strix (Docker) — see docs/SECURITY.md');

if (grouped.critical > 0) process.exit(2);
if (grouped.high > 0) process.exit(1);
process.exit(0);
