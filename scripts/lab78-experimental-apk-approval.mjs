// Signed LAB78 Android trial receipt: EXPERIMENTAL ONLY.
// The user asked to install implemented row/letter geometry to test on real
// books. Prior live Gemini six-level proof is explicitly NOT fully green.
// Do not promote to production or LAST_GOOD until exact device acceptance.
export const STUDYBOOK_LAB78_EXPERIMENTAL=Object.freeze({
  purpose:'real Android test of source-page 60-cell geometry and no-false-green numeric QA',
  coreMotorLab:'2026.10.29-r40',
  branch:'lab/studybook-core-android-01-update-78-true-geometry-20261109',
  safetyBranch:'lab/safety-studybook-core-android-01-update-78-before',
  androidApplicationId:'it.studybook.ai.lab',
  preserveSigningFamily:true,preserveInstalledBooksAndCheckpoints:true,
  targetGeminiWorker:'https://studybook-ai-lab78-geometry.brunoverlezza.workers.dev',
  geometryMethod:'lab78-real-worker-60-cell-source-pages-v1',
  noSmallBlockRegression:true,noHiddenPaidModel:true,
  lastGoodAutoPromotion:false,
  offlineWorkerParity:'pass:42691454125',
  liveRealGeminiFirst:'FAIL:2-of-6:42692051709',
  liveRealGeminiSecond:'FAIL:3-of-6:42693051227',
  nativeEndToEnd:'BLOCKED_BY_REAL_HTTP503:42693886427',
  semanticAccuracyCertified:false,
  percentageAccuracyForUnknownBooksCertified:false,
  validForStableUpdate:false,
  phase:'INSTALLABLE_EXPERIMENT_TO_DIAGNOSE_AND_IMPROVE'
});
