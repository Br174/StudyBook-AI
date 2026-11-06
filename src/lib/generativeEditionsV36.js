// LAB36 sparse, content-addressed edition checkpoints. Single existing MotorLab runtime.
import {apiEndpoint} from './apiEndpoint.js';
import {auditFidelity} from './fidelityEngine.js';
import {checkReducedParagraph,countLetters} from './studyQualityGuard.js';
import {splitLongParagraph} from './studyEngineV11.js';
import {normalizeStudyParagraphFlow} from './readingFlowV36.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
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
async function askGemini(source,context,repairIssues=[]){
  const response=await fetch(apiEndpoint('/api/editions/v36'),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({source,context,repairIssues}),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(data?.error||'Servizio Gemini temporaneamente non disponibile');
    error.code=data?.code||'AI_SERVICE_ERROR';throw error;
  }
  if(data?.engine!=='ai'||data?.sourceVersion!=='original'||!data.editions)
    throw Object.assign(new Error('Edizioni Gemini non valide'),{code:'INVALID_EDITION_RESPONSE'});
  return data.editions;
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
  let verifiedCells=0,totalCells=0,blockedCells=0,verifiedChunks=0;
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
    if(GEMINI_LEVELS.every(id=>verified[id]))verifiedCells++;else blockedCells++;
    verifiedChunks+=jobs.filter(j=>GEMINI_LEVELS.every(id=>state.get(j.key)?.verified?.[id])).length;
    return {editions:texts,verified,issues,achievedPercent,sourcePageStart:paragraph.sourcePageStart??null};
  }));
  const noReviewSource=(book.canonicalBookMap?.uncertain||[]).length===0;
  const complete=Boolean(totalCells)&&blockedCells===0&&noReviewSource&&checkpointPersistent;
  return {version:VERSION,sourceFingerprint:fingerprint,rows,verifiedCells,totalCells,blockedCells,
    verifiedChunks,checkpointPersistent,complete,status:complete?'complete':'partial',updatedAt:new Date().toISOString()};
}
export async function generateGeminiEditionsV36(book,{onProgress=()=>{},maxConcurrency=2}={}){
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
      const slices=splitLongParagraph(source).filter(Boolean);
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
  onProgress(makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent),0,pending.length);
  const adaptive=await runAdaptiveBatchQueue({
    batches:pending.map(j=>[j]),initialConcurrency:chooseRuntimeConcurrency(maxConcurrency),
    maxConcurrency,
    stopOnFailures:['AI_QUOTA_LIMIT','AI_NOT_CONFIGURED'],
    worker:async([job],{aiAllowed})=>{
      if(job.pageIssues.length||!job.source)return {job,aiFailure:'SOURCE_REVIEW',issues:job.pageIssues};
      if(!aiAllowed)return {job,aiFailure:'AI_PAUSED'};
      try{
        let editions=await askGemini(job.source,job.context);
        let audit=auditGeminiLevels(job.source,editions);
        if(!GEMINI_LEVELS.every(id=>audit.verified[id])){
          const report=[...new Set(Object.values(audit.issues).flat())];
          editions=await askGemini(job.source,job.context,report);
          audit=auditGeminiLevels(job.source,editions);
        }
        // A failed regeneration cannot erase an already verified level.
        const previous=state.get(job.key);
        if(previous?.source===job.source&&previous?.version===VERSION){
          for(const id of GEMINI_LEVELS){
            if(previous.verified?.[id]===true && audit.verified[id]!==true){
              audit.verified[id]=true;
              audit.editions[id]=previous.editions[id];
              audit.issues[id]=[];
              audit.achievedPercent[id]=previous.achievedPercent?.[id]??null;
            }
          }
        }
        const record={source:job.source,version:VERSION,...audit};
        const valid=GEMINI_LEVELS.every(id=>audit.verified[id]);
        return {job,record,aiSuccess:valid,aiFailure:valid?null:'SEMANTIC_REVIEW'};
      }catch(error){return {job,aiFailure:error?.code||'AI_ERROR'};}
    },
    onWave:async({results,processedBatches,totalBatches})=>{
      const entries=results.filter(x=>x.record).map(x=>({key:x.job.key,result:x.record}));
      if(entries.length){
        const saved=await saveRuntimeUnitResults(entries);
        if(!saved)checkpointPersistent=false;
        entries.forEach(e=>state.set(e.key,e.result));
      }
      if(processedBatches%5===0||processedBatches===totalBatches){
        onProgress(makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent),
          processedBatches,totalBatches);
      }
    },
  });
  const final=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent);
  final.execution={waves:adaptive.waves,maxConcurrencyUsed:adaptive.maxConcurrencyUsed,
    pendingBefore:pending.length,resumedFromCache:jobs.length-pending.length,
    haltedOn:adaptive.haltedOn,remainingBatches:adaptive.remainingBatches};
  if(adaptive.haltedOn==='AI_QUOTA_LIMIT')final.status='quota-paused';
  if(adaptive.haltedOn==='AI_NOT_CONFIGURED')final.status='ai-unavailable';
  onProgress(final,adaptive.processedBatches,pending.length);
  return final;
}
