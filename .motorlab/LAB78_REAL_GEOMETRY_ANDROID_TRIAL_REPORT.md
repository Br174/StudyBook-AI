# StudyBook AI LAB78 · geometry-to-real-Android update, strictly experimental

**User approval:** «Ok implementa nel apk».
**Date:** 2026-11-09. **Orchestrator:** MotorLab r40, native StudyBook engine unchanged. **Base signed Android:** LAB77. **Immutable safety ref:** `lab/safety-studybook-core-android-01-update-78-before`.

## Actual changes delivered to source and isolated backend

1. `src/lib/studyGeometryV78.js`: exact Unicode letters and source-derived page/range targets; source-based largest-remainder paragraph allocation; 60-column word wrapping; empirical LAB92 averages **46.346 letters, 7.844 natural spaces, 3.658 justify spaces, 1.966 punctuation, 0.186 digits per line**; no artificial filler, no torn words. Separates virtual monospaced grid from physical A4.
2. `src/lib/studyBestOfV76.js`: actual single-call prompt to Gemini receives a literal max row cap and per-original-page budget; explicitly distinguishes 10% retention 90% from 20% retention 80%; optional inner ±2 point aim, official ±5 acceptance unchanged.
3. `api/editionsBulkV51.js`: **REAL live Worker** calculates and uses this geometry before calling Gemini; refuses missing geometry handshake; returns numeric/geometry observations and Worker version header; retains max natural source page block strategy.
4. `src/lib/draftFirstV57.js`: source-to-Worker handshake and compiled Android enforcement, preserve existing checkpoints; retains LAB77 503 pacing and LAB58 natural blocks.
5. `src/lib/studyQualityV66.js`: **full complete no longer means six texts exist**. It requires ALL levels to pass source-group letter budgets AND 60-cell virtual grid. Failed texts stay available as unverified drafts, with numeric status, but never masquerade as a fully approved book. Semantic certification remains false.
6. Separate backend `wrangler.lab78-geometry.jsonc`, URL `https://studybook-ai-lab78-geometry.brunoverlezza.workers.dev`. Never replace current StudyBook production or the LAB76/77 isolated Worker.

## Evidence, separated honestly

### Offline real-code integration (real handler, synthetic Gemini mock)
GitHub Actions: https://github.com/Br174/StudyBook-AI/actions/runs/42691454125 : **PASS**.
- actual Worker API handler invoked with newly constructed source pages and a deliberately too-short fake provider output;
- actual Gemini system prompt checked for `60 posizioni`, specific row cap and original-letter bands;
- actual native quality gate rejected bad text as complete; preserved the drafts;
- 44 original pages stayed one maximum safe block for each of six levels;
- LAB76 and LAB77 regression checks PASS; app web build and Worker dry-run PASS.

### FIRST TRUE Gemini live smoke, same isolated Worker, source 2 pages
GitHub run: https://github.com/Br174/StudyBook-AI/actions/runs/42692051709
Data `audit/reports/lab78-real-worker-six-levels.json`. **2/6** both math and row checks: 40% and 10%; other four rejected.
All six HTTP 200; finish_reason stop (provider did not hit output-token cap). Thus extra max_tokens alone is not the cause of the inaccurate reductions.

### SECOND TRUE Gemini live smoke with finer central target and 20% prompt
GitHub run: https://github.com/Br174/StudyBook-AI/actions/runs/42693051227
Data `audit/reports/lab78-real-worker-six-levels-r2.json`. **3/6** both math and row checks: Summary, 20%, 10%.
50% reduced 39.3% (too little), 40% reduced 45.5% with one page off band, 30% reduced 34.1% with one page off band. These real results remain a **FAIL**. Not a reliable claim across unknown real textbooks.

### TRUE native StudyBook full pipeline on live Worker (no fake output)
GitHub run: https://github.com/Br174/StudyBook-AI/actions/runs/42693886427 : provider **HTTP 503 on first request**. No saved page was lost; test abort/paused before any new output. **No six-level native E2E pass**.

## Resulting release status

This is a **diagnostic/experimental signed APK only**, NOT an approved app update for production. User specifically requested implementation into APK and an installable test version. The experiment retains LAST_GOOD, user data, app id and signer; it does not certify percentage fidelity or semantics. Installing over the same Android package preserves current app data (subject to normal Android update constraints). Never uninstall to update. Verify on-device before any production promotion.

**No additional paid services.** Do not perform automatic repeated Gemini live calls: free-tier 503 must wait naturally. Prior six variants of user's real book should be preserved and flagged nonconformant, not silently replaced or falsely approved.

## Next requirements

- obtain green on all six percentages **on the same real source through real Worker + client**, not from cached archive fixture;
- log raw source and output letter counts *numerically* and finishReason, without logging private textbook text or keys;
- run targeted correction on only defective pages under limits; verify semantic fidelity fact-by-fact;
- test A4 actual PDF rendering/rows;
- only after success approve a new stable Android version.
