// StudyBook AI / MotorLab LAB106 — research-only ONE-call generation standard.
// A single dispatch may cover a batch of complete original pages for ONE study
// level. It NEVER calls Gemini to plan, check, or fix a response.
// Keep the existing provider/native routing untouched until separately approved.
// Numerically valid text is NOT semantically certified for publication.
import {studyLetters} from './studyPillarV38.js';
import {sourceLetterBudgetV74} from './studyPageBudgetsV74.js';

export const ONE_CALL_PROTOCOL_V106='studybook-one-provider-dispatch-per-source-batch-and-level-v106';
export const SINGLE_CALL_LEVELS_V106=[65,50,40,30,20,10];
export const ROW_WIDTH_V106=60;

function letters(value){return studyLetters(String(value||'').normalize('NFC'))}
function normalize(value){return String(value??'').normalize('NFC').replace(/\s+/gu,' ').trim()}
// Historical LAB97–105 Riassunto is a 65% research target (60–70%).
// Existing APP summary policy instead targets 60% (55–65%). They must NOT
// be silently conflated. This module is isolated experimental research only.
function researchBudget(source,level){
 const n=letters(source);
 if(Number(level)===65){
  return{originalLetters:n,reductionPercent:65,targetLetters:Math.round(n*.35),
    minLetters:Math.ceil(n*.30),maxLetters:Math.floor(n*.40),
    integerFeasible:Math.ceil(n*.30)<=Math.floor(n*.40)};
 }
 return sourceLetterBudgetV74(n,String(level));
}
function stamp(source,level){return JSON.stringify([normalize(source),level])}
function baselineEquivalent(a,b){return stamp(a.source,a.level)===stamp(b.source,b.level)}
export function virtualRowsV106(text,width=ROW_WIDTH_V106){
 const tokens=normalize(text).split(' ').filter(Boolean);
 let line='',overlong=false;const rows=[];
 for(const token of tokens){
  if([...token].length>width)overlong=true;
  const joined=line?line+' '+token:token;
  if([...joined].length>width&&line){rows.push(line);line=token}
  else line=joined;
 }
 if(line)rows.push(line);
 return{rows:rows.length,overlong,lastRowCells:[...(rows.at(-1)||'')].length};
}
export function localOrthographyV106(source,draft){
 let text=String(draft??'').normalize('NFC');
 const notes=[];
 const changes=[
  // These are punctuation/orthography only; not a license to infer facts.
  {label:'poiche_accent',pattern:/\bpoiche\b/giu,replace:'poiché'},
  {label:'perche_accent',pattern:/\bperche\b/giu,replace:'perché'},
  {label:'apostrophe_l_altra',pattern:/\bl\s+altra\b/giu,replace:"l'altra",
   condition:/\bl['’]altra\b/iu.test(source)},
  {label:'apostrophe_l_asse',pattern:/\bl\s+asse\b/giu,replace:"l'asse",
   condition:/\bl['’]asse\b/iu.test(source)},
  {label:'apostrophe_dell_asse',pattern:/\bdell\s+asse\b/giu,replace:"dell'asse",
   condition:/\bdell['’]asse\b/iu.test(source)}
 ];
 for(const c of changes){
  if(c.condition===false)continue;
  const next=text.replace(c.pattern,c.replace);
  if(next!==text){text=next;notes.push(c.label)}
 }
 return{text,notes,changed:text!==draft};
}
export function measuredPageV106(source,text,level,{maxRows=Infinity,shortPageExempt=false}={}){
 if(!SINGLE_CALL_LEVELS_V106.includes(Number(level)))throw Error('UNSUPPORTED_LEVEL');
 const b=researchBudget(source,level);
 const n=letters(text),layout=virtualRowsV106(text);
 const rangePass=shortPageExempt?true:b.integerFeasible&&n>=b.minLetters&&n<=b.maxLetters;
 const gridPass=layout.rows<=maxRows&&!layout.overlong;
 return{
  sourceLetters:b.originalLetters,actualLetters:n,
  savedLetters:b.originalLetters-n,
  actualReductionPercent:+(100*(1-n/b.originalLetters)).toFixed(2),
  targetReductionPercent:b.reductionPercent,
  targetLetters:b.targetLetters,minLetters:b.minLetters,maxLetters:b.maxLetters,
  rows:layout.rows,maxRows,
  percentPass:rangePass,gridPass,
  numericGridPass:rangePass&&gridPass,
  shortPageExempt,integerFeasible:b.integerFeasible
 };
}
function semanticAdvisory(source,text,sourceRiskChecks=[]){
 const problems=[];
 for(const check of sourceRiskChecks){
  const observation=check({source,text});
  if(observation?.risk||observation?.missing||observation?.reversed)
   problems.push(observation?.risk||observation?.id||'SOURCE_FACT_REVIEW');
 }
 return problems;
}
// Only modify a candidate by replacing its anchored span with wording that
// appears VERBATIM in the immutable ORIGINAL. Never synthesize new facts.
export function localSourcePatchV106(source,draft,{oldSpan,newSpan}={}){
 if(typeof oldSpan!=='string'||!oldSpan||typeof newSpan!=='string'||!newSpan)
  return{applied:false,reason:'PATCH_SPANS_REQUIRED',text:draft};
 if(!normalize(source).includes(normalize(newSpan)))
  return{applied:false,reason:'REPLACEMENT_NOT_IN_ORIGINAL',text:draft};
 if(draft.split(oldSpan).length!==2)
  return{applied:false,reason:'UNIQUE_DRAFT_ANCHOR_REQUIRED',text:draft};
 return{applied:true,reason:'SOURCE_LITERAL_ONLY',text:draft.replace(oldSpan,newSpan)};
}
// Deliberately no fetching/retrying/second model call in here.
// invokeOnce must be a DIRECT single provider dispatch adapter, without
// automatic HTTP retries. App integration must verify this at the network layer.
export async function runSingleCallV106({
 source,sourceId='page',level,invokeOnce,maxRows=Infinity,
 shortPageExempt=false,prior=null,sourceRiskChecks=[],sourceAnchoredPatches=[]
}={}){
 if(typeof source!=='string'||!source.trim()||!SINGLE_CALL_LEVELS_V106.includes(Number(level)))
  throw Error('INVALID_ORIGINAL_OR_LEVEL');
 if(typeof invokeOnce!=='function')throw Error('SINGLE_DISPATCH_ADAPTER_REQUIRED');
 if(!Number.isFinite(maxRows)&&maxRows!==Infinity)throw Error('INVALID_ROW_CAP');
 let dispatches=0;
 const contract={source,sourceId,level:Number(level),target:researchBudget(source,level)};
 let response;
 try{
  dispatches++;
  response=await invokeOnce(contract); // exactly ONE external invocation
 }catch(error){
  return{protocol:ONE_CALL_PROTOCOL_V106,dispatches,status:'PROVIDER_UNAVAILABLE',providerError:String(error?.code||error?.message||'UNAVAILABLE'),
   selected:prior?.text||null,selectedFrom:prior?'FROZEN_INCUMBENT':'NONE',
   semanticCertified:false,approvedForApp:false};
 }
 const raw=typeof response==='string'?response:response?.text;
 if(typeof raw!=='string'||!raw.trim()){
  return{protocol:ONE_CALL_PROTOCOL_V106,dispatches,status:'INVALID_PROVIDER_RESPONSE',
   selected:prior?.text||null,selectedFrom:prior?'FROZEN_INCUMBENT':'NONE',
   semanticCertified:false,approvedForApp:false};
 }
 const candidates=[{text:raw,kind:'ORIGINAL_GEMINI',localEdits:[]}];
 const orth=localOrthographyV106(source,raw);
 if(orth.changed)candidates.push({text:orth.text,kind:'LOCAL_ORTHOGRAPHY',localEdits:orth.notes});
 // Strictly bounded pre-reviewed source literal substitutions, no third-party AI.
 for(const patch of sourceAnchoredPatches.slice(0,4)){
  const current=candidates.at(-1);
  const changed=localSourcePatchV106(source,current.text,patch);
  if(changed.applied&&changed.text!==current.text)
   candidates.push({text:changed.text,kind:'LOCAL_SOURCE_LITERAL',localEdits:[...current.localEdits,'source_literal']});
 }
 const measured=candidates.map(c=>({...c,
  numeric:measuredPageV106(source,c.text,level,{maxRows,shortPageExempt}),
  semanticWarnings:semanticAdvisory(source,c.text,sourceRiskChecks)}));
 const original=measured[0];
 const meetsAll=c=>c.numeric.numericGridPass&&c.semanticWarnings.length===0;
 const sort=(a,b)=>{
  if(meetsAll(a)!==meetsAll(b))return Number(meetsAll(b))-Number(meetsAll(a));
  if(a.numeric.numericGridPass!==b.numeric.numericGridPass)return Number(b.numeric.numericGridPass)-Number(a.numeric.numericGridPass);
  if(a.semanticWarnings.length!==b.semanticWarnings.length)return a.semanticWarnings.length-b.semanticWarnings.length;
  const target=a.numeric.targetReductionPercent;
  const delta=Math.abs(a.numeric.actualReductionPercent-target)-Math.abs(b.numeric.actualReductionPercent-target);
  if(delta!==0)return delta;
  // Prefer safe punctuation/orthography-only local correction on an exact tie.
  // Source-literal content replacements never win ties on typography alone.
  const order={LOCAL_ORTHOGRAPHY:0,ORIGINAL_GEMINI:1,LOCAL_SOURCE_LITERAL:2};
  return(order[a.kind]??3)-(order[b.kind]??3);
 };
 const available=measured.sort(sort);
 const candidate=available[0];
 const incumbent=prior&&prior.source===source&&Number(prior.level)===Number(level)&&typeof prior.text==='string'
   ?{...prior,numeric:measuredPageV106(source,prior.text,level,{maxRows,shortPageExempt}),
     semanticWarnings:semanticAdvisory(source,prior.text,sourceRiskChecks)}:null;
 // Never choose a new text on numeric score alone when a prior certified
 // editorial choice is stronger; source-risk checks are only advisory.
 const incumbentEligible=incumbent?.numeric.numericGridPass&&incumbent.semanticWarnings.length===0;
 const incomingEligible=meetsAll(candidate);
 const preservePrior=Boolean(incumbentEligible && (
   !incomingEligible ||
   (prior.editorialBaseline===true && candidate.text!==incumbent.text)
 ));
 const chosen=preservePrior?incumbent:candidate;
 return{
  protocol:ONE_CALL_PROTOCOL_V106,sourceId,level:Number(level),
  dispatches,providerReplyCount:1,localVariantsReviewed:measured.length,
  status:chosen.numeric.numericGridPass
   ?(chosen.semanticWarnings.length?'NUMERIC_PASS_SEMANTIC_REVIEW_REQUIRED':'PRELIMINARY_REVIEW_REQUIRED')
   :'NONCONFORMING_REQUIRES_EXPLICIT_REVIEW',
  selected:chosen.text,selectedFrom:preservePrior?'FROZEN_INCUMBENT':chosen.kind,
  numeric:chosen.numeric,semanticWarnings:chosen.semanticWarnings,
  originalGeminiNumeric:original.numeric,
  localEdits:preservePrior?[]:chosen.localEdits,
  noAdditionalGeminiCall:true,
  semanticCertified:false,approvedForApp:false,
  caveat:'Formal semantic certification needs independent fact-by-fact validation; never fabricate missing knowledge.'
 };
}
