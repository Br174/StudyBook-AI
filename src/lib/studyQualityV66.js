// LAB66: local, non-blocking quality inspection after draft-first generation.
// NO Gemini calls, NO edits, NO false semantic certification, NO page fabrication.
// Preserve the historical stagedRows (approved cells) and every raw Gemini draft.
import {studyLetters,percentReduced,exactRetained} from './studyPillarV38.js';
import {extractProtectedItems} from './fidelityEngine.js';
import {rewriteQualityV65} from './rewriteQualityV65.js';
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
  let outputLetters=0;
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
  const reductionWarning=level==='summary'
   ?actualReduction!==null&&actualReduction<=50
   :actualReduction!==null&&Math.abs(actualReduction-Number(level))>2;
  const advisory=[
   ...(reductionWarning?['global-reduction-off-target']:[]),
   ...(!persistent?['checkpoint-not-persisted']:[])
  ];
  const alerts=pages.reduce((n,p)=>n+p.warnings.length,0)+advisory.length;
  levels[level]={
   total:pageCount,checked:checkedPages,available:availablePages,pages,
   warnings:alerts,advisory,
   originalLetters:sourceLetters,outputLetters,actualReduction,
   expectedLetters,exactLength:exact,
   semanticCertification:false,
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
