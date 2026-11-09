// LAB77 signed Android experimental release receipt.
// Only smoke-tested 503 pacing, large-block and checkpoint recoveries are
// authorized; actual Google server outcomes remain unknown.
export const STUDYBOOK_LAB77_RELEASE=Object.freeze({
  userIntent:'Fastest stable throughput without destructive retries or small blocks',
  sourceBranch:'lab/studybook-core-android-01-update-77-overload-pacing-20261109',
  safetyBranch:'lab/safety-studybook-core-android-01-update-77-pre-apk',
  protectedPreviousApk:'LAB76',
  androidApplicationId:'it.studybook.ai.lab',
  preservedLargeNaturalBlocks:true,
  preserveUserCurrentBookDrafts:true,
  regressionRun:42678516759,
  expectedBackend:'https://studybook-ai-lab76-bestof.brunoverlezza.workers.dev',
  automaticLastGoodPromotion:false,
  realDeviceGemini503Elimination:'NOT_GUARANTEED',
  extraPaidCostEuro:0
});
