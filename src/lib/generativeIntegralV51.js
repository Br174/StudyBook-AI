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
import {bookUnitsV51,planNaturalBlocksV51,bisectAtNaturalBoundaryV51,
  blockLetterTargetV51,BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';

const LEVELS=['summary','50','40','30','20','10'];
const VERSION='lab38-progressive-editions-v1';
const CACHE_VERSION='integral-v51-verified-book-pages';
const sourceFingerprint=book=>book.canonicalBookMap?.originalFingerprint||
  runtimeHash((book.chapters||[]).map(c=>(c.paragraphs||[]).map(p=>p.original).join('|')).join('||'));
const clean=v=>String(v||'').trim();
const signature=block=>runtimeHash(JSON.stringify(block.map(u=>[u.id,u.source,u.pageStart,u.pageEnd])));
const recordKey=(fingerprint,level,block)=>'mlr:'+CACHE_VERSION+':'+fingerprint+':'+level+':'+signature(block);

function checkSourcePages(book,units){
  const map=book.canonicalBookMap;
  if(!map?.pages?.length)return null;
  if((map.uncertain||[]).length)return 'SOURCE_REVIEW';
  const byPage=new Map(map.pages.map(p=>[Number(p.physicalPage),p]));
  for(const u of units){
    for(let p=u.pageStart;p<=u.pageEnd;p++){
      if(byPage.get(p)?.sourceStatus!=='verified')return 'SOURCE_REVIEW';
    }
  }
  return null;
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
  const flat=rows.flat();
  const totalCells=flat.length;
  const verifiedVariants=flat.reduce((n,row)=>n+LEVELS.filter(id=>row.verified[id]).length,0);
  const verifiedCells=flat.filter(row=>LEVELS.every(id=>row.verified[id])).length;
  const complete=totalCells>0&&verifiedCells===totalCells&&checkpointPersistent
    &&!(book.canonicalBookMap?.uncertain||[]).length;
  return {version:VERSION,sourceFingerprint:fingerprint,rows,stagedRows:grid,
    publishedThroughPage:through,
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
function validateOutput(block,level,data){
  const parts=data?.parts;
  if(data?.engine!=='ai'||data?.version!=='integral-v51'||data?.level!==level||
     !Array.isArray(parts)||parts.length!==block.length)return null;
  for(let i=0;i<parts.length;i++){
    if(parts[i]?.id!==block[i].id||!clean(parts[i]?.text))return null;
  }
  const input=block.map(u=>u.source).join('\n\n');
  const output=parts.map(p=>clean(p.text)).join('\n\n');
  const target=blockLetterTargetV51(block,level);
  const outputLetters=parts.reduce((n,p)=>n+studyLetters(p.text),0);
  if(level==='summary'?outputLetters>target.summaryCapLetters:
     outputLetters!==target.targetLetters)return null;
  const semantic=auditFidelity(input,output);
  const conceptual=auditProgressiveConcepts(input,output);
  if(semantic.missingProtected.length||semantic.qualifierMismatches.length||
     conceptual.issues.length)return null;
  // A correct aggregate ratio never licenses an invented per-paragraph legal fact.
  for(let i=0;i<block.length;i++){
    const local=auditProgressiveConcepts(block[i].source,parts[i].text);
    if(local.issues.length)return null;
  }
  return parts.map(p=>clean(p.text));
}
async function requestBlock(block,level,{bookTitle='',signal=null}={}){
  const {targetLetters,summaryCapLetters}=blockLetterTargetV51(block,level);
  const sourceChars=block.reduce((n,u)=>n+u.source.length,0);
  const ratio=level==='summary'?0.44:1-Number(level)/100;
  const tokenBudget=Math.min(BULK_OUTPUT_TOKEN_CEILING,
    Math.max(4096,Math.ceil(sourceChars*ratio/1.5)+block.length*115+1800));
  const response=await fetch(apiEndpoint('/api/editions/bulk/v51'),{
    method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({bookTitle,level,targetLetters,summaryCapLetters,
      maxOutputTokens:tokenBudget,timeoutMs:190000,
      units:block.map(u=>({id:u.id,source:u.source,chapterTitle:u.chapterTitle,
        sectionTitle:u.sectionTitle,pageStart:u.pageStart,pageEnd:u.pageEnd}))})});
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    const code=data?.code||(response.status===404?'AI_BULK_ENDPOINT_MISSING':'HTTP_'+response.status);
    if((response.status===429||response.status===503)&&data?.quota)
      await registerGeminiPause(data.quota);
    throw Object.assign(new Error(data?.error||'Edizione integrale non completata.'),{code,
      diagnostic:data?.diagnostic||null});
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
export async function generateIntegralEditionsV51(book,{
  onProgress=()=>{},onActivity=()=>{},signal=null
}={}){
  const units=bookUnitsV51(book);
  const fingerprint=sourceFingerprint(book);
  const grid=newGrid(book,book.editionsV36,fingerprint);
  const diagnostics={processedJobs:0,providerErrors:0,sourceBlocked:0,
    errorsByCode:{},lastCode:null,mode:'large-natural-page-blocks-v51',
    requestsSent:0,splits:0,verifiedBlocks:0};
  let checkpointPersistent=true;
  const initial=snapshot(book,grid,fingerprint,true,diagnostics,LEVELS[0]);
  onProgress(initial,initial.verifiedVariants,initial.totalVariants);
  if(checkSourcePages(book,units)){
    const blocked={...initial,status:'source-review-needed',
      execution:{haltedOn:'SOURCE_REVIEW',remainingBatches:units.length}};
    onProgress(blocked,blocked.verifiedVariants,blocked.totalVariants);
    return blocked;
  }
  for(const level of LEVELS){
    const planned=planNaturalBlocksV51(units,level);
    const queue=[...planned];
    while(queue.length){
      const block=queue.shift();
      if(blockAlreadyReady(grid,block,level))continue;
      if(signal?.aborted){
        const paused={...snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,level),
          status:'interrupted',execution:{haltedOn:'AI_MANUAL_RESTART',remainingBatches:queue.length+1}};
        onProgress(paused,paused.verifiedVariants,paused.totalVariants);return paused;
      }
      const pause=await readGeminiPause();
      if(pause){
        const paused={...snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,level),
          status:pause.automatic?'quota-paused':'quota-review',quota:pause,
          execution:{haltedOn:pause.automatic?'AI_QUOTA_LIMIT':'AI_QUOTA_MANUAL_REVIEW',
            remainingBatches:queue.length+1}};
        onProgress(paused,paused.verifiedVariants,paused.totalVariants);return paused;
      }
      const key=recordKey(fingerprint,level,block);
      const cached=(await loadRuntimeUnitResults([key])).get(key);
      let parts=null;
      if(cached?.signature===signature(block)&&cached?.ids?.join('|')===block.map(u=>u.id).join('|'))
        parts=validateOutput(block,level,cached);
      if(!parts){
        try{
          diagnostics.requestsSent++;
          onActivity({phase:'request',level,pageStart:block[0].pageStart,
            pageEnd:block[block.length-1].pageEnd});
          const response=await requestBlock(block,level,{bookTitle:book.title||'',signal});
          onActivity({phase:'response',level});
          parts=validateOutput(block,level,response);
          if(!parts)throw Object.assign(new Error('Verifica didattica incompleta: blocco non pubblicato.'),{
            code:'AI_QUALITY_REVIEW'});
          const stored=await saveRuntimeUnitResults([{key,result:{
            ...response,signature:signature(block),ids:block.map(u=>u.id)}}]);
          if(!stored){checkpointPersistent=false;
            const stopped={...snapshot(book,grid,fingerprint,false,diagnostics,level),
              status:'local-storage-error',
              execution:{haltedOn:'AI_CHECKPOINT_UNAVAILABLE',remainingBatches:queue.length+1}};
            onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
          }
          await clearGeminiPause();
        }catch(error){
          const code=signal?.aborted?'AI_MANUAL_RESTART':error?.code||'AI_PROVIDER_NETWORK';
          diagnostics.lastCode=code;
          diagnostics.errorsByCode[code]=(diagnostics.errorsByCode[code]||0)+1;
          diagnostics.providerErrors++;
          // Splitting is ONLY permitted at a chapter or full physical page boundary.
          const splittable=['AI_BLOCK_TOO_LARGE','AI_INCOMPLETE_BLOCK','AI_QUALITY_REVIEW',
            'AI_PROVIDER_TIMEOUT','AI_PROVIDER_NETWORK'].includes(code);
          const halves=splittable?bisectAtNaturalBoundaryV51(block):null;
          if(halves&&!signal?.aborted){
            diagnostics.splits++;
            queue.unshift(...halves);continue;
          }
          const pause=await readGeminiPause();
          const status=code==='AI_MANUAL_RESTART'?'interrupted':
            pause?(pause.automatic?'quota-paused':'quota-review'):
            code==='AI_QUALITY_REVIEW'?'quality-review':'provider-blocked';
          const stopped={...snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,level),
            status,quota:pause||undefined,
            execution:{haltedOn:code,remainingBatches:queue.length+1}};
          onProgress(stopped,stopped.verifiedVariants,stopped.totalVariants);return stopped;
        }
      }
      addBlock(grid,block,level,parts);
      diagnostics.verifiedBlocks++;diagnostics.processedJobs++;
      const current=snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,level);
      onProgress(current,current.verifiedVariants,current.totalVariants);
    }
  }
  const final=snapshot(book,grid,fingerprint,checkpointPersistent,diagnostics,LEVELS.at(-1));
  final.execution={haltedOn:null,remainingBatches:0,
    maxConcurrencyUsed:1,verifiedBlocks:diagnostics.verifiedBlocks,
    requestsSent:diagnostics.requestsSent,splits:diagnostics.splits};
  onProgress(final,final.verifiedVariants,final.totalVariants);
  return final;
}
