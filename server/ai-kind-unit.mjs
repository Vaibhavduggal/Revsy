import { inferFeedbackKind, issueKindOf } from './src/ai.js';

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('ok -', msg);
}

assert(inferFeedbackKind({ rating: 2, source: 'google' }) === 'complaint', 'google negative is complaint');
assert(inferFeedbackKind({ rating: 5, source: 'google' }) === 'complaint', 'google positive is not a suggestion');
assert(inferFeedbackKind({ rating: 5, source: 'internal' }) === 'suggestion', 'internal happy idea is suggestion');
assert(inferFeedbackKind({ rating: 5, source: 'internal', kind: 'complaint' }) === 'complaint', 'explicit kind wins');
assert(issueKindOf({}) === 'complaint', 'missing kind defaults to complaint');
assert(issueKindOf({ kind: 'suggestion' }) === 'suggestion', 'suggestion kind');

console.log('ai kind unit tests passed');
