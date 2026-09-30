# StudyBook-AI PostHog Observability Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-safe, diagnostics-only PostHog pilot to the StudyBook-AI LAB so unhandled browser errors can be observed without changing StudyBook features or collecting normal behavioral analytics.

**Architecture:** Keep PostHog isolated at the React/Vite root. A small pure configuration helper decides whether telemetry is enabled and returns the exact diagnostics-only SDK options; `src/main.jsx` conditionally wraps the existing app in the official `PostHogProvider` only when both required environment variables exist. A gated MotorLab probe can generate one controlled unhandled rejection only when both a dedicated build-time flag and URL query parameter are present, so normal users never see the probe.

**Tech Stack:** React 19, Vite 7, `posthog-js`, `@posthog/react`, Node.js 22, existing GitHub Actions build pipeline.

**Spec:** `docs/superpowers/specs/2026-10-01-posthog-observability-pilot-design.md`

## Global Constraints

- LAB branch only: `lab/posthog-observability-pilot-01`; do not merge to `main` in this plan.
- Do not change `AppV15.jsx`, OCR/document parsing, study modes, service-worker behavior, Netlify API functions, or other MotorLab projects.
- No session replay.
- No interaction autocapture.
- No automatic pageview or pageleave capture.
- Capture only unhandled browser errors and unhandled promise rejections; do not capture console errors in the pilot.
- Do not deliberately attach document text, OCR output, filenames, AI prompts/responses, study notes, credentials, API keys, or user identifiers to telemetry.
- `VITE_POSTHOG_PROJECT_TOKEN` is a client project token and must come from deployment environment configuration, not a source literal.
- `VITE_POSTHOG_HOST` must come from deployment environment configuration, not be silently guessed in code.
- Missing or partial PostHog configuration must leave StudyBook fully usable without telemetry.
- No blocking startup wait on PostHog network availability.
- No source-map upload automation in this pilot.
- Preserve the repository convention of no committed npm lockfile unless implementation discovers that CI requires one; any such discovery requires an amended plan before adding it.

## Review Focus

1. **No or partial PostHog environment configuration:** StudyBook must render normally and the helper must return telemetry disabled. Covered by Task 1 configuration tests and Task 3 no-env build/smoke check.
2. **Behavioral-event leakage:** `autocapture`, `$pageview`, `$pageleave`, and session replay must remain disabled while exception capture stays enabled. Covered by Task 1 exact-options test and Task 4 PostHog event inspection.
3. **Accidental live probe:** the synthetic error must require both `VITE_MOTORLAB_POSTHOG_TEST=1` and `?motorlab_posthog_probe=1`; either condition alone must do nothing. Covered by Task 2 probe-gating tests.
4. **PostHog/network unavailable:** startup must not await PostHog and the application must remain usable when ingestion is blocked/unreachable. Covered by Task 3 network-failure smoke verification.
5. **Sensitive application content:** no telemetry-enrichment code may reference StudyBook document/OCR/prompt/note data. Covered by Task 4 diff/static review plus inspection of the received controlled exception payload.

---

### Task 1: Diagnostics-only PostHog configuration

**Files:**
- Modify: `package.json`
- Create: `src/lib/posthogConfig.js`
- Create: `scripts/test-posthog-config.mjs`

**Interfaces:**
- Consumes: Vite-style environment object containing optional `VITE_POSTHOG_PROJECT_TOKEN` and `VITE_POSTHOG_HOST` strings.
- Produces: `getPostHogConfig(env)` returning `null` or `{ apiKey, options }` where `options` is safe to pass unchanged to `PostHogProvider`.

- [ ] **Step 1: Write the failing configuration test**

Create `scripts/test-posthog-config.mjs` with assertions that:
- `getPostHogConfig({}) === null`;
- token-only configuration returns `null`;
- host-only configuration returns `null`;
- a valid token+host returns the supplied token as `apiKey` and exact options containing:
  - `api_host` equal to the supplied host;
  - `defaults: '2026-05-30'`;
  - `autocapture: false`;
  - `capture_pageview: false`;
  - `capture_pageleave: false`;
  - `disable_session_recording: true`;
  - `capture_exceptions.capture_unhandled_errors: true`;
  - `capture_exceptions.capture_unhandled_rejections: true`;
  - `capture_exceptions.capture_console_errors: false`.

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node scripts/test-posthog-config.mjs`

Expected: FAIL because `src/lib/posthogConfig.js` / `getPostHogConfig` does not yet exist.

- [ ] **Step 3: Add PostHog packages without introducing a lockfile**

Run: `npm install --save --package-lock=false posthog-js @posthog/react`

Update `package.json` dependencies only. Do not commit `node_modules` or a generated lockfile.

- [ ] **Step 4: Implement `getPostHogConfig(env)`**

Create `src/lib/posthogConfig.js` exporting exactly:

```js
export function getPostHogConfig(env) { /* implementation */ }
```

Return `null` unless both required values are non-empty strings. Otherwise return `{ apiKey, options }` with the exact values asserted in Step 1. Do not read StudyBook state or user content in this module.

- [ ] **Step 5: Re-run the configuration test**

Run: `node scripts/test-posthog-config.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json src/lib/posthogConfig.js scripts/test-posthog-config.mjs
git commit -m "feat: add diagnostics-only PostHog configuration"
```

### Task 2: Gated MotorLab live exception probe

**Files:**
- Create: `src/lib/posthogPilotProbe.js`
- Create: `scripts/test-posthog-pilot-probe.mjs`

**Interfaces:**
- Consumes: environment object, `location.search` string, and an injected scheduling function for testability.
- Produces: `shouldRunPostHogPilotProbe(env, search)` returning boolean and `schedulePostHogPilotProbe(env, search, schedule)` returning boolean.

- [ ] **Step 1: Write the failing probe-gating test**

Create `scripts/test-posthog-pilot-probe.mjs` asserting:
- no flag + no query => false;
- flag only => false;
- query only => false;
- `VITE_MOTORLAB_POSTHOG_TEST === '1'` plus `motorlab_posthog_probe=1` => true;
- a custom scheduler is called exactly once only in the fully gated case;
- the scheduled callback creates the fixed diagnostic error text `MOTORLAB_POSTHOG_PILOT_TEST` and contains no StudyBook content.

- [ ] **Step 2: Run the probe test and verify failure**

Run: `node scripts/test-posthog-pilot-probe.mjs`

Expected: FAIL because the probe module does not yet exist.

- [ ] **Step 3: Implement the gated probe**

Create `src/lib/posthogPilotProbe.js` exporting exactly:

```js
export function shouldRunPostHogPilotProbe(env, search) { /* implementation */ }
export function schedulePostHogPilotProbe(env, search, schedule = setTimeout) { /* implementation */ }
```

The scheduled callback must create one unhandled rejected promise with `new Error('MOTORLAB_POSTHOG_PILOT_TEST')`. It must not read application state, DOM text, document data, OCR data, filenames, prompts, notes, or credentials.

- [ ] **Step 4: Re-run the probe test**

Run: `node scripts/test-posthog-pilot-probe.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/lib/posthogPilotProbe.js scripts/test-posthog-pilot-probe.mjs
git commit -m "test: add gated PostHog live probe"
```

### Task 3: Root integration with fail-open configuration

**Files:**
- Modify: `src/main.jsx:1-24`
- Modify: `DEPLOYMENT.md`

**Interfaces:**
- Consumes: `getPostHogConfig(import.meta.env)`, `schedulePostHogPilotProbe(import.meta.env, window.location.search)` and official `PostHogProvider`.
- Produces: existing StudyBook React tree unchanged when PostHog configuration is absent; instrumented tree when valid configuration is present.

- [ ] **Step 1: Run all new tests before integration**

Run:
```bash
node scripts/test-posthog-config.mjs
node scripts/test-posthog-pilot-probe.mjs
```

Expected: both PASS.

- [ ] **Step 2: Integrate the provider at the existing React root**

Modify `src/main.jsx` only around the existing root render:
- import `PostHogProvider` from `@posthog/react`;
- import `getPostHogConfig` and `schedulePostHogPilotProbe`;
- keep the existing `AppV15`, `PwaInstallPrompt`, CSS imports, `React.StrictMode`, and service-worker block intact;
- build the existing application children once;
- if `getPostHogConfig(import.meta.env)` is `null`, render the original children directly;
- otherwise wrap the same children with `PostHogProvider apiKey={config.apiKey} options={config.options}`;
- after scheduling the render, call the gated probe helper; it must remain dormant unless both probe gates are present.

Do not add PostHog hooks or capture calls inside `AppV15` or feature components.

- [ ] **Step 3: Document Netlify LAB variables**

Append a clearly labeled PostHog LAB section to `DEPLOYMENT.md` documenting:
- `VITE_POSTHOG_PROJECT_TOKEN` — public client project token supplied via Netlify environment configuration;
- `VITE_POSTHOG_HOST` — ingestion host from the active PostHog project settings;
- `VITE_MOTORLAB_POSTHOG_TEST` — temporary LAB-only flag; absent/disabled in normal builds;
- never commit real `.env` files (the current `.gitignore` already excludes `.env` and `.env.*`).

Do not place actual token or host values in the document.

- [ ] **Step 4: Build with PostHog variables absent**

Run: `npm run build`

Expected: Vite build succeeds and produces non-empty `dist/`; no PostHog environment variable is required for build success.

- [ ] **Step 5: Smoke-test startup with no PostHog configuration**

Run a local preview from the generated build and load the home page with both PostHog variables absent.

Expected: StudyBook renders normally; no startup exception caused by the observability integration; existing service-worker code remains unchanged.

- [ ] **Step 6: Smoke-test PostHog network failure**

Run a LAB preview with syntactically valid test values but make the configured ingestion host unreachable/blocked for the browser session.

Expected: the application UI still renders and remains usable; startup does not wait for a successful PostHog network response.

If the official provider causes a blocking/render failure under this condition, STOP: do not invent an undocumented provider API. Return to Bruno with an amended design before changing the integration pattern.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/main.jsx DEPLOYMENT.md
git commit -m "feat: integrate PostHog error tracking at app root"
```

### Task 4: CI, live exception verification, privacy check, and adoption evidence

**Files:**
- Modify only if needed after successful evidence: MotorLab project-state/registry files covered by a separate approved control-plane update; do not modify them before runtime evidence exists.
- No StudyBook feature files should change in this task.

**Interfaces:**
- Consumes: completed LAB implementation and the connected PostHog project.
- Produces: verified build evidence plus one controlled `$exception` event generated by the LAB probe, or a precise blocking report if verification fails.

- [ ] **Step 1: Push/verify the existing LAB CI path**

The existing `.github/workflows/build.yml` already runs on `lab/**`, installs dependencies with Node 22, executes the StudyBook regression scripts, builds Vite, verifies `dist`, and uploads a LAB artifact. Do not change the workflow unless an actual failure proves it necessary.

Expected: all existing regression steps plus build PASS.

- [ ] **Step 2: Verify the diff before live telemetry**

Compare `main...lab/posthog-observability-pilot-01`.

Expected application-scope changes only:
- `package.json`;
- `src/lib/posthogConfig.js`;
- `src/lib/posthogPilotProbe.js`;
- `src/main.jsx`;
- two PostHog test scripts;
- `DEPLOYMENT.md`;
- the already-approved spec/plan docs.

Fail the review if the diff touches `AppV15.jsx`, OCR/document code, study-mode feature code, service worker, API functions, or includes real credentials/user content.

- [ ] **Step 3: Start one controlled LAB probe**

Configure the LAB deployment with valid `VITE_POSTHOG_PROJECT_TOKEN`, valid `VITE_POSTHOG_HOST`, and temporary `VITE_MOTORLAB_POSTHOG_TEST=1`. Open exactly once with `?motorlab_posthog_probe=1`.

Expected: the browser creates one controlled unhandled rejection with message `MOTORLAB_POSTHOG_PILOT_TEST` while StudyBook otherwise remains usable.

- [ ] **Step 4: Confirm received PostHog schema before querying**

Using the connected PostHog MCP, run `read-data-schema` for events first. Do not assume `$exception` exists until the schema confirms it.

Expected: the exception event appears in the project schema after ingestion.

- [ ] **Step 5: Inspect the controlled exception evidence**

Use the appropriate PostHog error-tracking query tool only after its schema is inspected with `info`/`schema` as required.

Expected:
- issue/event corresponds to `MOTORLAB_POSTHOG_PILOT_TEST`;
- stack/exception metadata is present enough for diagnosis;
- no deliberate StudyBook document/OCR/prompt/note content was attached by our integration;
- no session recording was enabled;
- no normal click/form autocapture was enabled;
- no automatic pageview/pageleave events were intentionally enabled by configuration.

- [ ] **Step 6: Disable the probe flag immediately after verification**

Remove/disable `VITE_MOTORLAB_POSTHOG_TEST` from the LAB deployment configuration and rebuild/redeploy if the hosting environment requires it.

Expected: reopening with the query parameter alone produces no synthetic exception.

- [ ] **Step 7: Run final regression verification**

Run locally or via the LAB CI:
```bash
node scripts/test-posthog-config.mjs
node scripts/test-posthog-pilot-probe.mjs
npm run build
```

Also confirm the existing StudyBook CI regression suite remains green.

Expected: all PASS.

- [ ] **Step 8: Report result before any lifecycle promotion**

If all checks pass, report the LAB as `POSTHOG_PILOT_VERIFIED` and present the exact branch/head/CI evidence to Bruno. Do **not** mark CANDIDATA, merge `main`, promote MADRE, or roll out to another project without a new explicit MotorLab approval.

If any check fails, keep the LAB isolated, record symptom + root cause + recurrence surface + prevention, and do not broaden the rollout.

## Self-Review Result

- Spec coverage: all approved scope items are assigned to Tasks 1-4; source-map automation remains explicitly deferred.
- Step scan: each implementation step changes one responsibility; runtime verification steps are separated from code changes.
- Type/interface consistency: both root integration and tests consume the same `getPostHogConfig` and probe helper exports.
- Review Focus coverage: missing config, behavioral leakage, accidental probe activation, network failure, and sensitive-content leakage each have an explicit test or verification step.
- Proportion: no new shared observability framework, dashboard, session replay, feature flags, source maps, or cross-project abstraction is introduced.
