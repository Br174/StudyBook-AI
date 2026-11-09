// StudyBook LAB107: bounded real Gemini trial. Existing free key, no retries on 429.
// Two synthetic fixtures, all six production labels. No APK or PDF mutation.
import {mkdirSync,writeFileSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {sourceLetterBudgetV74} from '../src/lib/studyPageBudgetsV74.js';
import {virtualRowsV106} from '../src/lib/studySingleCallGateV106.js';
import {prepareLetterFirstTrialV107,classifyMeasuredResultV107} from '../src/lib/studyInverseCalibrationV107.js';
import {semanticGuard} from './lab98-modal-semantic-guard.mjs';
const KEY=process.env.AI_TEST_KEY||'';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL='gemini-3.5-flash-lite';
const OUT='audit/reports/lab107-real-gemini-calibration.json';
const SOURCES=FIXTURES.filter(x=>['scienze','procedura'].includes(x.id));
const LEVELS=['10','20','30','40','50','summary'];
const TASKS=SOURCES.flatMap(source=>LEVELS.map(level=>({source,level})));
const MAX_CALLS=12;
const format={type:'json_schema',json_schema:{name:'studybook_lab107_letter_first',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const report={lab:'LAB107 real limited pilot',date:new Date().toISOString(),model:MODEL,
 sourceType:'synthetic existing fixture, not real user PDF',planned:TASKS.length,attempted:0,
 responses:0,stopped:false,stopReason:null,callsToPaidService:0,
 certifiedSemanticPages:0,approvedForApp:false,results:[],errors:[]};
function persist(){mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n')}
if(!KEY){report.stopped=true;report.stopReason='MISSING_EXISTING_FREE_KEY';persist();process.exit(2)}
for(const task of TASKS){
 if(report.attempted>=MAX_CALLS||report.stopped)break;
 const source=task.source.concepts.join(' ').replace(/\s+/gu,' ').trim();
 const letterCount=studyLetters(source),budget=sourceLetterBudgetV74(letterCount,task.level);
 const originalRows=virtualRowsV106(source).rows;
 const prepared=prepareLetterFirstTrialV107({source,level:task.level,budget,originalPageRows:originalRows});
 const maxRows=originalRows<=5?5:Math.ceil(budget.targetLetters/46.346);
 const prompt=[prepared.prompt,
  'Vincolo fisico aggiuntivo: massimo '+maxRows+' righe da 60 celle monospaziate; non spezzare parole.',
  'Utilizza una sola riscrittura completa della pagina, non una scaletta o parole chiave.',
  'Rispondi ESCLUSIVAMENTE con JSON {"text":"..."}; un unico paragrafo continuo.',
  'FONTE AUTOREVOLE, da riscrivere: '+source].join('\n\n');
 report.attempted++;
 try{
  const t=Date.now();
  const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:2800,response_format:format,
    messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(70000)});
  const answer=await r.json().catch(()=>({}));
  if(!r.ok){const issue={id:task.source.id,level:task.level,http:r.status,
   message:String(answer.error?.message||'PROVIDER_ERROR').slice(0,200)};
   report.errors.push(issue);if([429,503].includes(r.status)){report.stopped=true;report.stopReason='HTTP_'+r.status}
   report.results.push({...issue,valid:false});persist();if(report.stopped)break;continue;}
  const raw=String(answer.choices?.[0]?.message?.content||'');
  let text='';try{text=JSON.parse(raw).text||''}catch(e){report.errors.push({id:task.source.id,level:task.level,error:'NON_JSON'})}
  if(!text.trim()){report.results.push({id:task.source.id,level:task.level,valid:false,reason:'EMPTY_OR_NON_JSON'});persist();continue}
  const layout=virtualRowsV106(text),measure=classifyMeasuredResultV107({budget,
   outputLetters:studyLetters(text),originalPageRows:originalRows,
   gridPass:layout.rows<=maxRows&&!layout.overlong,semanticReviewPassed:false});
  let alerts=[];
  try{const safety=semanticGuard(task.source.id,source,text,{level:task.level==='summary'?65:Number(task.level)});
   alerts=safety.alerts||[]}catch(e){alerts=[{type:'SEMANTIC_GUARD_UNAVAILABLE'}]}
  report.responses++;
  report.results.push({id:task.source.id,level:task.level,valid:true,originalLetters:letterCount,
   targetLetters:budget.targetLetters,minLetters:budget.minLetters,maxLetters:budget.maxLetters,
   originalRows,maxRows,outputText:text,outputLetters:studyLetters(text),observedReduction:measure.achievedReduction,
   numericPass:measure.quantitativePass,gridPass:measure.gridPass,
   prelimSemanticWarnings:alerts,semanticCertified:false,actualApproved:measure.fullyApproved,
   elapsedMs:Date.now()-t});
  persist();
 }catch(e){report.errors.push({id:task.source.id,level:task.level,error:String(e).slice(0,150)});persist()}
 await new Promise(resolve=>setTimeout(resolve,700));
}
report.complete=report.responses===TASKS.length;
report.mathGridPass=report.results.filter(x=>x.numericPass&&x.gridPass).length;
report.semanticCertification='NOT_PERFORMED';
persist();console.log('LAB107_REAL_GEMINI',JSON.stringify({attempted:report.attempted,responses:report.responses,
 mathGridPass:report.mathGridPass,stopped:report.stopped,stopReason:report.stopReason}));
if(!report.complete)process.exitCode=2;
