import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/cloudflare-preview.yml', import.meta.url), 'utf8');

assert.match(workflow, /workflow_dispatch:/);
assert.doesNotMatch(workflow, /\n\s*push:/);
assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow, /VITE_POSTHOG_PROJECT_TOKEN/);
assert.match(workflow, /VITE_MOTORLAB_POSTHOG_TEST/);
assert.match(workflow, /wrangler preview/);
assert.doesNotMatch(workflow, /wrangler deploy(?!\s+--dry-run)/);
assert.doesNotMatch(workflow, /branches:\s*\[?\s*main/);

console.log('Cloudflare preview workflow contract: PASS');
