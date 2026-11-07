// LAB57: StudyBook AI "PRIMA CREA, POI VERIFICA".
// One owner for current study-pillar books; no parallel legacy runner.
// STAGE 1: produce and durably store every unverified Gemini draft of the six
// editions. STAGE 2: compare each complete edition with the original book,
// then repair only deficient FULL physical pages. No provisional study text
// can be published or exported as verified.
import {apiEndpoint} from './apiEndpoint.js';
import {runtimeHash} from './motorLabRuntime.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause} from './geminiQuotaControllerV36.js';
import {bookUnitsV51,planNaturalBlocksV51,bisectAtNaturalBoundaryV51,
  blockLetterTargetV51,BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';
import {restoredLargeBlockLimitV58,learnGeminiCadenceV58,
  markGeminiCadenceSuccessV58,waitForGeminiCadenceV58,
  readGeminiCadenceV58} from './geminiCadenceV58.js';
import {classifySourceReadinessV52} from './generativeIntegralV51.js';
import {publishSequentialPagesV51} from './pagePublicationV51.js';
import {studyLetters,percentReduced,exactRetained} from './studyPillarV38.js';
import {auditFidelity,auditProgressiveConcepts} from './fidelityEngine.js';
import {repairFocusForUnitV56} from './editionRepairV53.js';

const LEVELS=['summary','50','40','30','20','10'];
const CACHE='integral-v57-draft-first',VERSION='lab38-progressive-editions-v1';
const clean=x=>String(x||'').trim();
const signature=u=>runtimeHash(JSON.stringify([u.id,u.source,u.pageStart,u.pageEnd]));
const key=(fp,level,u)=>'mlr:'+CACHE+':'+fp+':'+level+':'+signature(u);
const priorKey=(fp,level,u)=>'mlr:integral-v51-verified-book-pages:'+fp+':'+
  level+':'+runtimeHash(JSON.stringify([[u.id,u.source,u.pageStart,u.pageEnd]]))+':draft';
const fingerprint=book=>book?.canonicalBookMap?.originalFingerprint||
  runtimeHash((book.chapters||[]).map(c=>(c.paragraphs||[]).map(p=>p.original).join('|')).join('||'));

function gridFrom(book,previous,fp){
 const match=previous?.sourceFingerprint===fp;
 const prevRows=match?(previous?.stagedRows||previous?.rows):null;
 const prevDraft=match?previous?.draftRowsV57:null;
 const rows=(book.chapters||[]).map((ch,ci)=>(ch.paragraphs||[]).map((p,pi)=>{
   const was=prevRows?.[ci]?.[pi],editions={},verified={},issues={},achievedPercent={};
   for(const level of LEVELS){
     const value=was?.verified?.[level]===true?clean(was.editions?.[level]):'';
     verified[level]=Boolean(value);
     editions[level]=value||null;
     issues[level]=value?[]:['pending-verification'];
     achievedPercent[level]=value?
       percentReduced(studyLetters(p.original),studyLetters(value)):null;
   }
   return {editions,verified,issues,achievedPercent,partialFragments:{},
     sourcePageStart:p.sourcePageStart??ch.pageStart??null};
 }));
 const drafts=(book.chapters||[]).map((ch,ci)=>(ch.paragraphs||[]).map((p,pi)=>{
   const editions={};
   for(const level of LEVELS){
     editions[level]=clean(rows[ci][pi].editions[level]||
       prevDraft?.[ci]?.[pi]?.editions?.[level])||null;
   }
   return {editions};
 }));
 return {rows,drafts};
}
function draftOf(drafts,u,level){return clean(drafts[u.ci]?.[u.pi]?.editions?.[level]);}
function saveDraftToGrid(drafts,u,level,value){
 drafts[u.ci][u.pi].editions[level]=clean(value);
}
function stats(book,units,rows,drafts,fp,diag,phase,checkpointPersistent=true){
 const published=publishSequentialPagesV51(book,rows);
 const flat=rows.flat();
 const count=flat.reduce((n,row)=>n+LEVELS.filter(level=>row.verified[level]).length,0);
 const ready=flat.filter(row=>LEVELS.every(level=>row.verified[level])).length;
 const draftUnitsSaved=units.reduce((n,u)=>n+LEVELS.filter(level=>draftOf(drafts,u,level)).length,0);
 const total=units.length*LEVELS.length;
 const complete=total>0&&count===total&&checkpointPersistent&&
   classifySourceReadinessV52(book).ok;
 return {version:VERSION,sourceFingerprint:fp,rows:published.rows,stagedRows:rows,
   draftRowsV57:drafts,draftUnitsSaved,draftUnitsTotal:total,
   draftComplete:draftUnitsSaved===total,phase:complete?'complete':phase,
   integralInputLimit:diag.inputLimit,repairAttemptsV57:diag.repairAttempts,
   publishedThroughPage:published.through,verifiedCells:ready,
   totalCells:units.length,blockedCells:units.length-ready,verifiedChunks:ready,
   verifiedVariants:count,totalVariants:total,
   verifiedChunkVariants:count,totalChunkVariants:total,
   diagnostics:{...diag,errorsByCode:{...diag.errorsByCode}},
   checkpointPersistent,complete,status:complete?'complete':
     phase==='draft'?'drafting':phase==='repair'?'reviewing':'quality-review',
   updatedAt:new Date().toISOString()};
}
function emit(onProgress,book,units,rows,drafts,fp,diag,phase,persisted=true,extra={}){
 const state={...stats(book,units,rows,drafts,fp,diag,phase,persisted),...extra};
 onProgress(state,state.verifiedVariants,state.totalVariants);
 return state;
}
function halt(onProgress,book,units,rows,drafts,fp,diag,phase,status,code,persisted=true,quota=null){
 const s=emit(onProgress,book,units,rows,drafts,fp,diag,phase,persisted);
 s.status=status;s.execution={haltedOn:code,remainingBatches:diag.remainingBatches||0};
 if(quota)s.quota=quota;
 onProgress(s,s.verifiedVariants,s.totalVariants);
 return s;
}
function pageSets(units){
 const pages=new Map();
 for(const u of units)for(let p=u.pageStart;p<=u.pageEnd;p++){
   const a=pages.get(p)||[];a.push(u);pages.set(p,a);
 }
 return pages;
}
function blocksForMissing(units,drafts,rows,level,inputLimit){
 const missingPages=new Set();
 for(const u of units)if(!draftOf(drafts,u,level)&&!rows[u.ci][u.pi].verified[level])
   for(let page=u.pageStart;page<=u.pageEnd;page++)missingPages.add(page);
 if(!missingPages.size)return [];
 const completePages=units.filter(u=>
   Array.from({length:u.pageEnd-u.pageStart+1},(_,i)=>u.pageStart+i)
     .some(page=>missingPages.has(page)));
 return planNaturalBlocksV51(completePages,level,{maxInputTokens:inputLimit});
}
function reviewEdition(units,drafts,level){
 const violations=[],missing=[],texts=[];
 for(const u of units){
   const output=draftOf(drafts,u,level);
   texts.push(output);
   if(!output){missing.push(u.id);violations.push({u,reasons:['draft-missing']});continue;}
   const semantic=auditFidelity(u.source,output);
   const concepts=auditProgressiveConcepts(u.source,output);
   const reasons=[];
   if(semantic.missingProtected.length)reasons.push('missing-protected');
   if(semantic.qualifierMismatches.length)reasons.push('scoped-qualifier');
   if(concepts.issues.length)reasons.push(...concepts.issues);
   if(reasons.length)violations.push({u,reasons:[...new Set(reasons)]});
 }
 const letters=units.reduce((n,u,i)=>n+studyLetters(texts[i]),0);
 const original=units.reduce((n,u)=>n+studyLetters(u.source),0);
 const target=level==='summary'?Math.max(0,exactRetained(original,50)-1):
   exactRetained(original,Number(level));
 const delta=level==='summary'?Math.max(0,letters-target):letters-target;
 const exact=level==='summary'?letters<=target:letters===target;
 return {level,missing,violations,letters,target,delta,exact,
   verified:missing.length===0&&violations.length===0&&exact};
}
function publishEdition(rows,units,drafts,level){
 for(const u of units){
   const value=draftOf(drafts,u,level),row=rows[u.ci][u.pi];
   row.editions[level]=value;
   row.verified[level]=true;row.issues[level]=[];
   row.achievedPercent[level]=percentReduced(studyLetters(u.source),studyLetters(value));
 }
}
async function request(block,level,{bookTitle='',signal=null,phase='draft',repairDrafts=[],
  targetOverride=null,onWait=()=>{}}={}){
 const target=blockLetterTargetV51(block,level),chars=block.reduce((n,u)=>n+u.source.length,0);
 const ratio=level==='summary'?0.44:1-Number(level)/100;
 const tokenBudget=Math.min(BULK_OUTPUT_TOKEN_CEILING,
   Math.max(4096,Math.ceil(chars*ratio/1.5)+block.length*115+1800));
 const expected=targetOverride===null?(level==='summary'?target.summaryCapLetters:target.targetLetters):
   Math.max(0,Math.floor(Number(targetOverride)));
 const body={phase,bookTitle,level,
   targetLetters:level==='summary'?null:expected,
   summaryCapLetters:level==='summary'?expected:null,
   maxOutputTokens:tokenBudget,timeoutMs:190000,repairDrafts,
   units:block.map(u=>({id:u.id,source:u.source,chapterTitle:u.chapterTitle,
     sectionTitle:u.sectionTitle,pageStart:u.pageStart,pageEnd:u.pageEnd}))};
 await waitForGeminiCadenceV58({signal,onWait});
 // The in-request wait is part of the existing single Gemini runner.
 // Re-check quota here because Android may resume after a background pause.
 const cooling=await readGeminiPause();
 if(cooling)throw Object.assign(new Error('Quota Gemini in attesa'),{
   code:'AI_QUOTA_LIMIT',quota:cooling});
 const startedAt=Date.now();
 const response=await fetch(apiEndpoint('/api/editions/bulk/v51'),{
   method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify(body)
 });
 const data=await response.json().catch(()=>null);
 if(!response.ok){
   const code=data?.code||(response.status===404?'AI_BULK_ENDPOINT_MISSING':'HTTP_'+response.status);
   if((response.status===429||response.status===503)&&data?.quota){
     await registerGeminiPause(data.quota);
     if(response.status===429)await learnGeminiCadenceV58(data.quota,{
       inputTokens:data?.diagnostic?.inputTokens||0});
   }
   throw Object.assign(new Error(data?.error||'Risposta Gemini non disponibile'),{
     code,quota:data?.quota||null,diagnostic:data?.diagnostic||null});
 }
 if(data?.engine!=='ai'||data?.version!=='integral-v51'||data?.level!==level)
   throw Object.assign(new Error('Provenienza risposta Gemini non verificata'),{code:'INVALID_EDITION_RESPONSE'});
 await markGeminiCadenceSuccessV58({requestStartedAt:startedAt,
   inputTokens:data?.inputTokens||0});
 return data;
}
async function restoreDrafts(units,drafts,rows,fp){
 for(const level of LEVELS){
   const open=units.filter(u=>!draftOf(drafts,u,level));
   if(!open.length)continue;
   const current=await loadRuntimeUnitResults(open.map(u=>key(fp,level,u)));
   const old=await loadRuntimeUnitResults(open.map(u=>priorKey(fp,level,u)));
   for(const u of open){
     const record=current.get(key(fp,level,u))||old.get(priorKey(fp,level,u));
     if(!record||record.id!==u.id||!clean(record.text))continue;
     if(record.kind==='draft-v57'&&record.signature===signature(u)||
       record.kind==='draft-v53'&&record.signature===runtimeHash(JSON.stringify([[u.id,u.source,u.pageStart,u.pageEnd]]))){
       saveDraftToGrid(drafts,u,level,record.text);
     }
   }
 }
}
function selectedRepairPages(units,issues,level){
 const problemPages=new Set();
 for(const item of issues.violations)for(let i=item.u.pageStart;i<=item.u.pageEnd;i++)
   problemPages.add(i);
 if(!problemPages.size&&!issues.exact){
   // Prefer the page with the most editable natural language, not the legal
   // citation by itself. The original pages remain indivisible.
   const size=new Map();
   for(const u of units)size.set(u.pageStart,(size.get(u.pageStart)||0)+u.source.length);
   const ranked=[...size].sort((a,b)=>b[1]-a[1]);
   if(ranked.length)problemPages.add(ranked[0][0]);
 }
 const matched=units.filter(u=>Array.from({length:u.pageEnd-u.pageStart+1},(_,i)=>u.pageStart+i)
   .some(p=>problemPages.has(p)));
 return {pages:[...problemPages],units:matched};
}
export async function generateDraftFirstV57(book,{onProgress=()=>{},onActivity=()=>{},signal=null}={}){
 const units=bookUnitsV51(book),fp=fingerprint(book),previous=book.editionsV36;
 const {rows,drafts}=gridFrom(book,previous,fp);
 const diagnostics={mode:'draft-first-v57',requestsSent:0,draftRequests:0,
   repairRequests:0,rawDraftsSaved:0,providerErrors:0,splits:0,errorsByCode:{},
   // A previous 503 can no longer permanently shrink a whole-book plan.
   // Provider hard 413 still splits safely at complete page boundaries.
   inputLimit:restoredLargeBlockLimitV58(previous),
   repairAttempts:{...(previous?.repairAttemptsV57||{})},phase:'draft',
   remainingBatches:0,lastCode:null};
 let persisted=true;
 const source=classifySourceReadinessV52(book,units);
 if(!source.ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
   'draft','source-review-needed','SOURCE_REVIEW',true);
 await restoreDrafts(units,drafts,rows,fp);
 // Learn a historical quota signal only once, after a LAB57-to-58 update.
 // Do not count opening the app repeatedly as new 429 failures.
 const oldPause=await readGeminiPause();
 if(oldPause?.kind==='requests-minute' && !(await readGeminiCadenceV58()))
   await learnGeminiCadenceV58(oldPause);
 emit(onProgress,book,units,rows,drafts,fp,diagnostics,'draft');
 // FIRST PHASE: finish every required draft, no pedagogical evaluation here.
 for(const level of LEVELS){
   const pending=blocksForMissing(units,drafts,rows,level,diagnostics.inputLimit);
   const queue=pending.map(block=>({block,attempt:0}));
   while(queue.length){
     diagnostics.remainingBatches=queue.length;
     const job=queue.shift(),block=job.block;
     if(block.every(u=>draftOf(drafts,u,level)))continue;
     if(signal?.aborted)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
       'draft','interrupted','AI_MANUAL_RESTART',persisted);
     const pause=await readGeminiPause();
     if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
       pause.automatic?'quota-paused':'quota-review',
       pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',persisted,pause);
     try{
       diagnostics.requestsSent++;diagnostics.draftRequests++;
       onActivity({phase:'draft',level,pageStart:block[0].pageStart,
         pageEnd:block.at(-1).pageEnd});
       const response=await request(block,level,{bookTitle:book.title||'',signal,
         phase:'draft',onWait:data=>onActivity({phase:'pacing',level,...data})});
       const indexed=new Map();
       for(const item of response.parts||[])if(typeof item?.id==='string'&&clean(item.text))
         indexed.set(item.id,clean(item.text));
       const newEntries=[];
       for(const u of block){
         if(draftOf(drafts,u,level))continue;
         const answer=indexed.get(u.id);
         if(answer)newEntries.push({u,text:answer,key:key(fp,level,u)});
       }
       if(newEntries.length){
         const ok=await saveRuntimeUnitResults(newEntries.map(x=>({key:x.key,result:{
           kind:'draft-v57',id:x.u.id,signature:signature(x.u),text:x.text}})));
         if(!ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
           'draft','local-storage-error','AI_CHECKPOINT_UNAVAILABLE',false);
         for(const item of newEntries)saveDraftToGrid(drafts,item.u,level,item.text);
         diagnostics.rawDraftsSaved+=newEntries.length;
         await clearGeminiPause();
       }
       emit(onProgress,book,units,rows,drafts,fp,diagnostics,'draft');
       const missing=block.filter(u=>!draftOf(drafts,u,level));
       if(!missing.length)continue;
       if(job.attempt>=1){
         const halves=bisectAtNaturalBoundaryV51(block);
         if(halves){diagnostics.splits++;queue.unshift(...halves.map(b=>({block:b,attempt:0})));continue;}
         return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
           'draft-incomplete','AI_INCOMPLETE_BLOCK',persisted);
       }
       queue.unshift({block,attempt:1});
     }catch(error){
       const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
       diagnostics.lastCode=code;diagnostics.providerErrors++;
       diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
       const pause=await readGeminiPause();
       // A 503 means server overload, not proof the source block is too big.
       // Keep the large-block plan unchanged; a genuine hard 413 may split.
       if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
         pause.automatic?'quota-paused':'quota-review',code,persisted,pause);
       if(code==='AI_MANUAL_RESTART')return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
         'draft','interrupted',code,persisted);
       const splittable=['AI_BLOCK_TOO_LARGE','AI_INCOMPLETE_BLOCK'].includes(code);
       const halves=splittable?bisectAtNaturalBoundaryV51(block):null;
       if(halves){diagnostics.splits++;queue.unshift(...halves.map(b=>({block:b,attempt:0})));continue;}
       return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'draft',
         'provider-blocked',code,persisted);
     }
   }
 }
 // Creation is complete before the FIRST semantic/percentage review.
 let state=emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 if(!state.draftComplete)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
   'draft','draft-incomplete','AI_INCOMPLETE_BLOCK',persisted);
 const reviews={};
 for(const level of LEVELS)reviews[level]=reviewEdition(units,drafts,level);
 diagnostics.quality={phase:'book-review',
   levels:Object.fromEntries(LEVELS.map(l=>[l,{exact:reviews[l].exact,
     missing:reviews[l].missing.length,semanticIssues:reviews[l].violations.length,
     target:reviews[l].target,actual:reviews[l].letters}]))};
 emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 // SECOND PHASE: at most one targeted whole-page attempt per level per
 // session, with a durable per-page attempt marker to avoid quota storms.
 for(const level of LEVELS){
   let review=reviews[level];
   if(review.verified){publishEdition(rows,units,drafts,level);continue;}
   const selection=selectedRepairPages(units,review,level);
   if(!selection.units.length)continue;
   const groups=planNaturalBlocksV51(selection.units,level,
     {maxInputTokens:diagnostics.inputLimit});
   // Bound additional requests. Always work on complete original pages.
   for(const group of groups){
     const id=level+':'+group[0].pageStart+'-'+group.at(-1).pageEnd;
     if(diagnostics.repairAttempts[id]>=1)continue;
     const pause=await readGeminiPause();
     if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'repair',
       pause.automatic?'quota-paused':'quota-review',
       pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',persisted,pause);
     const gap=review.exact?0:review.target-review.letters;
     const lengthBefore=group.reduce((n,u)=>n+studyLetters(draftOf(drafts,u,level)),0);
     const desired=Math.max(1,lengthBefore+gap);
     const repairDrafts=group.map(u=>({
       id:u.id,text:draftOf(drafts,u,level),
       repairFocus:repairFocusForUnitV56(u,level,draftOf(drafts,u,level))
     }));
     diagnostics.repairAttempts[id]=1;
     diagnostics.requestsSent++;diagnostics.repairRequests++;
     emit(onProgress,book,units,rows,drafts,fp,diagnostics,'repair');
     try{
       onActivity({phase:'repair',level,pageStart:group[0].pageStart,
         pageEnd:group.at(-1).pageEnd});
       const response=await request(group,level,{bookTitle:book.title||'',signal,
         phase:'repair',repairDrafts,targetOverride:desired,
         onWait:data=>onActivity({phase:'pacing',level,...data})});
       const indexed=new Map((response.parts||[]).filter(x=>clean(x?.text))
         .map(x=>[x.id,clean(x.text)]));
       const changes=group.filter(u=>indexed.has(u.id)&&
         !rows[u.ci][u.pi].verified[level]).map(u=>({
           u,text:indexed.get(u.id),key:key(fp,level,u)
         }));
       if(changes.length){
         const ok=await saveRuntimeUnitResults(changes.map(x=>({key:x.key,result:{
           kind:'draft-v57',id:x.u.id,signature:signature(x.u),text:x.text}})));
         if(!ok)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
           'repair','local-storage-error','AI_CHECKPOINT_UNAVAILABLE',false);
         for(const change of changes)saveDraftToGrid(drafts,change.u,level,change.text);
         await clearGeminiPause();
       }
       review=reviewEdition(units,drafts,level);
       reviews[level]=review;
       emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
       if(review.verified)break;
     }catch(error){
       const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
       diagnostics.lastCode=code;diagnostics.providerErrors++;
       diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
       const pause=await readGeminiPause();
       if(pause)return halt(onProgress,book,units,rows,drafts,fp,diagnostics,
         'repair',pause.automatic?'quota-paused':'quota-review',code,persisted,pause);
       return halt(onProgress,book,units,rows,drafts,fp,diagnostics,'repair',
         'provider-blocked',code,persisted);
     }
   }
   if(reviews[level].verified)publishEdition(rows,units,drafts,level);
   emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 }
 state=emit(onProgress,book,units,rows,drafts,fp,diagnostics,'review');
 if(!state.complete){
   state.status='quality-review';
   state.execution={haltedOn:'AI_QUALITY_REVIEW',remainingBatches:
     LEVELS.filter(l=>!reviews[l].verified).length};
   state.diagnostics.quality={phase:'book-review',
     levels:Object.fromEntries(LEVELS.map(l=>[l,{exact:reviews[l].exact,
       missing:reviews[l].missing.length,semanticIssues:reviews[l].violations.length,
       target:reviews[l].target,actual:reviews[l].letters}]))};
   onProgress(state,state.verifiedVariants,state.totalVariants);
 }
 return state;
}
