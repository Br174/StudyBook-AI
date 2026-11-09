// LAB105 StudyBook AI / MotorLab, no charge and no production changes.
// Stress simulation: 1000 distinct PAGE RECORDS using FIVE repeated synthetic
// source texts. Tests scheduler, checkpoints, conflicts, source/percentage
// verification, idempotency and resume. DOES NOT generate 6000 Gemini texts or
// certify a real 1000-page PDF. Archived real Gemini evidence is reused.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, renameSync, copyFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget, letters, wrap} from './lab92-stop-complete-engine.mjs';
import {normalize, sha256} from './lab100-first-read-ledger.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
import {oxygenDirectionRisk} from './lab103-source-direction-risk.mjs';

const read=p=>JSON.parse(readFileSync(p,'utf8'));
const levels=[65,50,40,30,20,10];
const index=read('audit/reports/lab103-incumbent-no-regression.json');
const audit=read('audit/reports/lab104-fact-by-fact-editorial-review.json');
const lab101=read('audit/reports/lab101-real-priorities.json');
const sources=[...FIXTURES];
assert.equal(sources.length,5,'FIVE_SOURCE_ARCHETYPES_REQUIRED');
const bySource=new Map(sources.map(s=>[s.id,s]));
const ledger=new Map(lab101.pages.filter(x=>x.anchorValidated).map(x=>[x.source,x]));
for(const x of sources)assert.equal(sha256(normalize(x.concepts.join(' '))),ledger.get(x.id).ledger.sourceHash,'SOURCE_LEDGER_HASH_DRIFT_'+x.id);
const allCandidates=[...index.candidateIndex];
for(const reviewed of audit.candidates){
 allCandidates.push({
  key:reviewed.source+'|'+reviewed.level+'|LAB104_EDITORIAL_COPY',
  source:reviewed.source,level:reviewed.level,from:'LAB104_EDITORIAL_COPY',
  mathPass:reviewed.latest.percentPass&&reviewed.latest.gridPass,
  relationAlerts:reviewed.latest.relationAlerts,
  textHash:reviewed.latest.textHash,letters:reviewed.latest.letters,
  reduction:reviewed.latest.reductionPercent,
  rows:reviewed.latest.rows,maxRows:reviewed.latest.maxRows,
  sourceHash:reviewed.latest.sourceHash,reviewed:reviewed.reviewCounts,
  remainingFundamental:reviewed.fundamentalStillPartial.length
 });
}
const catalog=new Map();
for(const source of sources)for(const level of levels){
 const candidates=allCandidates.filter(x=>x.source===source.id&&x.level===level);
 const ordered=candidates.sort((a,b)=>
   Number(b.mathPass)-Number(a.mathPass) ||
   (a.remainingFundamental??999)-(b.remainingFundamental??999) ||
   a.relationAlerts.length-b.relationAlerts.length ||
   Math.abs(a.reduction-level)-Math.abs(b.reduction-level) ||
   a.key.localeCompare(b.key));
 const winner=ordered[0]||null;
 assert(winner,'NO_HISTORIC_GEMINI_OUTPUT_'+source.id+'_'+level);
 if(winner.from==='LAB104_EDITORIAL_COPY')assert(audit.candidates.some(a=>a.source===source.id&&a.level===level&&a.latest.textHash===winner.textHash));
 catalog.set(source.id+'|'+level,winner);
}
const pages=Array.from({length:1000},(_,i)=>{
 const src=sources[i%sources.length],pageNo=i+1;
 return {bookId:'LAB105-SIMULATED-1000',page:pageNo,
  chapter:Math.floor(i/40)+1,chapterPage:i%40+1,
  sourceType:src.id,sourceHash:ledger.get(src.id).ledger.sourceHash,
  pageKey:'SIM-P'+String(pageNo).padStart(4,'0'),
  // Page metadata is unique, source content is intentionally repeated!
  sourceTextHash:sha256(normalize(src.concepts.join(' ')))};
});
assert.equal(new Set(pages.map(p=>p.pageKey)).size,1000);
assert.equal(new Set(pages.map(p=>p.sourceTextHash)).size,5);
function signature(record){
 return sha256([record.pageKey,record.sourceHash,record.level,record.candidateHash,record.status].join('|'));
}
function taskFor(page,level){
 const fixture=bySource.get(page.sourceType);
 const plan=budget(fixture,level),candidate=catalog.get(page.sourceType+'|'+level);
 const metadataValid=candidate.mathPass&&
   candidate.letters>=plan.band.low&&candidate.letters<=plan.band.high || (plan.short&&candidate.mathPass);
 const rowsValid=candidate.rows<=plan.targetCap&&candidate.maxRows===plan.targetCap;
 const sourceValid=page.sourceHash===ledger.get(page.sourceType).ledger.sourceHash;
 const outputHashValid=/^[0-9a-f]{64}$/u.test(candidate.textHash);
 const hardPass=metadataValid&&rowsValid&&sourceValid&&outputHashValid;
 const status=hardPass?'ARCHIVE_NUMERIC_GRID_PASSED_SEMANTICS_PENDING':'ARCHIVE_FAIL_OR_UNAVAILABLE_KEEP_UNAPPROVED';
 const record={pageKey:page.pageKey,chapter:page.chapter,sourceType:page.sourceType,level,
  sourceHash:page.sourceHash,candidateHash:candidate.textHash,provenance:candidate.from,
  actualLetters:candidate.letters,targetLetters:plan.targetLetters,allowedLow:plan.band.low,
  allowedHigh:plan.band.high,rows:candidate.rows,rowCap:plan.targetCap,status,
  relationAlerts:candidate.relationAlerts,approvedForApp:false,finalSemanticsCertified:false,
  shortPageExempt:plan.short};
 record.signature=signature(record);
 return record;
}
function verify(r,recordPage){
 if(r.pageKey!==recordPage.pageKey||r.sourceHash!==recordPage.sourceHash)return false;
 if(r.signature!==signature(r))return false;
 const p=budget(bySource.get(recordPage.sourceType),r.level);
 if(r.targetLetters!==p.targetLetters||r.rowCap!==p.targetCap)return false;
 if(!/^[0-9a-f]{64}$/u.test(r.candidateHash))return false;
 if(r.rows>r.rowCap&&r.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED'))return false;
 if((r.actualLetters<p.band.low||r.actualLetters>p.band.high)&&!p.short&&r.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED'))return false;
 return true;
}
const temp=mkdtempSync(join(tmpdir(),'studybook-lab105-'));
const path=join(temp,'checkpoint.json'),good=join(temp,'last_good.json');
let savedPage=0,results=[],restartCount=0,replayed=0,crashPoints=[];
function save(){
 const body={study:'LAB105_SIM',page:savedPage,rows:results,sha:sha256(JSON.stringify(results))};
 const payload=JSON.stringify(body);
 const fresh=path+'.next';
 writeFileSync(fresh,payload);
 // Preserve last verified checkpoint in case primary is truncated or broken.
 if(existsSync(path))copyFileSync(path,good);
 renameSync(fresh,path);
}
function load(){
 const tryFile=p=>{
  const d=read(p);
  assert.equal(d.study,'LAB105_SIM');
  assert.equal(sha256(JSON.stringify(d.rows)),d.sha);
  assert.equal(d.rows.length,d.page*levels.length);
  return d;
 };
 try{return tryFile(path)}
 catch(e){if(!existsSync(good))throw e;return tryFile(good)}
}
function restart(cause,corrupt=false){
 restartCount++;
 if(corrupt){
  writeFileSync(path,'{"study":"LAB105_SIM","page":');
 }
 const previous=load();
 assert(previous.page<=savedPage,'CHECKPOINT_FUTURE_PAGE');
 replayed+=savedPage-previous.page;
 savedPage=previous.page;
 results=previous.rows;
 crashPoints.push({cause,recoveredPage:savedPage});
}
const checkSubset=[7,610,760,990], checkSpecial={7:'CRASH_AFTER_PAGE_7',610:'ERROR_61_PERCENT',760:'ERROR_76_PERCENT_WITH_CORRUPTED_PRIMARY',990:'CRASH_AT_99_PERCENT'};
try{
 save();
 while(savedPage<pages.length){
  const p=pages[savedPage];
  for(const level of levels){
   const rec=taskFor(p,level);
   assert(verify(rec,p),'INVALID_RESULT_CONSTRUCTION '+p.pageKey+'_'+level);
   results.push(rec);
  }
  savedPage++;
  if(savedPage%10===0||checkSubset.includes(savedPage)||savedPage===pages.length)save();
  if(checkSubset.includes(savedPage)&&!crashPoints.some(c=>c.cause===checkSpecial[savedPage])){
   restart(checkSpecial[savedPage],savedPage===760);
   // The recorded cause prevents reinjecting the same fault after recovery.
  }
 }
 const final=load();
 assert.equal(final.page,1000);
 assert.equal(final.rows.length,6000);
 assert.equal(new Set(final.rows.map(r=>r.pageKey+'|'+r.level)).size,6000,'DUPLICATE_JOB');
 assert(final.rows.every(x=>verify(x,pages[Number(x.pageKey.slice(5))-1])),'FINAL_INVALID_STATE');
 assert(final.rows.every(x=>!x.approvedForApp&&!x.finalSemanticsCertified));
 assert.equal(pages.length,1000);
 // Input and output mutations must be refused.
 const first=final.rows[0],sourcePage=pages[0];
 const mutants=[
  {...first,pageKey:'SIM-P0999'},
  {...first,sourceHash:'0'.repeat(64)},
  {...first,candidateHash:'f'.repeat(64)},
  {...first,actualLetters:0},
  {...first,rows:999},
  {...first,status:'ARCHIVE_NUMERIC_GRID_PASSED_SEMANTICS_PENDING',actualLetters:999999},
  {...first,level:30}
 ];
 const caught=mutants.map(x=>!verify(x,sourcePage));
 assert(caught.every(Boolean),'SOURCE_OR_CHECKPOINT_MUTATION_SLIPPED');
 const countByLevel=levels.map(l=>{
  const rs=final.rows.filter(x=>x.level===l);
  return{level:l,total:rs.length,archivedNumericGridPass:rs.filter(x=>x.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED')).length,
    archivedInvalidOrMissing:rs.filter(x=>!x.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED')).length,
    semanticCertifications:0};
 });
 const counts={processedBookPageRecords:1000,sourceArchetypes:5,distinctSourceTexts:5,
  chapterCount:25,levelJobs:6000,restarts:restartCount,checkpointReplays:replayed,
  sourceIntegrityMutationsCaught:caught.filter(Boolean).length,duplicateJobs:0,
  completedPageRecords:1000,percentPlusGridPasses:final.rows.filter(x=>x.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED')).length,
  nonConformingArchivedResults:final.rows.filter(x=>!x.status.startsWith('ARCHIVE_NUMERIC_GRID_PASSED')).length,
  academicSemanticCertificates:0,
  realPdfPagesProcessed:0,realGeminiGenerationsInThisRun:0,
  onlySyntheticRepeatedSourceContent:true};
 const body={name:'LAB105 1000-page operational stress simulation, 6000 level tasks',
  date:new Date().toISOString(),scope:'OFFLINE deterministic repeated synthetic source pages',
  disclaimer:'NOT an actual 1000-page book, NOT 6000 newly generated Gemini versions, NOT an end-to-end Android benchmark. Five source archetypes are repeated 200 times each. No true semantic certification.',
  sampleCatalog:[...catalog].map(([k,v])=>({sourceLevel:k,selected:v.key,mathPass:v.mathPass,relationAlerts:v.relationAlerts,semanticallyCertified:false})),
  counts,countByLevel,crashPoints,
  pageIntegrityDigest:sha256(JSON.stringify(final.rows.map(r=>r.signature))),
  regressionGates:{sourceLedgerHash:'PASS',uniquePageNumbers:'PASS',noDuplicateJobs:'PASS',
   fourInjectedCrashes:'PASS',damagedCheckpointRecovery:'PASS',noPseudoApproval:'PASS',
   sevenResultMutationsRejected:'PASS',
   all6000TextsActuallyRegenerated:'NOT_TESTED',
   true1000PagePDFImport:'NOT_TESTED',
   six1000PageSemanticAccuracy:'NOT_TESTED',
   realAndroidPersistence:'NOT_TESTED'},
  costAddedEuro:0,productionChanged:false,apkChanged:false};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync('audit/reports/lab105-1000-page-stress.json',JSON.stringify(body,null,2)+'\n');
 console.log('LAB105_STRESS_VERDICT',JSON.stringify({counts,countByLevel,crashPoints}));
}finally{rmSync(temp,{recursive:true,force:true})}
