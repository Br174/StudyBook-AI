// LAB36 sparse, content-addressed edition checkpoints. Single existing MotorLab runtime.
import {apiEndpoint} from './apiEndpoint.js';
import {auditFidelity} from './fidelityEngine.js';
import {checkReducedParagraph,countLetters} from './studyQualityGuard.js';
import {splitLongParagraph} from './studyEngineV11.js';
import {normalizeStudyParagraphFlow} from './readingFlowV36.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause} from './geminiQuotaControllerV36.js';
import {makeRuntimeUnitKey,chooseRuntimeConcurrency,runAdaptiveBatchQueue,runtimeHash} from './motorLabRuntime.js';

export const GEMINI_LEVELS=['10','20','30','40','50','summary'];
const VERSION='lab36-gemini-editions-v1';
const excerpt=(v,n)=>String(v||'').trim().slice(0,n);
const originalOf=p=>String(p?.original||'');
export function auditGeminiLevels(original,editions){
  const verification={},texts={},issues={},percent={};
  for(const id of GEMINI_LEVELS){
    const text=normalizeStudyParagraphFlow(editions?.[id]||'');
    const structure=checkReducedParagraph(original,text);
    const semantic=auditFidelity(original,text);
    const reasons=[...structure.issues];
    if(!semantic.passed)reasons.push('semantic-coverage-or-protected-detail');
    verification[id]=Boolean(text)&&!reasons.length;
    texts[id]=text;
    issues[id]=reasons;
    percent[id]=countLetters(original)?Math.round((1-countLetters(text)/countLetters(original))*1000)/10:0;
  }
  return {verified:verification,editions:texts,issues,achievedPercent:percent};
}
let lastGeminiCallAt=0;
async function paceGeminiCall(paceMs){
  const safeGap=Math.max(0,Number(paceMs)||0);
  if(safeGap){
    const delay=Math.max(0,lastGeminiCallAt+safeGap-Date.now());
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  }
  lastGeminiCallAt=Date.now();
}
async function askGemini(source,context,level,repairIssues=[],paceMs=6500){
  await paceGeminiCall(paceMs);
  const response=await fetch(apiEndpoint('/api/editions/v36'),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({source,context,level,repairIssues}),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(data?.error||'Servizio Gemini temporaneamente non disponibile');
    error.code=data?.code||(response.status===429?'AI_QUOTA_LIMIT':'AI_SERVICE_ERROR');
    if(['AI_QUOTA_LIMIT','AI_QUOTA_MANUAL_REVIEW','AI_TEMPORARY_OVERLOAD'].includes(error.code)){
      error.quota=await registerGeminiPause(data?.quota||{
        kind:error.code==='AI_QUOTA_MANUAL_REVIEW'?'no-free-allocation':
          error.code==='AI_TEMPORARY_OVERLOAD'?'overload':'unknown',
        retryAfterSeconds:Number(response.headers?.get?.('Retry-After'))||null
      });
    }
    throw error;
  }
  if(data?.engine!=='ai'||data?.sourceVersion!=='original'||typeof data.editions?.[level]!=='string')
    throw Object.assign(new Error('Edizione Gemini incompleta'),{code:'INVALID_EDITION_RESPONSE'});
  await clearGeminiPause();
  return data.editions;
}
export function splitGeminiSourceV36(value,maxChars=680){
  const text=normalizeStudyParagraphFlow(value).replace(/\s+/g,' ').trim();
  if(!text)return [];
  if(text.length<=maxChars)return [text];
  const chunks=[];
  let rest=text;
  while(rest.length>maxChars){
    const prefix=rest.slice(0,maxChars+1);
    const sentenceCuts=[...prefix.matchAll(/[.!?;]\s+/g)]
      .map(x=>x.index+x[0].length).filter(n=>n>maxChars*0.45&&n<=maxChars);
    const natural=sentenceCuts.at(-1);
    const word=prefix.lastIndexOf(' ',maxChars);
    const at=natural||(word>maxChars*0.35?word+1:maxChars);
    chunks.push(rest.slice(0,at).trim());
    rest=rest.slice(at).trimStart();
  }
  if(rest.trim())chunks.push(rest.trim());
  return chunks;
}

function sourceWarnings(book,sourcePageStart,sourcePageEnd){
  const map=book.canonicalBookMap;
  if(!map)return [];
  const page=map.pages?.find(x=>x.physicalPage===sourcePageStart);
  const issues=[];
  if(page?.sourceStatus!=='verified')issues.push('source-page-not-verified');
  if(Number.isInteger(sourcePageEnd)&&sourcePageEnd!==sourcePageStart)issues.push('source-paragraph-crosses-pages');
  return issues;
}
function makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent){
  let verifiedCells=0,totalCells=0,blockedCells=0,verifiedChunks=0,verifiedVariants=0;
  const rows=(book.chapters||[]).map((chapter,ci)=>(chapter.paragraphs||[]).map((paragraph,pi)=>{
    totalCells++;
    const jobs=chapterJobs.get(ci+':'+pi)||[];
    const texts={},verified={},issues={},achievedPercent={};
    for(const id of GEMINI_LEVELS){
      const fragments=jobs.map(j=>state.get(j.key)?.verified?.[id]===true?state.get(j.key)?.editions?.[id]:null);
      const ready=jobs.length>0&&fragments.every(t=>typeof t==='string'&&t.trim());
      const joined=ready?normalizeStudyParagraphFlow(fragments.join(' ')):'';
      const final=ready?auditGeminiLevels(originalOf(paragraph),{[id]:joined}):null;
      verified[id]=ready&&final?.verified[id]===true;
      texts[id]=verified[id]?joined:null;
      achievedPercent[id]=verified[id]?final.achievedPercent[id]:null;
      issues[id]=verified[id]?[]:[...new Set(jobs.flatMap(j=>state.get(j.key)?.issues?.[id]||['not-verified']))];
    }
    verifiedVariants+=GEMINI_LEVELS.filter(id=>verified[id]).length;
    if(GEMINI_LEVELS.every(id=>verified[id]))verifiedCells++;else blockedCells++;
    verifiedChunks+=jobs.filter(j=>GEMINI_LEVELS.every(id=>state.get(j.key)?.verified?.[id])).length;
    return {editions:texts,verified,issues,achievedPercent,sourcePageStart:paragraph.sourcePageStart??null};
  }));
  const noReviewSource=(book.canonicalBookMap?.uncertain||[]).length===0;
  const complete=Boolean(totalCells)&&blockedCells===0&&noReviewSource&&checkpointPersistent;
  return {version:VERSION,sourceFingerprint:fingerprint,rows,verifiedCells,totalCells,blockedCells,
    verifiedChunks,verifiedVariants,totalVariants:totalCells*GEMINI_LEVELS.length,
    checkpointPersistent,complete,status:complete?'complete':'partial',updatedAt:new Date().toISOString()};
}
export async function generateGeminiEditionsV36(book,{onProgress=()=>{},maxConcurrency=1,paceMs=6500}={}){
  if(!book?.chapters?.length)throw new Error('Libro o capitoli assenti');
  const fingerprint=book.canonicalBookMap?.originalFingerprint||runtimeHash(
    book.chapters.map(c=>(c.paragraphs||[]).map(originalOf).join('|')).join('||'));
  const bookMemory=excerpt(book.chapters.map(c=>c.title).join(' | '),1000);
  const jobs=[],chapterJobs=new Map(),state=new Map();
  for(let ci=0;ci<book.chapters.length;ci++){
    const ch=book.chapters[ci];
    const paragraphs=ch.paragraphs||[];
    const chapterMemory=excerpt(paragraphs.map(originalOf).slice(0,3).join(' '),1200);
    for(let pi=0;pi<paragraphs.length;pi++){
      const paragraph=paragraphs[pi],source=originalOf(paragraph);
      const pageIssues=sourceWarnings(book,paragraph.sourcePageStart,paragraph.sourcePageEnd);
      const slices=splitLongParagraph(source).flatMap(x=>splitGeminiSourceV36(x)).filter(Boolean);
      const chunkJobs=[];
      for(let part=0;part<slices.length;part++){
        const text=slices[part];
        const context={chapterTitle:ch.title,sectionTitle:paragraph.sourceSection||'',
          bookMemory,chapterMemory,
          previousText:excerpt(part?slices[part-1]:originalOf(paragraphs[pi-1]),400),
          nextText:excerpt(part+1<slices.length?slices[part+1]:originalOf(paragraphs[pi+1]),400)};
        const key=makeRuntimeUnitKey({text,chapterTitle:ch.title,bookMemory,chapterMemory,
          previousText:context.previousText,nextText:context.nextText,
          sourceMeta:{sourcePageStart:paragraph.sourcePageStart,sourcePageEnd:paragraph.sourcePageEnd,
            sourceSection:paragraph.sourceSection}},VERSION+':'+fingerprint+':'+part);
        const job={key,source:text,context,pageIssues};
        chunkJobs.push(job);jobs.push(job);
      }
      chapterJobs.set(ci+':'+pi,chunkJobs);
    }
  }
  let checkpointPersistent=true;
  for(let i=0;i<jobs.length;i+=100){
    const wanted=jobs.slice(i,i+100),cache=await loadRuntimeUnitResults(wanted.map(j=>j.key));
    for(const j of wanted){
      const item=cache.get(j.key);
      if(item?.source===j.source&&item?.version===VERSION&&item?.editions&&item?.verified)
        state.set(j.key,item);
    }
  }
  // Incomplete checkpoints must be repaired, not treated as permanently finished.
  const pending=jobs.filter(j=>!GEMINI_LEVELS.every(id=>state.get(j.key)?.verified?.[id]===true));
  const blocked= pending.length ? await readGeminiPause() : null;
  if(blocked){
    const paused=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
    paused.quota=blocked;
    paused.status=blocked.automatic?'quota-paused':'quota-review';
    paused.execution={waves:0,pendingBefore:pending.length,resumedFromCache:jobs.length-pending.length,
      haltedOn:blocked.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',
      remainingBatches:pending.length};
    onProgress(paused,paused.verifiedVariants,paused.totalVariants);
    return paused;
  }
  const first=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
  onProgress(first,first.verifiedVariants,first.totalVariants);
  // Keep progress UI bounded (~40 snapshots) even for an 800-page book.
  const progressEvery=Math.max(5,Math.ceil(pending.length/40));
  const adaptive=await runAdaptiveBatchQueue({
    // One request at a time; free-tier requests share quotas across keys.
    batches:pending.map(j=>[j]),initialConcurrency:1,
    maxConcurrency:1,
    stopOnFailures:['AI_QUOTA_LIMIT','AI_QUOTA_MANUAL_REVIEW','AI_TEMPORARY_OVERLOAD','AI_NOT_CONFIGURED'],
    worker:async([job],{aiAllowed})=>{
      if(job.pageIssues.length||!job.source)return {job,aiFailure:'SOURCE_REVIEW',issues:job.pageIssues};
      if(!aiAllowed)return {job,aiFailure:'AI_PAUSED'};
      const previous=state.get(job.key)?.source===job.source?state.get(job.key):null;
      let record={source:job.source,version:VERSION,
        editions:{...(previous?.editions||{})},
        verified:{...(previous?.verified||{})},
        issues:{...(previous?.issues||{})},
        achievedPercent:{...(previous?.achievedPercent||{})}};
      let semanticFailure=false;
      for(const id of GEMINI_LEVELS){
        if(record.verified[id]===true)continue;
        try{
          // An edition is always generated from the original chunk, never from
          // a previously generated 10%, 20%, or 30% text.
          let editions=await askGemini(job.source,job.context,id,[],paceMs);
          let audit=auditGeminiLevels(job.source,editions);
          if(!audit.verified[id]){
            editions=await askGemini(job.source,job.context,id,audit.issues[id],paceMs);
            audit=auditGeminiLevels(job.source,editions);
          }
          // A one-edition response is the normal mode. A complete legacy response
          // is accepted only after independently auditing all provided levels.
          for(const receivedId of GEMINI_LEVELS){
            if(typeof editions[receivedId]!=='string'||!editions[receivedId].trim())continue;
            if(audit.verified[receivedId]){
              record.editions[receivedId]=audit.editions[receivedId];
              record.verified[receivedId]=true;
              record.issues[receivedId]=[];
              record.achievedPercent[receivedId]=audit.achievedPercent[receivedId];
            }else{
              record.issues[receivedId]=audit.issues[receivedId]||['semantic-review'];
              semanticFailure=true;
            }
          }
          // Atomic, durable per-variant checkpoint: quota rejection on variant 4
          // can never discard the preceding three verified editions.
          state.set(job.key,{...record});
          if(!await saveRuntimeUnitResults([{key:job.key,result:record}]))checkpointPersistent=false;
          const snapshot=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
          if(snapshot.verifiedVariants<=GEMINI_LEVELS.length*2||snapshot.verifiedVariants%12===0)
            onProgress(snapshot,snapshot.verifiedVariants,snapshot.totalVariants);
        }catch(error){
          return {job,record,aiFailure:error?.code||'AI_ERROR'};
        }
      }
      const valid=GEMINI_LEVELS.every(id=>record.verified[id]===true);
      return {job,record,aiSuccess:valid,aiFailure:valid?null:
        (semanticFailure?'SEMANTIC_REVIEW':'EDITION_INCOMPLETE')};
    },
    onWave:async({results,processedBatches,totalBatches})=>{
      const entries=results.filter(x=>x.record).map(x=>({key:x.job.key,result:x.record}));
      if(entries.length){
        const saved=await saveRuntimeUnitResults(entries);
        if(!saved)checkpointPersistent=false;
        entries.forEach(e=>state.set(e.key,e.result));
      }
      if(processedBatches%progressEvery===0||processedBatches===totalBatches){
        const snap=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
        onProgress(snap,snap.verifiedVariants,snap.totalVariants);
      }
    },
  });
  const final=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
  final.execution={waves:adaptive.waves,maxConcurrencyUsed:adaptive.maxConcurrencyUsed,
    pendingBefore:pending.length,resumedFromCache:jobs.length-pending.length,
    haltedOn:adaptive.haltedOn,remainingBatches:adaptive.remainingBatches};
  if(['AI_QUOTA_LIMIT','AI_TEMPORARY_OVERLOAD','AI_QUOTA_MANUAL_REVIEW'].includes(adaptive.haltedOn)){
    final.quota=await readGeminiPause();
    final.status=final.quota?.automatic?'quota-paused':'quota-review';
  }
  if(adaptive.haltedOn==='AI_NOT_CONFIGURED')final.status='ai-unavailable';
  onProgress(final,final.verifiedVariants,final.totalVariants);
  return final;
}
