// StudyBook LAB108: controlled real-Gemini paired A/B trial, not app deployment.
// 2 existing synthetic source pages × 3 weak levels × 2 isolated prompts = max 12 calls.
// One provider dispatch per case. No retries on 429/503, no paid fallback.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
import {buildSourcePreservingPromptV108} from '../src/lib/studySourcePreservingV108.js';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';

const KEY=process.env.AI_TEST_KEY||'';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL='gemini-3.5-flash-lite';
const PATH='audit/reports/lab108-real-source-preserving.json';
const arms=['COPY_EDIT','ANCHORED_SECTIONS'],levels=['10','20','40'];
const sources=FIXTURES.filter(x=>['scienze','procedura'].includes(x.id));
const cases=sources.flatMap(source=>levels.flatMap(level=>arms.map(arm=>({source,level,arm}))));
const reference=JSON.parse(readFileSync('audit/reports/lab107-real-gemini-calibration.json','utf8'));
const baseline=reference.results.filter(r=>r.valid&&levels.includes(String(r.level)));
const format={type:'json_schema',json_schema:{name:'studybook_lab108_page_text',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const report={
 lab:'LAB108',method:'Source-preserving A/B on problematic 10/20/40 levels',
 startedAt:new Date().toISOString(),model:MODEL,experimental:true,
 originalUserBookUsed:false,isolatedBranch:true,
 freeProviderOnly:true,noPaidFallback:true,
 productionAppModified:false,sourceNativeWiring:false,
 planned:cases.length,requests:0,realAnswers:0,stopped:false,stopReason:null,
 semanticCertifiedCount:0,approvedForApp:false,
 baselineMethod:'LAB107 same two fixtures, but independent model generations; not paired seed',
 baselineResults:baseline.map(r=>({id:r.id,level:String(r.level),achieved:r.observedReduction,
  numericPass:r.numericPass,gridPass:r.gridPass,preliminaryFlags:r.prelimSemanticWarnings?.length||0})),
 results:[],providerErrors:[],summary:null};
function persist(){mkdirSync('audit/reports',{recursive:true});writeFileSync(PATH,JSON.stringify(report,null,2)+'\n')}
function hash(v){return createHash('sha256').update(v,'utf8').digest('hex')}
function updateSummary(){
 const valid=report.results.filter(r=>r.valid),regular=valid.filter(r=>!r.shortPageExempt);
 const byArm=Object.fromEntries(arms.map(arm=>{
  const xs=regular.filter(r=>r.arm===arm);
  return [arm,{valid:xs.length,mathAndGridPass:xs.filter(r=>r.numericPass&&r.gridPass).length,
   numericPass:xs.filter(r=>r.numericPass).length,gridPass:xs.filter(r=>r.gridPass).length,
   zeroPreliminaryFlags:xs.filter(r=>r.preliminarySemanticWarnings.length===0).length,
   semanticCertified:0}]}));
 report.summary={valid:valid.length,mathAndGridPass:regular.filter(r=>r.numericPass&&r.gridPass).length,
  byArm,baselineMathAndGridPass:baseline.filter(r=>r.numericPass&&r.gridPass).length,
  semanticCertified:0,notApprovedForApp:true};
}
persist();
if(!KEY){report.stopped=true;report.stopReason='NO_EXISTING_GEMINI_KEY';persist();process.exit(2)}
for(const c of cases){
 if(report.stopped||report.requests>=12)break;
 const source=c.source.concepts.join(' ').replace(/\s+/gu,' ').trim();
 const origRows=virtualRowsV106(source).rows;
 const target=Number(c.level),maxRows=Math.ceil(Math.round(studyLetters(source)*(1-target/100))/46.346);
 const strategy=buildSourcePreservingPromptV108({source,level:c.level,arm:c.arm,maxRows,shortPageExempt:origRows<=5});
 report.requests++;
 try{
  const started=Date.now();
  const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2800,response_format:format,
    messages:[{role:'user',content:strategy.prompt}]}),signal:AbortSignal.timeout(70000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const error={id:c.source.id,level:c.level,arm:c.arm,http:response.status,
    message:String(data.error?.message||'PROVIDER_FAILED').slice(0,220)};
   report.providerErrors.push(error);
   report.results.push({...error,valid:false});updateSummary();persist();
   if([429,503].includes(response.status)){report.stopped=true;report.stopReason='HTTP_'+response.status;updateSummary();persist();break}
   continue;
  }
  let outputText='';
  try{outputText=String(JSON.parse(String(data.choices?.[0]?.message?.content||'')).text||'').trim()}
  catch{report.providerErrors.push({id:c.source.id,level:c.level,arm:c.arm,error:'JSON_PARSE_FAILED'})}
  if(!outputText){report.results.push({id:c.source.id,level:c.level,arm:c.arm,valid:false,error:'EMPTY_TEXT'});updateSummary();persist();continue}
  report.realAnswers++;
  const size=studyLetters(outputText),layout=virtualRowsV106(outputText);
  const m=classifyMeasuredResultV107({budget:strategy.letterBudget,outputLetters:size,
   originalPageRows:origRows,gridPass:layout.rows<=maxRows&&!layout.overlong,semanticReviewPassed:false});
  let flags=[];
  try{flags=semanticGuard(c.source.id,source,outputText,{level:Number(c.level)}).alerts||[]}
  catch(e){flags=[{type:'LEXICAL_GUARD_UNAVAILABLE',message:String(e?.message||e).slice(0,60)}]}
  const baselineRow=baseline.find(r=>r.id===c.source.id&&String(r.level)===c.level);
  report.results.push({
   id:c.source.id,level:c.level,arm:c.arm,valid:true,sourceSha256:hash(source),
   sourceLetters:strategy.originalLetters,outputLetters:size,
   letterTarget:strategy.letterBudget.targetLetters,
   minLetters:strategy.letterBudget.minLetters,maxLetters:strategy.letterBudget.maxLetters,
   achievedReduction:m.achievedReduction,numericPass:m.quantitativePass,
   rows:layout.rows,maxRows,gridPass:m.gridPass,shortPageExempt:m.shortPageExempt??false,
   preliminarySemanticWarnings:flags,semanticCertified:false,approvedForApp:false,
   baselineReduction:baselineRow?.observedReduction??null,baselineNumericPass:baselineRow?.numericPass??null,
   tokens:data.usage?.total_tokens??null,elapsedMs:Date.now()-started,
   outputText
  });
  updateSummary();persist();
  console.log('LAB108_CASE',JSON.stringify({id:c.source.id,level:c.level,arm:c.arm,
   reduction:m.achievedReduction,numericPass:m.quantitativePass,gridPass:m.gridPass,alerts:flags.length}));
 }catch(e){const reason=String(e?.name||e?.message||e).slice(0,150);
   report.providerErrors.push({id:c.source.id,level:c.level,arm:c.arm,error:reason});
   report.results.push({id:c.source.id,level:c.level,arm:c.arm,valid:false,error:reason});updateSummary();persist();}
 await new Promise(resolve=>setTimeout(resolve,700));
}
updateSummary();report.complete=report.realAnswers===cases.length;report.finishedAt=new Date().toISOString();
persist();console.log('LAB108_FINAL',JSON.stringify({
 attempted:report.requests,realAnswers:report.realAnswers,baselineMathAndGridPass:report.summary.baselineMathAndGridPass,
 byArm:report.summary.byArm,stopped:report.stopped,stopReason:report.stopReason,certified:0}));
if(!report.complete)process.exitCode=2;
