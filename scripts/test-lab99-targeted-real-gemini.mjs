// StudyBook LAB99: real Gemini targeted sentence edits, maximum four cases and five HTTP calls.
// Only source-backed fragment, not entire page, is sent to Gemini. All rest stays byte-identical.
// Zero-cost existing Gemini key, stop on 429 or repeated 503, NO production APK or PDF writes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {analyzeCandidate} from './lab99-targeted-sentence-patch.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
const CASES=JSON.parse(readFileSync('audit/test-fixtures/lab99-sentence-repair-cases.json','utf8')).cases;
const HISTORY=JSON.parse(readFileSync('audit/reports/lab98-real-gemini.json','utf8'));
const OUTPUT='audit/reports/lab99-gemini-sentence-repairs.json';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const KEY=process.env.AI_TEST_KEY||'',MODEL='gemini-3.5-flash-lite';
const MAX_CALLS=5;
const format={type:'json_schema',json_schema:{name:'studybook_lab99_single_sentence',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{sentence:{type:'string'}},required:['sentence']}}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let attempts=0,halt=false,reason='',results=[],errors=[];
function prompt(item){
 return[
 'STUDYBOOK AI, CORREZIONE MIRATA DI UNA SOLA FRASE ITALIANA.',
 'Non riscrivere la pagina, non fare un riassunto: conserva il significato della frase da correggere e reinserisci SOLTANTO il dettaglio che manca, già dimostrato dal frammento della fonte.',
 'FRASE ESATTA DA SOSTITUIRE: '+item.target,
 'FRAMMENTO ORIGINALE DELLA STESSA PAGINA, UNICA FONTE AUTORIZZATA: '+item.evidence,
 'DETTAGLIO MANCANTE DA RIPRISTINARE: '+item.objective,
 'Rispondi in italiano corretto, con UNA frase naturale che termini con un punto. Mantieni negazioni, numeri, modalità (può/deve), condizioni e significato. Non aggiungere nessun esempio esterno o parole riempitive.',
 'Restituisci esclusivamente il JSON {"sentence":"..."} con UNA SOLA frase. Il software inserirà questa frase al posto dell originale, lasciando inalterati tutti gli altri periodi; se il limite righe/lettere non è rispettato, l operazione sarà automaticamente respinta.'
 ].join('\n\n');
}
function save(){
 const completed=results.filter(r=>r.received);
 const summary={planned:CASES.length,attemptedCases:results.length,geminiReceived:completed.length,
  targetRelationRecovered:completed.filter(r=>r.check?.targetRecovered).length,
  provisionalAccepted:completed.filter(r=>r.check?.acceptedMathematically).length,
  rejected:completed.filter(r=>r.check?.verdict==='REJECT_ROLLBACK').length,
  productionReady:0};
 const report={study:'LAB99 real targeted Gemini sentence-only repairs',
 date:new Date().toISOString(),model:MODEL,provider:{attempts,halt,reason,maxCalls:MAX_CALLS},
  scope:'Four pre-selected sentences from real LAB98 synthetic outputs. A patch is local to one exact sentence. No book/A4 formatting tested.',
  policy:'One correction call per case; only repeated 503 may retry once. Never silently declare semantic certification. Exact other text remains unchanged.',
  controls:{productionEdited:false,mainEdited:false,APKCompiled:false,extrapaidService:false},summary,results,errors};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
async function run(c){
 const source=FIXTURES.find(x=>x.id===c.source);
 const baseline=HISTORY.results.find(x=>x.valid&&x.source===c.source&&x.level===c.level);
 if(!source||!baseline){const error={caseId:c.id,error:'MISSING_VERIFIED_BASELINE'};errors.push(error);results.push({caseId:c.id,received:false,error});save();return}
 const oldGuard=relationshipGuard(source.id,source.concepts.join(' '),baseline.metrics.text);
 if(!oldGuard.alerts.some(x=>x.id===c.relationId)){
  const error={caseId:c.id,error:'EXPECTED_RELATION_NOT_MISSING',guards:oldGuard.alerts.map(x=>x.id)};
  errors.push(error);results.push({caseId:c.id,received:false,error});save();return;
 }
 let n=0;
 while(n<2&&!halt&&attempts<MAX_CALLS){
  n++;attempts++;const start=performance.now();
  try{
   const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:300,response_format:format,
      messages:[{role:'user',content:prompt(c)}]}),
    signal:AbortSignal.timeout(50000)});
   const ms=Math.round(performance.now()-start);
   const j=await res.json().catch(()=>({}));
   if(!res.ok){
    const err={caseId:c.id,status:res.status,httpCall:attempts,ms,message:String(j.error?.message||'error').slice(0,150)};
    errors.push(err);console.log('LAB99_PROVIDER_ERROR',JSON.stringify(err));
    if(res.status===429){halt=true;reason='HTTP_429';results.push({caseId:c.id,received:false,error:err});save();return}
    if(res.status===503&&n===1&&attempts<MAX_CALLS){await sleep(3300);continue}
    if(res.status===503){halt=true;reason='HTTP_503';}
    results.push({caseId:c.id,received:false,error:err});save();return;
   }
   let content=String(j.choices?.[0]?.message?.content||'').trim();
   if(content.startsWith('~~~'))content=content.replace(/^~~~json\s*/iu,'').replace(/\s*~~~$/u,'');
   let parsed={};try{parsed=JSON.parse(content)}catch{}
   const candidate=String(parsed.sentence||'');
   const check=analyzeCandidate(source,c.level,baseline.metrics.text,c,candidate);
   results.push({caseId:c.id,source:c.source,level:c.level,received:!!candidate,ms,modelOutputSentence:candidate,check,usedTokens:j.usage?.completion_tokens??null,
    humanSemanticReview:'NOT_DONE',approvedForApp:false});
   console.log('LAB99_REPAIR',JSON.stringify({id:c.id,received:!!candidate,recovered:check.targetRecovered,
    acceptedMath:check.acceptedMathematically,why:check.forbiddenReasons,oldPct:check.old?.reduction,newPct:check.next?.reduction,
    oldRows:check.old?.rows,newRows:check.next?.rows,cap:check.next?.cap}));
   save();return;
  }catch(e){
   const error={caseId:c.id,call:attempts,exception:String(e?.name||e).slice(0,180)};
   errors.push(error);results.push({caseId:c.id,received:false,error});save();
   console.log('LAB99_EXCEPTION',JSON.stringify(error));return;
  }
 }
}
if(!KEY){errors.push({error:'NO_PREEXISTING_AI_TEST_KEY'});save();process.exit(1)}
console.log('LAB99_START',JSON.stringify({maxCalls:MAX_CALLS,scheduled:CASES.length}));
for(const c of CASES){
 if(halt||attempts>=MAX_CALLS)break;
 await run(c);
 if(halt)break;
 await sleep(900);
}
const done=save();console.log('LAB99_FINAL',JSON.stringify({summary:done.summary,provider:done.provider,errors:errors.length}));
