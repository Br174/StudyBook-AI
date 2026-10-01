import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/cloudflare-preview.yml', import.meta.url), 'utf8');

assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- lab\/posthog-cloudflare-preview-03/);
assert.match(workflow, /github\.ref == 'refs\/heads\/lab\/posthog-cloudflare-preview-03'/);
assert.ok(workflow.includes('[motorlab-preview]'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.devDependencies.wrangler, '4.135.0');
const config = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
assert.deepEqual(config.previews.vars, config.vars);
assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow, /VITE_POSTHOG_PROJECT_TOKEN/);
assert.match(workflow, /VITE_MOTORLAB_POSTHOG_TEST/);
assert.match(workflow, /wrangler preview/);
assert.doesNotMatch(workflow, /wrangler deploy(?!\s+--dry-run)/);
assert.doesNotMatch(workflow, /branches:\s*\[?\s*main/);

console.log('Cloudflare preview workflow contract: PASS');
