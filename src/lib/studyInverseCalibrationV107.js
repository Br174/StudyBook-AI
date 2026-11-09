// StudyBook AI / MotorLab LAB107: research-only inverse calibration.
// LAB79 values are aggregate observations from one book, NOT provider laws.
// No change to production targets, no Gemini calls, no automatic text approval.
// Source budgets remain owned by studyPageBudgetsV74.js.
export const LAB79_AGGREGATE_OBSERVATIONS_V107=Object.freeze([
 Object.freeze({level:'summary',requestedReduction:60,observedReduction:87.1}),
 Object.freeze({level:'50',requestedReduction:50,observedReduction:84}),
 Object.freeze({level:'40',requestedReduction:40,observedReduction:76.7}),
 Object.freeze({level:'30',requestedReduction:30,observedReduction:75.4}),
 Object.freeze({level:'20',requestedReduction:20,observedReduction:64.8}),
 Object.freeze({level:'10',requestedReduction:10,observedReduction:44.1})
]);
const round=n=>Math.round(n*100)/100;
function validatedObservations(observations){
 if(!Array.isArray(observations)||observations.length<2)throw Error('CALIBRATION_INSUFFICIENT_ANCHORS');
 const points=observations.map(p=>({x:Number(p.requestedReduction),y:Number(p.observedReduction)})).sort((a,b)=>a.x-b.x);
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>100||p.y<0||p.y>100||
      (i>0&&(p.x<=points[i-1].x||p.y<=points[i-1].y)))
   throw Error('CALIBRATION_NON_MONOTONE_OR_INVALID_ANCHORS');
 }
 return points;
}
export function inverseEstimateV107(desiredActualReduction,observations=LAB79_AGGREGATE_OBSERVATIONS_V107){
 const points=validatedObservations(observations),desired=Number(desiredActualReduction);
 if(!Number.isFinite(desired)||desired<0||desired>100)throw Error('CALIBRATION_INVALID_TARGET');
 const min=points[0].y,max=points.at(-1).y;
 if(desired<min||desired>max)return {status:'OUTSIDE_OBSERVED_RESPONSE_RANGE',desiredActualReduction:desired,
  observedMinimum:min,observedMaximum:max,estimatedInternalRequest:null,reliableForNewPage:false};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(desired>=a.y&&desired<=b.y)return {
   status:'IN_RANGE_AGGREGATE_ESTIMATE',desiredActualReduction:desired,
   estimatedInternalRequest:round(a.x+(desired-a.y)*(b.x-a.x)/(b.y-a.y)),
   observedMinimum:min,observedMaximum:max,reliableForNewPage:false};
 }
 throw Error('CALIBRATION_INTERPOLATION_UNREACHABLE');
}
function unicodeLetterCount(text){
 return Array.from(String(text||'').normalize('NFC').matchAll(/\p{L}/gu)).length;
}
// Uses an authoritative budget provided by the existing studyPageBudgetsV74 module.
// Prompt is experimental: observed aggregate inverse is NOT injected into Gemini.
export function prepareLetterFirstTrialV107({source,level,budget,originalPageRows}={}){
 if(typeof source!=='string'||!source.trim())throw Error('ORIGINAL_REQUIRED');
 const n=unicodeLetterCount(source);
 if(!budget||n!==budget.originalLetters||!Number.isSafeInteger(n)||!n)
  throw Error('SOURCE_BUDGET_MISMATCH');
 const {targetLetters,minLetters,maxLetters,reductionPercent}=budget;
 if(![targetLetters,minLetters,maxLetters,reductionPercent].every(Number.isFinite)||
    minLetters>maxLetters||targetLetters<minLetters||targetLetters>maxLetters)
  throw Error('INVALID_OFFICIAL_LETTER_BUDGET');
 if(!['summary','10','20','30','40','50'].includes(String(level)))throw Error('INVALID_STUDY_LEVEL');
 if(String(level)==='summary'&&reductionPercent!==60&&reductionPercent!==65)
  throw Error('SUMMARY_POLICY_UNRECOGNIZED');
 if(String(level)!=='summary'&&Number(level)!==reductionPercent)
  throw Error('LEVEL_POLICY_MISMATCH');
 const isShort=Number.isInteger(originalPageRows)&&originalPageRows>=1&&originalPageRows<=5;
 const preservation=Number(level)<=20;
 const languageHint=preservation
  ?'Riscrittura conservativa: mantieni quasi tutto il ragionamento originale, con formulazioni più chiare; NON produrre un riassunto telegrafico.'
  :'Riscrittura sintetica ma completa: conserva i concetti indispensabili e le loro condizioni, non ridurli a parole chiave isolate.';
 const prompt=[
  'Livello didattico: '+level+'; riduzione ufficiale '+reductionPercent+'% delle lettere alfabetiche della SOLA pagina originale.',
  'Conteggio eseguito dal software: fonte '+n+' lettere Unicode. Testo desiderato circa '+targetLetters+' lettere da CONSERVARE (non eliminare).',
  'Banda ammessa dal budget ufficiale: minimo '+minLetters+', massimo '+maxLetters+' lettere da conservare.',
  languageHint,
  'Mantieni tutte le negazioni, condizioni, definizioni, eccezioni, numeri, termini tecnici imprescindibili e collegamenti causali della fonte.',
  'Tratta gli altri fogli come contesto in sola lettura. Non trasferire né duplicare contenuti tra pagine.',
  'Se la fonte non permette la quota senza perdere fatti, conserva i fatti e lascia che StudyBook segnali NON CONFORME.',
  'Non inventare, non allungare con riempitivi, non troncare frasi, non ridurre il font e non spostare contenuto alla pagina seguente.'
 ].join('\n');
 return {status:'EXPERIMENTAL_PROMPT_ONLY',approvedForApp:false,semanticCertified:false,
  level:String(level),officialReductionPercent:reductionPercent,retainedPercent:round(100-reductionPercent),
  budgetSource:'studyPageBudgetsV74',originalLetters:n,targetLetters,minLetters,maxLetters,
  shortPageExempt:isShort,
  summaryPolicy:reductionPercent===65?'RESEARCH_65':'APP_60_OR_STANDARD',
  inverseEvidence:inverseEstimateV107(reductionPercent),
  noBlindInversePromptInjection:true,requiresRealGeminiTrial:true,prompt};
}
export function classifyMeasuredResultV107({budget,outputLetters,originalPageRows,gridPass,semanticReviewPassed=false}={}){
 if(!budget||!Number.isSafeInteger(outputLetters)||outputLetters<0)
  throw Error('INVALID_MEASURED_RESULT');
 const {originalLetters,minLetters,maxLetters}=budget;
 if(!Number.isSafeInteger(originalLetters)||originalLetters<=0)
  throw Error('INVALID_ORIGINAL_LENGTH');
 const shortPageExempt=Number.isInteger(originalPageRows)&&originalPageRows>=1&&originalPageRows<=5;
 const achievedReduction=round(100*(originalLetters-outputLetters)/originalLetters);
 const quantitativePass=shortPageExempt||(outputLetters>=minLetters&&outputLetters<=maxLetters);
 return {achievedReduction,outputLetters,quantitativePass,gridPass:gridPass===true,
  semanticReviewPassed:semanticReviewPassed===true,
  fullyApproved:quantitativePass&&gridPass===true&&semanticReviewPassed===true,
  displayReduction:achievedReduction};
}
