// LAB76 receipt: user-authorized, experimental APK only.
// Not a generic guarantee that arbitrary future Gemini texts will be correct.
export const STUDYBOOK_LAB76_RELEASE_BASELINE=Object.freeze({
 operation:'LAB76_BEST_OF_ANDROID_TRIAL',
 signedUpdateFamily:'it.studybook.ai.lab',
 controlPlane:'MotorLab r40 + native StudyBook engine',
 activeFamilyAutoAdvance:false,
 sourceBranch:'lab/studybook-core-android-01-update-76-best-of-20261109',
 immutableSafetyBranch:'lab/safety-studybook-core-android-01-update-76-before',
 bestQuantitativeRef:'audit/studybook-best-of-all-qa-v103-20261109',
 bestSemanticRef:'audit/studybook-source-fact-review-v104-20261109',
 goldenPercentExamples:[64.94,50.00,40.25,29.72,20.70,9.91],
 historicSemanticFacts:{storia20:'13/13 editorial source facts',medicina10:'12 full, 2 partial, 1 context omitted'},
 numericTolerancePercentagePoints:5,
 actualProductionSummaryTarget:60,
 maxNaturalBlocks:true,
 noMandatoryTwoPrompt:true,
 previewGeminiBackend:'https://studybook-ai-lab76-bestof.brunoverlezza.workers.dev',
 independentSemanticCertification:false,
 usesFreePlanOnly:true,
 androidAcceptance:'PENDING_USER_ON_DEVICE'
});
