import assert from 'node:assert/strict';
import { isFreshStudyHelpRecord } from '../src/lib/studyHelpCache.js';

const now = Date.parse('2026-09-13T04:00:00.000Z');
const fresh = {
  key: 'answer-1',
  value: { answer: 'Spiegazione valida.' },
  savedAt: '2026-09-12T04:00:00.000Z',
};
const expired = {
  ...fresh,
  key: 'answer-2',
  savedAt: '2026-07-01T04:00:00.000Z',
};
const broken = {
  key: 'answer-3',
  value: {},
  savedAt: '2026-09-12T04:00:00.000Z',
};

assert.equal(isFreshStudyHelpRecord(fresh, now), true);
assert.equal(isFreshStudyHelpRecord(expired, now), false);
assert.equal(isFreshStudyHelpRecord(broken, now), false);
assert.equal(isFreshStudyHelpRecord(null, now), false);

console.log('Persistent study-help cache model: OK');
