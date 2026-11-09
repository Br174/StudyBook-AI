// LAB79 signed APK retry after fixing GitHub JSON buffer in mandatory
// MotorLab active-family verification. No Scudo360 bypass and no Worker deploy.
export const LAB79_SIGNED_SAFETY_GATE_RETRY={
  testRun:42705418493,
  originalBuildFailure:'ACTIVE_FAMILY_BLOCKED spawnSync gh ENOBUFS',
  fix:'GitHub --jq projection status only; still fail-closed on wrong active SHA',
  applicationId:'it.studybook.ai.lab',
  preservePreviousLAST_GOOD:true,
  noPaidCosts:true,
  releaseType:'EXPERIMENTAL_SIGNED_ANDROID_PHASE3_HOTFIX'
};
