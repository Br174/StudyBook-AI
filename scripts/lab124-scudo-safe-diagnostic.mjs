#!/usr/bin/env node
// MotorLab LAB124 — only release-safe diagnostic fingerprints from pre-existing local Scudo360 JSON.
// No test execution, network requests, raw logs, input text or secret values.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const errTypes = [
  ['ERR_MODULE_NOT_FOUND', /\bERR_MODULE_NOT_FOUND\b|Cannot find (?:package|module)/i],
  ['ERR_REQUIRE_ESM', /\bERR_REQUIRE_ESM\b/i],
  ['ERR_PACKAGE_PATH_NOT_EXPORTED', /\bERR_PACKAGE_PATH_NOT_EXPORTED\b/i],
  ['ERR_DLOPEN_FAILED', /\bERR_DLOPEN_FAILED\b|GLIBC_\d/i],
  ['ERR_UNSUPPORTED_NODE_VERSION', /unsupported node|requires node|node\.js version.+not supported/i],
  ['WORKER_START_FAILED', /failed to (?:start|launch|spawn) (?:workerd|worker|server)|workerd.+(?:crash|failed|exit)/i],
  ['WORKER_RUNTIME_FAILURE', /workerd.+(?:error|exception)|Miniflare.+(?:error|exception)/i],
  ['LOCAL_PORT_OCCUPIED', /\bEADDRINUSE\b/i],
  ['ACCESS_DENIED', /\bEACCES\b|\bEPERM\b/i],
  ['NETWORK_CONNECTION', /\bECONNREFUSED\b|\bETIMEDOUT\b|\bENOTFOUND\b|\bEAI_AGAIN\b/i],
  ['MISSING_FILE', /\bENOENT\b/i],
  ['TEST_ASSERTION', /\bAssertionError\b|\bERR_ASSERTION\b|Expected values to be strictly equal/i],
  ['TEST_TIMEOUT', /(?:test|hook|worker).{0,50}timed out|timeout exceeded/i],
  ['RESOURCE_LIMIT', /out of memory|\bENOMEM\b|heap out of memory/i],
  ['SYNTAX_ERROR', /\bSyntaxError\b/i],
  ['TEST_HOOK_FAILURE', /hookFailed|hook failed|before hook failed/i],
  ['UNEXPECTED_EXCEPTION', /(?:uncaughtException|unhandledRejection)/i],
];
const checks = [
  ['HOME', 'home serves the Vite application'],
  ['SPA_FALLBACK', 'deep links use the SPA fallback'],
  ['BUNDLE_ASSET', 'the built JavaScript is served as an asset'],
  ['PWA_SW', 'PWA asset /sw.js is preserved'],
  ['PWA_MANIFEST', 'PWA asset /manifest.webmanifest is preserved'],
  ['PWA_ICON', 'PWA asset /studybook-icon.svg is preserved'],
  ['UNKNOWN_API', 'unknown API stays JSON even for browser navigation'],
  ['METHOD_405_SUMMARIZE', 'GET /api/summarize returns 405 with Allow'],
  ['METHOD_405_EXPLAIN', 'GET /api/explain returns 405 with Allow'],
  ['METHOD_405_REFINE', 'GET /api/refine returns 405 with Allow'],
  ['INVALID_JSON', 'malformed input JSON returns 400 without contacting AI'],
  ['SUMMARY_ORDER', 'summaries preserve order and use the configured model and secret'],
  ['EXPLAIN_API', 'explain preserves its API contract'],
  ['REFINE_API', 'refine preserves its API contract'],
  ['EMPTY_INPUT', 'empty summary input is rejected before contacting AI'],
  ['LARGE_BATCH', 'oversized summary batches retain the existing size limit'],
  ['NO_SELECTION', 'missing selected text is rejected before contacting AI'],
  ['REFINE_LIMIT', 'oversized refine input retains the existing size limit'],
  ['RETRY_503', 'transient provider failures retain the existing retry'],
  ['NO_AUTH_RETRY', 'provider authentication failures are not retried'],
  ['MALFORMED_RESPONSE', 'malformed AI output is reported as an API error'],
  ['PARALLEL_REQUESTS', 'concurrent requests preserve their separate results'],
  ['MISSING_API_SECRET', 'a missing AI secret returns 503 on all three endpoints'],
];
const reportFile = process.argv[2];
if (!reportFile) { console.error('Usage: node scripts/lab124-scudo-safe-diagnostic.mjs report.json'); process.exit(2); }
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
if (report.gate !== 'MotorLab-Scudo360' || report.project !== 'studybook') throw Error('Unexpected Scudo360 report');
const suite = (report.suites || []).find(x => x.id === 'cloudflare-worker-tests');
if (!suite) throw Error('Cloudflare suite not found');
const tail = String(suite.logTail || '').slice(-4000);
const labels = errTypes.filter(([, test]) => test.test(tail)).map(([id]) => id);
const failedTestIds = checks.filter(([, label]) => tail.split(/\r?\n/).some(line => /(?:^|\s)not ok\s+\d+\s+-\s+/i.test(line) && line.includes(label))).map(([id]) => id);
const hasTAPCount = /^# tests\s+\d+/m.test(tail);
const safe = [
  'SCUDO360 LAB124 — REPORT TECNICO MINIMIZZATO',
  'Cloudflare suite: ' + (suite.status === 'passed' ? 'PASS' : 'FAILED'),
  'Exit: ' + (Number.isInteger(suite.exitCode) ? suite.exitCode : 'unknown'),
  'Node major: ' + process.versions.node.split('.')[0],
  'Suite JUnit tests/failures/errors/skips: ' +
    [suite.tests, suite.failures, suite.errors, suite.skipped].map(x => Number.isInteger(x) ? x : 'unknown').join('/'),
  'TAP totals available in captured tail: ' + (hasTAPCount ? 'YES' : 'NO'),
  'Diagnostic categories: ' + (labels.join(', ') || 'UNCLASSIFIED'),
  'Recognized failed test IDs: ' + (failedTestIds.join(', ') || 'NONE_IN_TAIL'),
  'LogTail present: ' + (tail ? 'YES' : 'NO'),
  'IMPORTANT: classifications are hints, not proof of root cause.',
  'Source: local existing Scudo360 report. No raw logs, private values, keystore or content transmitted.',
];
process.stdout.write(safe.join('\n') + '\n');
