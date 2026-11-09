// LAB66: local, non-blocking quality inspection after draft-first generation.
// NO Gemini calls, NO edits, NO false semantic certification, NO page fabrication.
// Preserve the historical stagedRows (approved cells) and every raw Gemini draft.
import {studyLetters,percentReduced,exactRetained} from './studyPillarV38.js';
import {extractProtectedItems} from './fidelityEngine.js';
import {rewriteQualityV65} from './rewriteQualityV65.js';
import {measureEditionLengthV72} from './studyRebalancePolicyV67.js';
import {pageLetterReviewV74} from './studyPageBudgetsV74.js';
import {inspectBestOfV76,STUDY_BEST_OF_V76} from './studyBestOfV76.js';
export const STUDY_LEVELS_V66=['summary','50','40','30','20','10'];
const hasText=s=>typeof s==='string'&&s.trim().length>0;
const text=s=>hasText(s)?s.trim():null;
const safePage=x=>Number.isSafeInteger(Number(x))&&Number(x)>0?Number(x):null;
const warning=(code,page=null)=>({code,page});
export function studyQualityInspectionV66(book,units,stagedRows,drafts,{persistent=true}={}){
 const pageCount=safePage(book?.canonicalBookMap?.pageCount)||
  safePage(book?.sourceData?.structure?.pageCount)||0;
 const byPage=new Map(Array.from({length:pageCount},(_,i)=>[i+1,[]]));
 const sourceLetters=units.reduce((n,u)=>n+studyLetters(u.source),0);
 const publicRows=(book?.chapters||[]).map((chapter,ci)=>
  (chapter.paragraphs||[]).map((_,pi)=>({
   ...(stagedRows?.[ci]?.[pi]||{}),
   editions:{...(stagedRows?.[ci]?.[pi]?.editions||{})},
   verified:{...(stagedRows?.[ci]?.[pi]?.verified||{})},
   issues:{...(stagedRows?.[ci]?.[pi]?.issues||{})},
   bestOfV76:{...(stagedRows?.[ci]?.[pi]?.bestOfV76||{})},
   // This field explicitly distinguishes availability from old certification.
   generatedWithoutCertificationV66:true
  })));
 for(const u of units){
  const start=safePage(u.pageStart),end=safePage(u.pageEnd);
  if(!start||!end||start>end||end>pageCount)continue;
  for(let p=start;p<=end;p++)byPage.get(p).push(u);
 }
 const levels={};
 const through={};
 for(const level of STUDY_LEVELS_V66){
  let outputLetters=0,bestOfInspected=0,bestOfNumeric=0,bestOfWarnings=0;
  const notes=new Map();
  const add=(page,code)=>{
   const list=notes.get(page)||[];
   if(!list.includes(code))list.push(code);
   notes.set(page,list);
  };
  for(const u of units){
   const saved=text(drafts?.[u.ci]?.[u.pi]?.editions?.[level])||
    (stagedRows?.[u.ci]?.[u.pi]?.verified?.[level]===true
      ?text(stagedRows?.[u.ci]?.[u.pi]?.editions?.[level]):null);
   const row=publicRows[u.ci]?.[u.pi];
   if(!row)continue;
   row.editions[level]=saved;
   // Legacy reader expects verified=true for a visible edition. This flag is
   // ONLY an availability bridge in rows; stagedRows retains actual approvals.
   row.verified[level]=Boolean(saved&&persistent);
   row.issues[level]=saved?['quality-check-noncertified-v66']:
    ['no-saved-text-v66'];
   if(!saved){
    for(let p=u.pageStart;p<=u.pageEnd;p++)add(p,'missing-text');
    continue;
   }
   outputLetters+=studyLetters(saved);
   // LAB76: inspect each original physical page / inseparable range from
   // immutable source; this is local, advisory, and consumes ZERO Gemini quota.
   const best=inspectBestOfV76(u.source,saved,level);
   row.bestOfV76[level]=best;
   bestOfInspected++;
   if(best.numericAndVirtualGrid)bestOfNumeric++;
   bestOfWarnings+=best.semanticAdvisories.length;
   for(let p=u.pageStart;p<=u.pageEnd;p++){
    if(!best.withinBand)add(p,'best-of-source-percent-off-target');
    if(!best.gridFits)add(p,'best-of-virtual-grid-warning');
    for(const code of best.semanticAdvisories)add(p,'best-of-'+code);
   }
   const mirror=rewriteQualityV65(u.source,saved,level);
   if(mirror.needsRewrite)
    for(let p=u.pageStart;p<=u.pageEnd;p++)add(p,'similar-to-original');
   // Only WARN on exact legal-reference discrepancies; paraphrases may be
   // semantically correct with different vocabulary. No automatic veto.
   const references=extractProtectedItems(u.source).filter(item=>
    ['date-number','legal-ref','deadline'].includes(item.kind));
   const lower=saved.toLocaleLowerCase('it-IT');
   if(references.some(item=>!lower.includes(item.value.toLocaleLowerCase('it-IT'))))
    for(let p=u.pageStart;p<=u.pageEnd;p++)add(p,'reference-check');
  }
  const pages=Array.from({length:pageCount},(_,idx)=>{
   const page=idx+1,mapped=byPage.get(page)||[];
   if(!mapped.length)add(page,'missing-original-page-map');
   const present=mapped.length>0&&mapped.every(u=>
    hasText(publicRows[u.ci]?.[u.pi]?.editions?.[level]));
   if(!present&&mapped.length)add(page,'missing-text');
   return {page,hasText:present,checked:Boolean(present&&persistent),
    warnings:notes.get(page)||[]};
  });
  const checkedPages=pages.filter(p=>p.checked).length;
  const availablePages=pages.filter(p=>p.hasText).length;
  const actualReduction=percentReduced(sourceLetters,outputLetters);
  const expectedLetters=level==='summary'?null:
    exactRetained(sourceLetters,Number(level));
  const exact=expectedLetters===null?null:expectedLetters===outputLetters;
  const numericReview=measureEditionLengthV72({level,originalLetters:sourceLetters,
    outputLetters,completeParts:checkedPages===pageCount&&pageCount>0});
  const perPage=pageLetterReviewV74(units,units.map(u=>({
    id:u.id,text:publicRows?.[u.ci]?.[u.pi]?.editions?.[level]})),level);
  // No text is generated or modified by QA. Page budgets are a numeric
  // observation after the first complete draft, not a creation gate.
  const reductionWarning=!numericReview.compliant||!perPage.withinBand;
  const advisory=[
   ...(reductionWarning?['global-reduction-off-target']:[]),
   ...(!perPage.withinBand?['source-page-letter-budget-off-target']:[]),
   ...(!persistent?['checkpoint-not-persisted']:[])
  ];
  const alerts=pages.reduce((n,p)=>n+p.warnings.length,0)+advisory.length;
  levels[level]={
   total:pageCount,checked:checkedPages,available:availablePages,pages,
   warnings:alerts,advisory,
   originalLetters:sourceLetters,outputLetters,actualReduction,
   expectedLetters,exactLength:exact,
   reductionCompliant:numericReview.compliant&&perPage.withinBand,
   originalPageLetterBudgetsV74:perPage.groups.map(g=>({
     pageStart:g.pageStart,pageEnd:g.pageEnd,
     originalLetters:g.originalLetters,targetLetters:g.targetLetters,
     minLetters:g.minLetters,maxLetters:g.maxLetters,
     outputLetters:g.outputLetters,withinBand:g.withinBand
   })),
   reductionBand:{min:numericReview.minLetters,max:numericReview.maxLetters},
   semanticCertification:false,
   bestOfV76:{protocol:STUDY_BEST_OF_V76,examinedUnits:bestOfInspected,
    compliantNumericAndVirtualGrid:bestOfNumeric,
    sourceMeaningWarnings:bestOfWarnings,semanticCertified:false,
    scope:'advisory-not-physical-A4-proof'},
   state:checkedPages===pageCount&&persistent?'checked-with-notes':'incomplete'
  };
  let contiguous=0;
  for(const p of pages){if(!p.hasText)break;contiguous=p.page;}
  through[level]=contiguous;
 }
 const full=pageCount>0&&persistent&&STUDY_LEVELS_V66.every(l=>
  levels[l].checked===pageCount);
 return {version:'lab66-quality-only-v1',full,levels,publicRows,through,
  summary:{
   checkedPages:STUDY_LEVELS_V66.reduce((n,l)=>n+levels[l].checked,0),
   totalPages:pageCount*STUDY_LEVELS_V66.length,
   warnings:STUDY_LEVELS_V66.reduce((n,l)=>n+levels[l].warnings,0),
   semanticCertification:false,
   autoCorrections:0,
   geminiRequests:0
  }};
}
export function finalizeStudyQualityV66(book,units,rows,drafts,previousState,
 onProgress=()=>{}){
 const persisted=previousState.checkpointPersistent!==false;
 const inspected=studyQualityInspectionV66(book,units,rows,drafts,{persistent:persisted});
 const {publicRows,through,full,summary,levels}=inspected;
 const {qualityV66:ignored,...withoutOldAudit}=previousState;
 const state={...withoutOldAudit,
  rows:publicRows,stagedRows:rows,draftRowsV57:drafts,
  publishedThroughPage:through,
  qualityV66:{version:inspected.version,levels,summary},
  phase:'quality',status:full?'complete':'quality-notes',
  complete:Boolean(full&&previousState.draftComplete),
  publicationModeV66:'generated-text-quality-not-certified',
  qualityAvailableV66:true,
  execution:{haltedOn:null,remainingBatches:0},
  quota:null,updatedAt:new Date().toISOString()};
 onProgress(state,state.verifiedChunkVariants,state.totalChunkVariants);
 return state;
}
