// LAB51: canonical generator for full-page/full-chapter Gemini blocks.
// Replaces tiny-fragment generation for new books, reuses the same edition,
// recovery, quota, IndexedDB and publication contracts as LAB36-50.
import {apiEndpoint} from './apiEndpoint.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause} from './geminiQuotaControllerV36.js';
import {runtimeHash} from './motorLabRuntime.js';
import {auditFidelity,auditProgressiveConcepts} from './fidelityEngine.js';
import {studyLetters,percentReduced} from './studyPillarV38.js';
import {publishSequentialPagesV51} from './pagePublicationV51.js';
import {reviewGeminiPartsV53,auditStudyUnitV53} from './editionRepairV53.js';
import {bookUnitsV51,planNaturalBlocksV51,bisectAtNaturalBoundaryV51,
  blockLetterTargetV51,BULK_OUTPUT_TOKEN_CEILING,adaptiveOverloadBudgetV54} from './integralPlannerV51.js';

const LEVELS=['summary','50','40','30','20','10'];
const VERSION='lab38-progressive-editions-v1';
const CACHE_VERSION='integral-v51-verified-book-pages';
const sourceFingerprint=book=>book.canonicalBookMap?.originalFingerprint||
  runtimeHash((book.chapters||[]).map(c=>(c.paragraphs||[]).map(p=>p.original).join('|')).join('||'));
const clean=v=>String(v||'').trim();
const signature=block=>runtimeHash(JSON.stringify(block.map(u=>[u.id,u.source,u.pageStart,u.pageEnd])));
const recordKey=(fingerprint,level,block)=>'mlr:'+CACHE_VERSION+':'+fingerprint+':'+level+':'+signature(block);

// LAB52: an outline/printed-numbering warning is NOT missing source content.
// The original fingerprint and every physical page's verified text remain hard gates.
export function classifySourceReadinessV52(book,units=[]){
  const map=book?.canonicalBookMap;
  if(!map)return {ok:true,blocking:[],warnings:[],reason:null};
  const warnings=Array.isArray(map.uncertain)?[...new Set(map.uncertain)]:[];
  const blocking=[];
  const pages=Array.isArray(map.pages)?map.pages:[];
  if(!pages.length||!Number.isInteger(Number(map.pageCount))||
     Number(map.pageCount)!==pages.length)
    blocking.push('source-page-count-mismatch');
  // Do not replace source integrity with an editable chapter/title heuristic.
  if(!/^[a-f0-9]{64}$/i.test(String(map.originalFingerprint||''))||
     warnings.includes('original-sha256-not-verified'))
    blocking.push('original-sha256-not-verified');
  const byPage=new Map(pages.map(p=>[Number(p.physicalPage),p]));
  const unavailable=[];
  for(let i=1;i<=Number(map.pageCount||0);i++){
    if(byPage.get(i)?.sourceStatus!=='verified')unavailable.push(i);
  }
  for(const unit of units){
    for(let page=unit.pageStart;page<=unit.pageEnd;page++){
      if(byPage.get(page)?.sourceStatus!=='verified')unavailable.push(page);
    }
  }
  if(unavailable.length)blocking.push('source-pages-not-verified');
  return {ok:blocking.length===0,blocking:[...new Set(blocking)],
    blockingPages:[...new Set(unavailable)].sort((a,b)=>a-b),
    // Printed PDF labels, outline confidence and section headings are advisory.
    // They remain visible to the source reviewer without stopping Gemini.
    warnings,reason:blocking[0]||null};
}
function newGrid(book,previous,fingerprint){
  const validPrior=previous?.sourceFingerprint===fingerprint&&previous.rows?.length===book.chapters.length;
  return (book.chapters||[]).map((ch,ci)=>(ch.paragraphs||[]).map((p,pi)=>{
    const saved=validPrior?(previous.stagedRows||previous.rows)?.[ci]?.[pi]:null;
    const editions={},verified={},issues={},achievedPercent={};
    for(const level of LEVELS){
      const isValid=saved?.verified?.[level]===true&&clean(saved?.editions?.[level]);
      editions[level]=isValid?clean(saved.editions[level]):null;
      verified[level]=Boolean(isValid);
      issues[level]=isValid?[]:['not-verified'];
      achievedPercent[level]=isValid?percentReduced(studyLetters(p.original),studyLetters(editions[level])):null;
    }
    return {editions,verified,issues,achievedPercent,partialFragments:{},
      sourcePageStart:p.sourcePageStart??ch.pageStart??null};
  }));
}
function snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,activeLevel){
  const {rows,through}=publishSequentialPagesV51(book,grid);
  const flat=grid.flat();
  const totalCells=flat.length;
  const verifiedVariants=flat.reduce((n,row)=>n+LEVELS.filter(id=>row.verified[id]).length,0);
  const verifiedCells=flat.filter(row=>LEVELS.every(id=>row.verified[id])).length;
  const publishedVariants=rows.flat().reduce((n,row)=>n+LEVELS.filter(id=>row.verified[id]).length,0);
  const complete=totalCells>0&&verifiedCells===totalCells&&checkpointPersistent
    &&classifySourceReadinessV52(book).ok;
  return {version:VERSION,sourceFingerprint:fingerprint,rows,stagedRows:grid,
    publishedThroughPage:through,publishedVariants,integralInputLimit:diagnostics.inputLimit,
    verifiedCells,totalCells,blockedCells:totalCells-verifiedCells,
    verifiedChunks:verifiedCells,verifiedVariants,totalVariants:totalCells*LEVELS.length,
    verifiedChunkVariants:verifiedVariants,totalChunkVariants:totalCells*LEVELS.length,
    diagnostics:{...diagnostics,errorsByCode:{...diagnostics.errorsByCode}},
    checkpointPersistent,complete,status:complete?'complete':'partial',
    activeLevel,updatedAt:new Date().toISOString()};
}
function blockAlreadyReady(grid,block,level){
  return block.every(u=>grid[u.ci]?.[u.pi]?.verified?.[level]===true);
}
async function requestBlock(block,level,{bookTitle='',signal=null,repairDrafts=[]}={}){
  const {targetLetters,summaryCapLetters}=blockLetterTargetV51(block,level);
  const sourceChars=block.reduce((n,u)=>n+u.source.length,0);
  const ratio=level==='summary'?0.44:1-Number(level)/100;
  const tokenBudget=Math.min(BULK_OUTPUT_TOKEN_CEILING,
    Math.max(4096,Math.ceil(sourceChars*ratio/1.5)+block.length*115+1800));
  const response=await fetch(apiEndpoint('/api/editions/bulk/v51'),{
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({bookTitle,level,targetLetters,summaryCapLetters,
      maxOutputTokens:tokenBudget,timeoutMs:190000,repairDrafts,
      unitBudgets:Object.fromEntries(block.map(u=>[u.id,{
        targetLetters:u.targetLetters??null,summaryCapLetters:u.summaryCapLetters??null
      }])),
      units:block.map(u=>({id:u.id,source:u.source,chapterTitle:u.chapterTitle,
        sectionTitle:u.sectionTitle,pageStart:u.pageStart,pageEnd:u.pageEnd}))})});
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const code=data?.code||(response.status===404?'AI_BULK_ENDPOINT_MISSING':'HTTP_'+response.status);
    if((response.status===429||response.status===503)&&data?.quota)
      await registerGeminiPause(data.quota);
    throw Object.assign(new Error(data?.error||'Edizione integrale non completata.'),{code,
      diagnostic:data?.diagnostic||null,quota:data?.quota||null});
  }
  return data;
}
function addBlock(grid,block,level,parts){
  for(let i=0;i<block.length;i++){
    const u=block[i],row=grid[u.ci][u.pi],text=parts[i];
    row.editions[level]=text;row.verified[level]=true;row.issues[level]=[];
    row.achievedPercent[level]=percentReduced(studyLetters(u.source),studyLetters(text));
  }
}
// LAB53: one canonical executor, no second scheduler. Each complete model
// response is inspected per source paragraph, never discarded wholesale.
const unitKey=(fp,level,unit,kind)=>recordKey(fp,level,[unit])+':'+kind;
function addVerifiedRow(grid,u,level,text){
 const row=grid[u.ci][u.pi];
 row.editions[level]=text;row.verified[level]=true;row.issues[level]=[];
 row.achievedPercent[level]=percentReduced(studyLetters(u.source),studyLetters(text));
}
function publicFailureSnapshot(book,grid,fp,persisted,diag,level,status,code,remaining,quota=null){
 diag.lastCode=code;
 const out={...snapshot(book,grid,fp,persisted,diag,level),
   status,execution:{haltedOn:code,remainingBatches:remaining,
     verifiedBlocks:diag.verifiedBlocks,requestsSent:diag.requestsSent,
     splits:diag.splits,verifiedUnits:diag.verifiedUnits}};
 if(quota)out.quota=quota;
 return out;
}
export async function generateIntegralEditionsV51(book,{
 onProgress=()=>{},onActivity=()=>{},signal=null
}={}){
 const units=bookUnitsV51(book);
 const fp=sourceFingerprint(book);
 const grid=newGrid(book,book.editionsV36,fp);
 const diagnostics={processedJobs:0,providerErrors:0,sourceBlocked:0,errorsByCode:{},
   lastCode:null,mode:'large-natural-page-blocks-v53-with-verified-draft-salvage',
   requestsSent:0,splits:0,verifiedBlocks:0,verifiedUnits:0,
   repairedDrafts:0,rawDraftsPreserved:0,quality:null,
   inputLimit:Number(book?.editionsV36?.integralInputLimit)||900000};
 let checkpointPersistent=true;
 const readiness=classifySourceReadinessV52(book,units);
 if(!readiness.ok){
   const blocked=publicFailureSnapshot(book,grid,fp,true,diagnostics,'summary',
     'source-review-needed','SOURCE_REVIEW',units.length);
   blocked.sourceReview=readiness;
   onProgress(blocked,blocked.verifiedVariants,blocked.totalVariants);
   return blocked;
 }
 // Restore previously VERIFIED per-unit results, including successful units
 // from a partly rejected 44-page response. Check provenance AND meaning.
 for(const level of LEVELS){
   const allocated=planNaturalBlocksV51(units,level,{maxInputTokens:diagnostics.inputLimit}).flat();
   const keys=allocated.map(u=>unitKey(fp,level,u,'verified'));
   const cached=await loadRuntimeUnitResults(keys);
   for(const u of allocated){
     if(grid[u.ci]?.[u.pi]?.verified?.[level])continue;
     const row=cached.get(unitKey(fp,level,u,'verified'));
     if(row?.kind!=='verified-v53'||row.id!==u.id||row.signature!==signature([u]))continue;
     if(!auditStudyUnitV53(u,level,row.text).ok)continue;
     addVerifiedRow(grid,u,level,row.text);
   }
 }
 let current=snapshot(book,grid,fp,checkpointPersistent,diagnostics,LEVELS[0]);
 onProgress(current,current.verifiedVariants,current.totalVariants);
 for(const level of LEVELS){
   const planned=planNaturalBlocksV51(units,level,{maxInputTokens:diagnostics.inputLimit});
   const queue=planned.map(block=>({block,attempt:0}));
   while(queue.length){
     const job=queue.shift(),block=job.block;
     if(blockAlreadyReady(grid,block,level))continue;
     const remaining=queue.length+1;
     if(signal?.aborted){
       const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
         level,'interrupted','AI_MANUAL_RESTART',remaining);
       onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
     }
     const pause=await readGeminiPause();
     if(pause){
       const code=pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW';
       const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
         level,pause.automatic?'quota-paused':'quota-review',code,remaining,pause);
       onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
     }
     const draftKeys=block.map(u=>unitKey(fp,level,u,'draft'));
     const drafts=await loadRuntimeUnitResults(draftKeys);
     const repairDrafts=block.filter(u=>!grid[u.ci][u.pi].verified[level]).flatMap(u=>{
       const stored=drafts.get(unitKey(fp,level,u,'draft'));
       return stored?.kind==='draft-v53'&&stored.id===u.id&&
         stored.signature===signature([u])&&clean(stored.text)
         ?[{id:u.id,text:stored.text}]:[];
     });
     try{
       diagnostics.requestsSent++;
       onActivity({phase:repairDrafts.length?'repair':'request',level,
         pageStart:block[0].pageStart,pageEnd:block[block.length-1].pageEnd});
       const response=await requestBlock(block,level,{
         bookTitle:book.title||'',signal,repairDrafts});
       onActivity({phase:'response',level});
       if(response?.engine!=='ai'||response?.version!=='integral-v51'||
          response?.level!==level)throw Object.assign(
            new Error('Risposta Gemini senza provenienza verificabile.'),
            {code:'INVALID_EDITION_RESPONSE'});
       const review=reviewGeminiPartsV53(block,level,response.parts);
       diagnostics.quality={level,reasons:Object.keys(review.numeric.issues||{}).slice(0,5),
         issues:review.numeric.issues,received:review.numeric.received,
         expected:review.numeric.expected,
         verified:review.numeric.verified,unverified:review.numeric.unverified};
       const writes=[];
       for(const result of review.verified){
         const u=result.unit;
         if(grid[u.ci][u.pi].verified[level])continue;
         writes.push({key:unitKey(fp,level,u,'verified'),result:{
           kind:'verified-v53',id:u.id,signature:signature([u]),text:result.text}});
       }
       for(const problem of review.failed){
         const u=problem.unit;
         if(grid[u.ci][u.pi].verified[level]||!clean(problem.draft))continue;
         writes.push({key:unitKey(fp,level,u,'draft'),result:{
           kind:'draft-v53',id:u.id,signature:signature([u]),text:problem.draft}});
       }
       if(writes.length){
         const persisted=await saveRuntimeUnitResults(writes);
         if(!persisted){
           checkpointPersistent=false;
           const stopped=publicFailureSnapshot(book,grid,fp,false,diagnostics,level,
             'local-storage-error','AI_CHECKPOINT_UNAVAILABLE',remaining);
           onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);
           return stopped;
         }
       }
       for(const good of review.verified){
         const u=good.unit;
         if(grid[u.ci][u.pi].verified[level])continue;
         addVerifiedRow(grid,u,level,good.text);
         diagnostics.verifiedUnits++;
       }
       diagnostics.rawDraftsPreserved+=review.failed.filter(x=>clean(x.draft)).length;
       diagnostics.processedJobs++;
       current=snapshot(book,grid,fp,checkpointPersistent,diagnostics,level);
       onProgress(current,current.verifiedVariants,current.totalVariants);
       if(blockAlreadyReady(grid,block,level)){diagnostics.verifiedBlocks++;await clearGeminiPause();continue;}
       diagnostics.errorsByCode.AI_QUALITY_REVIEW=(diagnostics.errorsByCode.AI_QUALITY_REVIEW||0)+1;
       diagnostics.lastCode='AI_QUALITY_REVIEW';
       // ONE repair pass at the same natural boundaries, then split only at
       // complete physical pages or chapters. No endless identical retries.
       if(job.attempt===0&&review.structural&&review.numeric.received>0){
         diagnostics.repairedDrafts++;
         queue.unshift({block,attempt:1});continue;
       }
       const halves=bisectAtNaturalBoundaryV51(block);
       if(halves){
         diagnostics.splits++;
         queue.unshift({block:halves[0],attempt:0},{block:halves[1],attempt:0});
         continue;
       }
       const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
         level,'quality-review','AI_QUALITY_REVIEW',remaining);
       onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
     }catch(error){
       const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
       diagnostics.lastCode=code;
       diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
       diagnostics.providerErrors++;
       diagnostics.lastProvider={code,reason:error?.diagnostic?.reason||null,
         status:error?.diagnostic?.status||null,
         elapsedMs:error?.diagnostic?.elapsedMs||null};
       if(error?.quota?.kind==='tokens-minute'){
         const estimate=Math.ceil(block.reduce((n,u)=>n+u.source.length,0)/2)+1200;
         const quotaCap=Number(error.quota.limit);
         const observed=quotaCap>0?Math.min(quotaCap,estimate):estimate;
         diagnostics.inputLimit=Math.max(1600,Math.min(diagnostics.inputLimit,
           Math.floor(observed*.65)));
       }
       const pause=await readGeminiPause();
       if(pause?.kind==='overload'||error?.quota?.kind==='overload'){
         // One scheduler owns the wait. The NEXT pass plans smaller requests
         // ending ONLY at complete physical pages/chapters. Verified rows stay.
         const adjusted=adaptiveOverloadBudgetV54(block,level,diagnostics.inputLimit,
           pause?.attempts||1);
         diagnostics.inputLimit=adjusted.inputLimit;
         diagnostics.overloadRecovery={
           previousLimit:adjusted.previousLimit,nextLimit:adjusted.inputLimit,
           reduced:adjusted.reduced,attempts:pause?.attempts||1,
           method:adjusted.reason
         };
       }
       if(pause){
         const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
           level,pause.automatic?'quota-paused':'quota-review',code,remaining,pause);
         onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
       }
       if(code==='AI_MANUAL_RESTART'){
         const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
           level,'interrupted',code,remaining);
         onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
       }
       const splitting=['AI_BLOCK_TOO_LARGE','AI_INCOMPLETE_BLOCK','AI_QUALITY_REVIEW',
         'AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK'].includes(code);
       const halves=splitting?bisectAtNaturalBoundaryV51(block):null;
       if(halves){
         diagnostics.splits++;
         queue.unshift({block:halves[0],attempt:0},{block:halves[1],attempt:0});
         continue;
       }
       const stopped=publicFailureSnapshot(book,grid,fp,checkpointPersistent,diagnostics,
         level,code==='AI_QUALITY_REVIEW'?'quality-review':'provider-blocked',code,remaining);
       onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
     }
   }
 }
 const final=snapshot(book,grid,fp,checkpointPersistent,diagnostics,LEVELS.at(-1));
 final.execution={haltedOn:null,remainingBatches:0,
   maxConcurrencyUsed:1,verifiedBlocks:diagnostics.verifiedBlocks,
   requestsSent:diagnostics.requestsSent,splits:diagnostics.splits};
 onProgress(final,final.verifiedVariants,final.totalVariants);
 return final;
}
