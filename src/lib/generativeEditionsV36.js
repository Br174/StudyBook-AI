// LAB36 sparse, content-addressed edition checkpoints. Single existing MotorLab runtime.
import {apiEndpoint} from './apiEndpoint.js';
import {auditFidelity} from './fidelityEngine.js';
import {checkReducedParagraph,countLetters} from './studyQualityGuard.js';
import {splitLongParagraph} from './studyEngineV11.js';
import {normalizeStudyParagraphFlow} from './readingFlowV36.js';
import {loadRuntimeUnitResults,saveRuntimeUnitResults} from './resumeStore.js';
import {readGeminiPause,registerGeminiPause,clearGeminiPause} from './geminiQuotaControllerV36.js';
import {makeRuntimeUnitKey,chooseRuntimeConcurrency,runAdaptiveBatchQueue,runtimeHash} from './motorLabRuntime.js';
import {STUDY_PILLAR_VERSION,STUDY_PERCENTAGES,allocateExactLetterBudgets,
  inspectProgressiveEdition} from './studyPillarV38.js';
import {progressDiagnostic} from './geminiRecoveryV39.js';

export const GEMINI_LEVELS=['10','20','30','40','50','summary'];
const VERSION='lab38-progressive-editions-v1';
// Preserve LAB36/37 content-addressed keys: old verified results can be reused
// only if they pass the NEW immutable pedagogical contract.
const CACHE_KEY_VERSION='lab36-gemini-editions-v1';
const excerpt=(v,n)=>String(v||'').trim().slice(0,n);
const originalOf=p=>String(p?.original||'');
export function auditGeminiLevels(original,editions,{pillar=false,targetByLevel={},summaryCapLetters=null}={}){
  const verification={},texts={},issues={},percent={};
  for(const id of GEMINI_LEVELS){
    const text=normalizeStudyParagraphFlow(editions?.[id]||'');
    const structure=checkReducedParagraph(original,text);
    const semantic=auditFidelity(original,text);
    // A protected legal statement must keep its *meaning and reference*, not
    // the entire original sentence verbatim. Literal-equality here made real
    // 50% reductions logically impossible in legal study material.
    const reasons=pillar && !semantic.missingProtected?.length
      ?structure.issues.filter(issue=>issue!=='protected-text-lost')
      :[...structure.issues];
    if(pillar){
      const pedagogical=inspectProgressiveEdition(original,text,id,{
        targetLetters:targetByLevel[id],summaryCapLetters});
      reasons.push(...pedagogical.issues);
      // Preserve scoped negations, dates, legal references, exceptions and named anchors.
      if(semantic.missingProtected.length||semantic.qualifierMismatches.length)
        reasons.push('protected-meaning-review');
      // This conservative lexical gate is NOT a substitute for human semantic
      // validation, but blocks trivially unrelated and missing-concept outputs.
      const minCoverage=id==='summary'?50:id==='50'?60:id==='40'?64:
        id==='30'?68:id==='20'?72:78;
      if(semantic.coveragePercent<minCoverage)
        reasons.push('core-concept-coverage-below-'+minCoverage);
    }else if(!semantic.passed)reasons.push('semantic-coverage-or-protected-detail');
    verification[id]=Boolean(text)&&!reasons.length;
    texts[id]=text;
    issues[id]=reasons;
    percent[id]=countLetters(original)?Math.round((1-countLetters(text)/countLetters(original))*1000)/10:0;
  }
  return {verified:verification,editions:texts,issues,achievedPercent:percent};
}
let lastGeminiCallAt=0;
const manualRecoveryError=()=>Object.assign(new Error('Ripresa manuale richiesta'),{code:'AI_MANUAL_RESTART'});
async function paceGeminiCall(paceMs,signal){
  if(signal?.aborted)throw manualRecoveryError();
  const safeGap=Math.max(0,Number(paceMs)||0);
  const delay=Math.max(0,lastGeminiCallAt+safeGap-Date.now());
  if(delay){
    await new Promise((resolve,reject)=>{
      const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(manualRecoveryError());};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},delay);
      signal?.addEventListener('abort',stop,{once:true});
      if(signal?.aborted)stop();
    });
  }
  if(signal?.aborted)throw manualRecoveryError();
  lastGeminiCallAt=Date.now();
}
async function askGemini(source,context,level,repairIssues=[],paceMs=6500,signal=null,policy=null,targetLetters=null,summaryCapLetters=null,repairDraft=null){
  await paceGeminiCall(paceMs,signal);
  let response;
  try{
    response=await fetch(apiEndpoint('/api/editions/v36'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({source,context,level,repairIssues,policy,targetLetters,summaryCapLetters,repairDraft}),signal,
    });
  }catch(error){
    if(signal?.aborted)throw manualRecoveryError();
    throw Object.assign(new Error('Connessione Gemini interrotta'),{code:'AI_TIMEOUT_OR_NETWORK',cause:error});
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const error=new Error(data?.error||'Servizio Gemini temporaneamente non disponibile');
    error.code=data?.code||(response.status===429?'AI_QUOTA_LIMIT':'AI_SERVICE_ERROR');
    if(/^AI_PROVIDER_\d{3}$/.test(error.code))error.code='AI_PROVIDER_REJECTED';
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

// A paragraph legitimately spanning several *verified* physical pages is
// not a corrupt source. Only missing/unverified pages block that paragraph.
export function sourceWarnings(book,sourcePageStart,sourcePageEnd){
  const map=book?.canonicalBookMap;
  if(!map?.pages?.length)return [];
  const start=Number(sourcePageStart),end=Number(sourcePageEnd??sourcePageStart);
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start)
    return ['source-page-owner-unresolved'];
  const byPage=new Map(map.pages.map(page=>[Number(page.physicalPage),page]));
  if(end>map.pages.length || end-start>map.pages.length)
    return ['source-page-range-outside-original'];
  const reasons=[];
  for(let physical=start;physical<=end;physical++){
    const page=byPage.get(physical);
    if(!page)reasons.push('source-page-not-mapped');
    else if(page.sourceStatus!=='verified')reasons.push('source-page-not-verified');
  }
  return [...new Set(reasons)];
}
function makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics=null){
  const pillar=book?.studyPillarV38===STUDY_PILLAR_VERSION;
  let verifiedCells=0,totalCells=0,blockedCells=0,verifiedChunks=0,verifiedVariants=0;
  let verifiedChunkVariants=0,totalChunkVariants=0;
  const rows=(book.chapters||[]).map((chapter,ci)=>(chapter.paragraphs||[]).map((paragraph,pi)=>{
    totalCells++;
    const jobs=chapterJobs.get(ci+':'+pi)||[];
    const texts={},verified={},issues={},achievedPercent={};
    totalChunkVariants+=jobs.length*GEMINI_LEVELS.length;
    for(const job of jobs)for(const id of GEMINI_LEVELS){
      if(state.get(job.key)?.verified?.[id]===true)verifiedChunkVariants++;
    }
    for(const id of GEMINI_LEVELS){
      const fragments=jobs.map(j=>state.get(j.key)?.verified?.[id]===true?state.get(j.key)?.editions?.[id]:null);
      const ready=jobs.length>0&&fragments.every(t=>typeof t==='string'&&t.trim());
      const joined=ready?normalizeStudyParagraphFlow(fragments.join(' ')):'';
      const final=ready?auditGeminiLevels(originalOf(paragraph),{[id]:joined},{
        pillar,targetByLevel:pillar?{[id]:jobs.reduce((n,j)=>n+(j.targets?.[id]||0),0)}:{},
        summaryCapLetters:pillar?jobs.reduce((n,j)=>n+(j.summaryCapLetters||0),0):null,
      }):null;
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
    verifiedChunkVariants,totalChunkVariants,
    diagnostics:diagnostics?{...diagnostics,errorsByCode:{...diagnostics.errorsByCode}}:null,
    checkpointPersistent,complete,status:complete?'complete':'partial',updatedAt:new Date().toISOString()};
}
export async function generateGeminiEditionsV36(book,{onProgress=()=>{},onActivity=()=>{},maxConcurrency=1,paceMs=6500,signal=null}={}){
  if(!book?.chapters?.length)throw new Error('Libro o capitoli assenti');
  const fingerprint=book.canonicalBookMap?.originalFingerprint||runtimeHash(
    book.chapters.map(c=>(c.paragraphs||[]).map(originalOf).join('|')).join('||'));
  const bookMemory=excerpt(book.chapters.map(c=>c.title).join(' | '),1000);
  const jobs=[],chapterJobs=new Map(),state=new Map();
  const pillar=book?.studyPillarV38===STUDY_PILLAR_VERSION;
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
            sourceSection:paragraph.sourceSection}},CACHE_KEY_VERSION+':'+fingerprint+':'+part);
        const job={key,source:text,context,pageIssues};
        chunkJobs.push(job);jobs.push(job);
      }
      chapterJobs.set(ci+':'+pi,chunkJobs);
    }
  }
  if(pillar){
    const sources=jobs.map(j=>j.source);
    for(const pct of STUDY_PERCENTAGES){
      const assigned=allocateExactLetterBudgets(sources,pct);
      assigned.forEach((letters,i)=>{
        jobs[i].targets??={};
        jobs[i].targets[String(pct)]=letters;
      });
    }
    // 42% maximum retained letters for the first, outline-style summary.
    const caps=allocateExactLetterBudgets(sources,58);
    caps.forEach((cap,i)=>{jobs[i].summaryCapLetters=cap;});
  }
  let checkpointPersistent=true;
  const diagnostics={sourceBlocked:0,providerErrors:0,processedJobs:0,lastCode:null,errorsByCode:{},quality:null};
  for(let i=0;i<jobs.length;i+=100){
    const wanted=jobs.slice(i,i+100),cache=await loadRuntimeUnitResults(wanted.map(j=>j.key));
    for(const j of wanted){
      const item=cache.get(j.key);
      if(item?.source===j.source&&item?.editions&&item?.verified){
        const safe={...item,version:VERSION,verified:{...item.verified},
          issues:{...(item.issues||{})},achievedPercent:{...(item.achievedPercent||{})}};
        // Old results are not destroyed but MUST NOT be treated as approved
        // when they do not match the exact new letter budget or core anchors.
        if(pillar)for(const level of GEMINI_LEVELS){
          if(!safe.verified[level])continue;
          const result=auditGeminiLevels(j.source,{[level]:safe.editions[level]},{
            pillar:true,targetByLevel:j.targets,summaryCapLetters:j.summaryCapLetters});
          safe.verified[level]=result.verified[level];
          safe.issues[level]=result.issues[level];
          safe.achievedPercent[level]=result.achievedPercent[level];
        }
        state.set(j.key,safe);
      }
    }
  }
  // Incomplete checkpoints must be repaired, not treated as permanently finished.
  const pending=jobs.filter(j=>!GEMINI_LEVELS.every(id=>state.get(j.key)?.verified?.[id]===true));
  const blocked= pending.length ? await readGeminiPause() : null;
  if(blocked){
    const paused=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics);
    paused.quota=blocked;
    paused.status=blocked.automatic?'quota-paused':'quota-review';
    paused.execution={waves:0,pendingBefore:pending.length,resumedFromCache:jobs.length-pending.length,
      haltedOn:blocked.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',
      remainingBatches:pending.length};
    onProgress(paused,paused.verifiedVariants,paused.totalVariants);
    return paused;
  }
  const first=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics);
  onProgress(first,first.verifiedVariants,first.totalVariants);
  // Keep progress UI bounded (~40 snapshots) even for an 800-page book.
  const progressEvery=Math.max(5,Math.ceil(pending.length/40));
  let savedVariantsThisRun=0;
  const adaptive=await runAdaptiveBatchQueue({
    // One request at a time; free-tier requests share quotas across keys.
    batches:pending.map(j=>[j]),initialConcurrency:1,
    maxConcurrency:1,
    stopOnFailures:['AI_QUALITY_REVIEW','AI_MANUAL_RESTART','AI_QUOTA_LIMIT','AI_QUOTA_MANUAL_REVIEW','AI_TEMPORARY_OVERLOAD',
      'AI_NOT_CONFIGURED','AI_PROVIDER_REJECTED','AI_SERVICE_ERROR',
      'AI_TIMEOUT_OR_NETWORK','INVALID_EDITION_RESPONSE','INVALID_GENERATIVE_RESPONSE'],
    worker:async([job],{aiAllowed})=>{
      if(job.pageIssues.length||!job.source)return {job,aiFailure:'SOURCE_REVIEW',issues:job.pageIssues};
      if(!aiAllowed)return {job,aiFailure:'AI_PAUSED'};
      if(signal?.aborted)return {job,aiFailure:'AI_MANUAL_RESTART'};
      const previous=state.get(job.key)?.source===job.source?state.get(job.key):null;
      let record={source:job.source,version:VERSION,
        editions:{...(previous?.editions||{})},
        verified:{...(previous?.verified||{})},
        issues:{...(previous?.issues||{})},
        achievedPercent:{...(previous?.achievedPercent||{})},
        drafts:{...(previous?.drafts||{})}};
      let semanticFailure=false;
      // Prioritize the student's starting point: summary first, then progressively deeper editions.
      const generationOrder=pillar?['summary','50','40','30','20','10']:GEMINI_LEVELS;
      for(const id of generationOrder){
        if(record.verified[id]===true)continue;
        try{
          // An edition is always generated from the original chunk, never from
          // a previously generated 10%, 20%, or 30% text.
          onActivity({phase:'request',level:id});
          let editions=await askGemini(job.source,job.context,id,record.issues?.[id]||[],paceMs,signal,
            pillar?STUDY_PILLAR_VERSION:null,job.targets?.[id]??null,job.summaryCapLetters??null,
            record.drafts?.[id]||null);
          onActivity({phase:'response',level:id});
          let audit=auditGeminiLevels(job.source,editions,{pillar,targetByLevel:job.targets,summaryCapLetters:job.summaryCapLetters});
          if(!audit.verified[id]){
            onActivity({phase:'repair-request',level:id});
            editions=await askGemini(job.source,job.context,id,audit.issues[id],paceMs,signal,
              pillar?STUDY_PILLAR_VERSION:null,job.targets?.[id]??null,job.summaryCapLetters??null,
              editions?.[id]||record.drafts?.[id]||null);
            onActivity({phase:'repair-response',level:id});
            audit=auditGeminiLevels(job.source,editions,{
              pillar,targetByLevel:job.targets,summaryCapLetters:job.summaryCapLetters});
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
              record.drafts[receivedId]=audit.editions[receivedId];
              semanticFailure=true;
            }
          }
          // Atomic, durable per-variant checkpoint: quota rejection on variant 4
          // can never discard the preceding three verified editions.
          state.set(job.key,{...record});
          if(!await saveRuntimeUnitResults([{key:job.key,result:record}]))checkpointPersistent=false;
          // After a focused correction, stop on the FIRST unresolved edition.
          // LAB38 previously spent up to 12 calls per chunk then showed only
          // "Riprendi elaborazione", starting the same expensive cycle again.
          if(!record.verified[id]){
            const detail={level:id,
              reasons:(record.issues[id]||[]).slice(0,4),
              target:job.targets?.[id]??job.summaryCapLetters??null,
              observed:record.drafts?.[id]?
                (record.drafts[id].match(/\\p{L}/gu)||[]).length:null,
              attempts:2};
            diagnostics.quality=detail;
            state.set(job.key,{...record});
            onActivity({phase:'quality-blocked',level:id});
            return {job,record,aiFailure:'AI_QUALITY_REVIEW',quality:detail};
          }
          // Recomputing the entire book after every variant made large books freeze.
          savedVariantsThisRun++;
          if(savedVariantsThisRun<=2||savedVariantsThisRun%12===0){
            const snapshot=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics);
            onProgress(snapshot,snapshot.verifiedVariants,snapshot.totalVariants);
          }
        }catch(error){
          return {job,record,aiFailure:signal?.aborted?'AI_MANUAL_RESTART':(error?.code||'AI_TIMEOUT_OR_NETWORK')};
        }
      }
      const valid=GEMINI_LEVELS.every(id=>record.verified[id]===true);
      return {job,record,aiSuccess:valid,aiFailure:valid?null:
        (semanticFailure?'SEMANTIC_REVIEW':'EDITION_INCOMPLETE')};
    },
    onWave:async({results,processedBatches,totalBatches})=>{
      for(const result of results){
        diagnostics.processedJobs++;
        if(result.quality)diagnostics.quality=result.quality;
        if(result.aiFailure){
          const code=String(result.aiFailure).slice(0,60);
          diagnostics.lastCode=code;
          diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
          if(code==='SOURCE_REVIEW')diagnostics.sourceBlocked++;
          else diagnostics.providerErrors++;
        }
      }
      const entries=results.filter(x=>x.record).map(x=>({key:x.job.key,result:x.record}));
      if(entries.length){
        const saved=await saveRuntimeUnitResults(entries);
        if(!saved)checkpointPersistent=false;
        entries.forEach(e=>state.set(e.key,e.result));
      }
      if(results.some(item=>item.aiFailure)||processedBatches%progressEvery===0||processedBatches===totalBatches){
        const snap=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics);
        onProgress(snap,snap.verifiedVariants,snap.totalVariants);
      }
    },
  });
  const final=makeSnapshot(book,chapterJobs,state,fingerprint,checkpointPersistent,diagnostics);
  final.execution={waves:adaptive.waves,maxConcurrencyUsed:adaptive.maxConcurrencyUsed,
    pendingBefore:pending.length,resumedFromCache:jobs.length-pending.length,
    haltedOn:adaptive.haltedOn,remainingBatches:adaptive.remainingBatches};
  if(['AI_QUOTA_LIMIT','AI_TEMPORARY_OVERLOAD','AI_QUOTA_MANUAL_REVIEW'].includes(adaptive.haltedOn)){
    final.quota=await readGeminiPause();
    final.status=final.quota?.automatic?'quota-paused':'quota-review';
  }
  if(adaptive.haltedOn==='AI_QUALITY_REVIEW')final.status='quality-review';
  if(adaptive.haltedOn==='AI_MANUAL_RESTART')final.status='interrupted';
  if(adaptive.haltedOn==='AI_NOT_CONFIGURED')final.status='ai-unavailable';
  if(['AI_PROVIDER_REJECTED','AI_SERVICE_ERROR','AI_TIMEOUT_OR_NETWORK',
      'INVALID_EDITION_RESPONSE','INVALID_GENERATIVE_RESPONSE'].includes(adaptive.haltedOn))
    final.status='provider-blocked';
  if(!adaptive.haltedOn && diagnostics.sourceBlocked>0 && final.verifiedChunkVariants===0)
    final.status='source-review-needed';
  onProgress(final,final.verifiedVariants,final.totalVariants);
  return final;
}
