import { getDb } from './db.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
].filter(Boolean);

function groqKey() {
  return process.env.GROQ_API_KEY || '';
}
function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

async function groqChat(messages, { json = true, maxTokens = 2000 } = {}) {
  const key = groqKey();
  if (!key) throw new Error('GROQ_API_KEY not configured');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const makeBody = (useJson) => {
    const body = { model, messages, temperature: 0.2, max_tokens: maxTokens };
    if (useJson) body.response_format = { type: 'json_object' };
    return body;
  };
  const doCall = async (useJson) => {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(makeBody(useJson)),
    });
    const text = await res.text();
    return { res, text };
  };
  let { res, text } = await doCall(json);
  if (!res.ok && json && text.includes('json_validate_failed')) {
    ({ res, text } = await doCall(false));
  }
  if (!res.ok) throw new Error(`Groq ${res.status} (model ${model}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return data.choices?.[0]?.message?.content || '';
}

async function geminiChat(prompt, { maxTokens = 2000 } = {}) {
  const key = geminiKey();
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      lastErr = new Error(`Gemini ${res.status} (${model}): ${text.slice(0, 300)}`);
      continue;
    }
    const data = JSON.parse(text);
    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    if (content) return content;
    lastErr = new Error(`Gemini ${model} returned empty content`);
  }
  throw lastErr || new Error('Gemini request failed');
}

async function llmJson(prompt, { maxTokens = 2000 } = {}) {
  const prefer = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const tryGemini = prefer !== 'groq';
  const tryGroq = prefer !== 'gemini' || !geminiKey();
  const errors = [];
  if (tryGemini && geminiKey()) {
    try { return await geminiChat(prompt, { maxTokens }); } catch (e) { errors.push(e.message); }
  }
  if (groqKey() && (tryGroq || errors.length)) {
    try {
      return await groqChat([{ role: 'user', content: prompt }], { json: true, maxTokens });
    } catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.join(' | ') || 'No AI provider configured. Set GEMINI_API_KEY and/or GROQ_API_KEY.');
}

function safeJsonParse(s, fallback) {
  try {
    const t = String(s).trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}

function newIssueId() {
  return `iss_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

export async function getCurrentSummaryRow(businessId) {
  const db = getDb();
  const { data } = await db.from('review_summaries').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1);
  return data?.[0] || null;
}

export async function ensureCurrentSummaryRow(businessId, periodStart, periodEnd) {
  const db = getDb();
  const existing = await getCurrentSummaryRow(businessId);
  if (existing) return existing;
  const row = {
    id: `sum_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    business_id: businessId,
    period_start: periodStart || new Date(Date.now() - 365 * 86400000).toISOString(),
    period_end: periodEnd || new Date().toISOString(),
    summary_text: '',
    areas_of_improvement: '',
    review_count: 0,
    is_read: false,
    created_at: new Date().toISOString(),
    issues: [],
  };
  const { error } = await db.from('review_summaries').insert(row);
  if (error) throw error;
  return row;
}

export function issueKindOf(issue) {
  return issue?.kind === 'suggestion' ? 'suggestion' : 'complaint';
}

export function inferFeedbackKind(review) {
  if (review?.kind === 'suggestion' || review?.kind === 'complaint') return review.kind;
  if (Number(review?.rating) >= 4 && review?.source === 'internal') return 'suggestion';
  return 'complaint';
}

export function issuesFromRow(row) {
  if (!row) return [];
  return (Array.isArray(row.issues) ? row.issues : []).map((i) => ({
    ...i,
    kind: issueKindOf(i),
  }));
}

export async function firstRunClustering(businessId, items, issueKind = 'complaint') {
  const db = getDb();
  const kindLabel = issueKind === 'suggestion' ? 'suggestion' : 'complaint';
  if (!items.length) {
    await ensureCurrentSummaryRow(businessId);
    return issuesFromRow(await getCurrentSummaryRow(businessId));
  }
  const payloadItems = items.slice(0, 60).map((r) => ({ id: r.id, rating: r.rating, text: (r.text || '').slice(0, 600) }));
  const { data: bizRow } = await db.from('businesses').select('category').eq('id', businessId).maybeSingle();
  const biz = bizRow?.category === 'gym' ? 'gym' : 'restaurant';
  const prompt = kindLabel === 'suggestion'
    ? `You cluster happy-customer SUGGESTIONS for a ${biz} into distinct ideas. These are NOT complaints. Use semantic similarity, NOT keyword matching. Never merge a suggestion with a complaint theme.\n\nSuggestions (JSON):\n${JSON.stringify(payloadItems)}\n\nReturn ONLY JSON: {"issues":[{"theme":"short label for the idea","improvement":"how the owner could act on this idea","review_ids":["<ids from input>"]}]}\nRules: every input id must appear in exactly one issue. Max 8 issues. Keep theme under 60 chars, improvement under 200 chars. kind is always suggestion.`
    : `You cluster ${biz} COMPLAINTS (negative Google reviews and private WhatsApp complaints) into distinct underlying problems. Use semantic similarity, NOT keyword matching. Never treat these as suggestions.\n\nComplaints (JSON):\n${JSON.stringify(payloadItems)}\n\nReturn ONLY JSON: {"issues":[{"theme":"short label, e.g. Slow service during peak hours","improvement":"one concrete fix the owner can do","review_ids":["<ids from input>"]}]}\nRules: every input id must appear in exactly one issue. Max 8 issues. Keep theme under 60 chars, improvement under 200 chars.`;
  let clustered = [];
  try {
    const out = await llmJson(prompt, { maxTokens: 3000 });
    const parsed = safeJsonParse(out, null);
    const raw = parsed?.issues || [];
    const now = new Date().toISOString();
    clustered = raw.slice(0, 8).map((it) => ({
      id: newIssueId(),
      kind: kindLabel,
      theme: String(it.theme || (kindLabel === 'suggestion' ? 'Suggestion' : 'Issue')).slice(0, 80),
      improvement: String(it.improvement || '').slice(0, 300),
      first_seen: now,
      occurrences: Array.isArray(it.review_ids) ? it.review_ids.length : 0,
      example_review_ids: Array.isArray(it.review_ids) ? it.review_ids.slice(0, 10) : [],
      is_read: false,
    }));
  } catch (e) {
    console.error('firstRunClustering failed, will retry next cron:', e.message);
    throw e;
  }

  const periodStart = new Date(Date.now() - 365 * 86400000).toISOString();
  const periodEnd = new Date().toISOString();
  const existing = await getCurrentSummaryRow(businessId);
  const keep = issuesFromRow(existing).filter((i) => issueKindOf(i) !== kindLabel);
  const issues = [...keep, ...clustered];
  const payload = {
    issues,
    period_start: periodStart,
    period_end: periodEnd,
    review_count: items.length,
    summary_text: issues.map((i) => `${i.kind}: ${i.theme}: ${i.improvement}`).join('\n'),
    areas_of_improvement: issues.filter((i) => i.kind === 'complaint').map((i) => i.improvement).join('\n'),
    is_read: false,
  };
  if (existing) {
    await db.from('review_summaries').update(payload).eq('id', existing.id);
  } else {
    await db.from('review_summaries').insert({
      id: `sum_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      business_id: businessId,
      created_at: new Date().toISOString(),
      ...payload,
    });
  }

  const reviewToIssue = new Map();
  for (const iss of clustered) {
    for (const rid of iss.example_review_ids || []) reviewToIssue.set(rid, iss.id);
  }
  for (const [rid, iid] of reviewToIssue) {
    try {
      await db.from('reviews').update({ ai_flag: 'new_issue', ai_issue_id: iid }).eq('id', rid).eq('business_id', businessId);
    } catch (e) { console.error('tag review failed', rid, e.message); }
  }
  return issues;
}

export async function classifyOneReview(businessId, review) {
  const db = getDb();
  const current = await getCurrentSummaryRow(businessId);
  const issues = issuesFromRow(current);
  const issueKind = inferFeedbackKind(review);
  const reviewText = String(review.text || review.complaint || '').slice(0, 800);
  if (!reviewText.trim()) {
    const same = issues.filter((i) => issueKindOf(i) === issueKind);
    return { decision: same.length ? 'repeated' : 'new_issue', issueId: same[0]?.id || null, kind: issueKind };
  }
  const known = issues
    .filter((i) => issueKindOf(i) === issueKind)
    .map((i) => ({ id: i.id, kind: i.kind, theme: i.theme, improvement: i.improvement }));
  const { data: bizRow } = await db.from('businesses').select('category').eq('id', businessId).maybeSingle();
  const biz = bizRow?.category === 'gym' ? 'gym' : 'restaurant';
  const prompt = `You classify one piece of ${biz} customer feedback.

This item is already tagged kind="${issueKind}".
- complaint: a negative Google review or a WhatsApp unhappy-path private complaint. Never call it a suggestion.
- suggestion: a happy customer's idea from WhatsApp. Never call it a complaint.

Deduplicate ONLY against known issues of the SAME kind. A complaint and a suggestion about similar topics must stay separate.

Known same-kind issues (JSON):
${JSON.stringify(known)}

New item:
{"id":${JSON.stringify(review.id)},"kind":${JSON.stringify(issueKind)},"rating":${JSON.stringify(review.rating)},"text":${JSON.stringify(reviewText)}}

Return ONLY JSON: {"decision":"repeated"|"new_issue","issue_id":"<matching known id if repeated, else null>","theme":"<short label, required if new_issue>","improvement":"<owner action, required if new_issue>"}`;
  let result;
  try {
    const out = await llmJson(prompt, { maxTokens: 600 });
    result = safeJsonParse(out, null);
  } catch (e) {
    console.error('classifyOneReview failed (will retry next cron):', e.message);
    throw e;
  }
  if (!result || (result.decision !== 'repeated' && result.decision !== 'new_issue')) {
    throw new Error('AI returned unparseable classification');
  }

  if (result.decision === 'repeated') {
    const same = issues.filter((i) => issueKindOf(i) === issueKind);
    const match = same.find((i) => i.id === result.issue_id) || same[0];
    if (!match) {
      const fallbackTheme = issueKind === 'suggestion' ? 'Customer suggestion' : 'Negative experience';
      const fallbackImp = issueKind === 'suggestion' ? 'Consider this idea from a happy customer.' : 'Follow up with the customer and fix the reported problem.';
      return await appendNewIssue(businessId, review, fallbackTheme, fallbackImp, issueKind);
    }
    match.occurrences = (match.occurrences || 0) + 1;
    if (!match.example_review_ids.includes(review.id)) {
      match.example_review_ids = [...(match.example_review_ids || []), review.id].slice(-10);
    }
    if (current) await db.from('review_summaries').update({ issues, period_end: new Date().toISOString() }).eq('id', current.id);
    await db.from('reviews').update({ ai_flag: 'repeated', ai_issue_id: match.id }).eq('id', review.id).eq('business_id', businessId);
    return { decision: 'repeated', issueId: match.id, kind: issueKind };
  }

  return await appendNewIssue(businessId, review, result.theme, result.improvement, issueKind);
}

async function appendNewIssue(businessId, review, theme, improvement, issueKind = 'complaint') {
  const db = getDb();
  const current = await ensureCurrentSummaryRow(businessId);
  const issues = issuesFromRow(current);
  const iss = {
    id: newIssueId(),
    kind: issueKind === 'suggestion' ? 'suggestion' : 'complaint',
    theme: String(theme || (issueKind === 'suggestion' ? 'New suggestion' : 'New issue')).slice(0, 80),
    improvement: String(improvement || 'Follow up with the customer.').slice(0, 300),
    first_seen: new Date().toISOString(),
    occurrences: 1,
    example_review_ids: [review.id],
    is_read: false,
  };
  const next = [...issues, iss];
  await db.from('review_summaries').update({ issues: next, period_end: new Date().toISOString(), is_read: false }).eq('id', current.id);
  await db.from('reviews').update({ ai_flag: 'new_issue', ai_issue_id: iss.id }).eq('id', review.id).eq('business_id', businessId);
  return { decision: 'new_issue', issueId: iss.id, kind: iss.kind };
}

export async function weeklyUpdateBusiness(businessId) {
  const db = getDb();
  const current = await getCurrentSummaryRow(businessId);
  if (!current) {
    const since = new Date(Date.now() - 365 * 86400000).toISOString();
    const { data } = await db.from('reviews').select('*').eq('business_id', businessId).gte('created_at', since).order('created_at', { ascending: true }).limit(200);
    const all = (data || []).filter((r) => !r.ai_flag);
    const negatives = all.filter((r) => Number(r.rating) < 4);
    const suggestions = all.filter((r) => Number(r.rating) >= 4 && r.source === 'internal');
    if (!negatives.length && !suggestions.length) { await ensureCurrentSummaryRow(businessId); return { processed: 0 }; }
    try {
      if (negatives.length) await firstRunClustering(businessId, negatives.map((r) => ({ id: r.id, rating: r.rating, text: r.text })), 'complaint');
      if (suggestions.length) await firstRunClustering(businessId, suggestions.map((r) => ({ id: r.id, rating: r.rating, text: r.text })), 'suggestion');
      return { processed: negatives.length + suggestions.length, firstRun: true };
    } catch { return { processed: 0, error: 'AI failed, retry next run' }; }
  }
  const { data } = await db.from('reviews').select('*').eq('business_id', businessId).is('ai_flag', null).order('created_at', { ascending: true }).limit(100);
  const fresh = (data || []).filter((r) => Number(r.rating) < 4 || (r.source === 'internal' && Number(r.rating) >= 4));
  let processed = 0;
  for (const r of fresh) {
    try {
      await classifyOneReview(businessId, { id: r.id, rating: r.rating, text: r.text, source: r.source, kind: inferFeedbackKind(r) });
      processed++;
    } catch {
      break;
    }
  }
  if (processed) {
    const cur2 = await getCurrentSummaryRow(businessId);
    if (cur2) await db.from('review_summaries').update({ period_end: new Date().toISOString() }).eq('id', cur2.id);
  }
  return { processed };
}

export async function runFirstClusteringForBusiness(businessId) {
  const db = getDb();
  const since = new Date(Date.now() - 365 * 86400000).toISOString();
  const { data } = await db.from('reviews').select('*').eq('business_id', businessId).gte('created_at', since).order('created_at', { ascending: true }).limit(200);
  const all = (data || []).filter((r) => !r.ai_flag);
  const negatives = all.filter((r) => Number(r.rating) < 4).map((r) => ({ id: r.id, rating: r.rating, text: r.text }));
  const suggestions = all.filter((r) => Number(r.rating) >= 4 && r.source === 'internal').map((r) => ({ id: r.id, rating: r.rating, text: r.text }));
  if (negatives.length) await firstRunClustering(businessId, negatives, 'complaint');
  if (suggestions.length) await firstRunClustering(businessId, suggestions, 'suggestion');
  if (!negatives.length && !suggestions.length) {
    const cur = await getCurrentSummaryRow(businessId);
    if (!cur) {
      await db.from('review_summaries').insert({
        id: `sum_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        business_id: businessId,
        period_start: since,
        period_end: new Date().toISOString(),
        summary_text: '',
        areas_of_improvement: '',
        review_count: 0,
        is_read: false,
        created_at: new Date().toISOString(),
        issues: [],
      });
    }
  }
}
