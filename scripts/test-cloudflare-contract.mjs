import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const configText = await readFile(new URL('wrangler.jsonc', root), 'utf8');
const config = JSON.parse(configText);
const worker = await readFile(new URL('worker/index.js', root), 'utf8');

assert.equal(config.name, 'studybook-ai');
assert.equal(config.main, './worker/index.js');
assert.equal(config.assets?.directory, './dist');
assert.equal(config.assets?.not_found_handling, 'single-page-application');
assert.ok(config.assets?.run_worker_first?.includes('/api/*'));
assert.equal(config.vars?.AI_API_URL, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
assert.ok(config.vars?.AI_MODEL);

for (const route of ['/api/summarize', '/api/explain', '/api/refine']) {
  assert.ok(worker.includes(`['${route}'`), `Worker route missing: ${route}`);
}
assert.match(worker, /runLegacyApi/);
assert.match(worker, /Endpoint non trovato/);

console.log('Cloudflare deployment contract: PASS');
