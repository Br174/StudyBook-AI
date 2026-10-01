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
assert.ok(workflow.includes('WRANGLER_OUTPUT_FILE_PATH=cloudflare-preview-result.jsonl'));
assert.ok(workflow.includes("record.type === 'preview'"));
assert.doesNotMatch(workflow, /--json\s*>/);
assert.doesNotMatch(workflow, /wrangler deploy(?!\s+--dry-run)/);
assert.doesNotMatch(workflow, /branches:\s*\[?\s*main/);

const production = await readFile(new URL('../.github/workflows/cloudflare-production.yml', import.meta.url), 'utf8');
assert.match(production, /paths-ignore:/);
for (const path of ['netlify.toml', 'netlify/**', 'DEPLOYMENT.md', '.github/workflows/build.yml', '.github/workflows/cloudflare-production.yml', 'scripts/test-cloudflare-preview-workflow.mjs']) {
  assert.ok(production.includes(`'${path}'`), `Production workflow must ignore cleanup-only path ${path}`);
}

console.log('Cloudflare workflow contracts: PASS');
