import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

assert.match(source, /import\s+\{\s*PostHogProvider\s*\}\s+from\s+['"]@posthog\/react['"]/);
assert.match(source, /import\s+\{\s*getPostHogConfig\s*\}\s+from\s+['"]\.\/lib\/posthogConfig\.js['"]/);
assert.match(source, /import\s+\{\s*schedulePostHogPilotProbe\s*\}\s+from\s+['"]\.\/lib\/posthogPilotProbe\.js['"]/);
assert.match(source, /getPostHogConfig\(import\.meta\.env\)/);
assert.match(source, /postHogConfig\s*\?/);
assert.match(source, /<PostHogProvider\s+apiKey=\{postHogConfig\.apiKey\}\s+options=\{postHogConfig\.options\}>/);
assert.match(source, /<AppV15\s*\/>/);
assert.match(source, /<PwaInstallPrompt\s*\/>/);
assert.match(source, /schedulePostHogPilotProbe\(import\.meta\.env,\s*window\.location\.search\)/);
assert.match(source, /navigator\.serviceWorker\.register\('\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/);

console.log('PostHog root integration contract: PASS');
