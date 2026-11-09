// MotorLab StudyBook LAB96: minimal source-only prompting; atomic facts stay PRIVATE to verifier.
// This is an isolated quota-capped experimental workflow, not Android app implementation.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget} from './lab92-stop-complete-engine.mjs';
import {evaluateLean} from './lab96-eval.mjs';
const API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MODEL='gemini-3.5-flash-lite', KEY=process.env.AI_TEST_KEY||'';
const OUT='audit/reports/lab96-source-only-real-gemini.json',MAX_HTTP=12;
const CASES=[
 ['scienze',20],['medicina',20],['procedura',20],['concetto_sbilanciato',20],['pagina_breve_continua',20],
 ['scienze',50],['medicina',50],['procedura',50],['scienze',10],['medicina',10],['scienze',30],['procedura',40]
];
const schema={type:'json_schema',json_schema:{name:'studybook_lab96_minimal_text',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{text:{type:'string'}},required:['text']}}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let http=0,halt=false,haltReason='',errors=[],cases=[];
function simplePrompt(source,plan){
 const intro=plan.level<=20?'Riscrivi in italiano chiaro e quasi completo il testo qui sotto, eliminando ripetizioni e giri di parole.':'Riscrivi in italiano semplice e sintetico il testo qui sotto.';
 const lines=[
  intro,
  'Riduzione richiesta '+plan.level+'%: testo originale '+plan.originalLetters+' lettere. '+(plan.short?'Pagina brevissima: percentuale libera, non allungare inutilmente.':'Testo di arrivo circa '+plan.targetLetters+' lettere alfabetiche (intervallo '+plan.band.low+'-'+plan.band.high+').'),
  'Massimo '+plan.targetCap+' righe da 60 caratteri monospaziati, senza spezzare parole. Scrivi un unico paragrafo normale: le righe le sistemerà il programma.',
  'Conserva tutti i fatti importanti, numeri, termini tecnici, condizioni, negazioni e cause. Non inventare nulla e non spostare contenuti tra pagine. Quando hai detto tutto fermati: niente riempitivi.',
  'Restituisci solo JSON: {"text":"testo rielaborato"}.',
  'TESTO ORIGINALE DELLA PAGINA:\n'+source.concepts.join(' ')
 ];
 return lines.join('\n');
}
function save(){
 const valid=cases.filter(x=>x.valid);
 const long=valid.filter(x=>!x.metrics.short);
 const summary={
  planned:CASES.length,attempted:cases.length,validResponses:valid.length,
  longResponses:long.length,
  longGridPass:long.filter(x=>x.metrics.grid.passes).length,
  longBandPass:long.filter(x=>x.metrics.band.passes).length,
  longBoth:long.filter(x=>x.metrics.completeMathPass).length,
  longAllFactSignalsClear:long.filter(x=>!x.metrics.facts.missing.length).length,
  longBothNoFactSignals:long.filter(x=>x.metrics.completeMathPass&&x.metrics.facts.missing.length===0&&x.metrics.spellingSignals.length===0).length,
  shortResponses:valid.filter(x=>x.metrics.short).length
 };
 const output={study:'LAB96 lean source-only Gemini benchmark',createdAt:new Date().toISOString(),
  model:MODEL,modelProvider:'Google Gemini via pre-existing free credential',
  provider:{attempts:http,stopped:halt,reason:haltReason,maxAttempts:MAX_HTTP},
  policy:'STOP on first 429 or after one repeated 503; no upgrades, no background retry.',
  scope:'Synthetic prior-split sample pages. No PDF layout/A4 font tested. Model prompt excludes atomic checklist; only post-output checker reads facts.',
  passMeaning:'No automatic lexical test certifies full semantic correctness. Even geometrically and numerically passing results require review before app.',
  productionChanged:false,apkBuilt:false,summary,cases,errors};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUT,JSON.stringify(output,null,2)+'\n');
 return output;
}
async function test(sourceId,level){
 const source=FIXTURES.find(x=>x.id===sourceId),plan=budget(source,level);
 let tries=0;
 while(tries<2&&!halt&&http<MAX_HTTP){
  tries++;http++;const started=performance.now();
  try{
   const res=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.15,max_tokens:1800,response_format:schema,
      messages:[{role:'user',content:simplePrompt(source,plan)}]}),
    signal:AbortSignal.timeout(75000)});
   const ms=Math.round(performance.now()-started);
   const answer=await res.json().catch(()=>({}));
   if(!res.ok){
    const error={source:sourceId,level,status:res.status,call:http,ms,message:String(answer.error?.message||'HTTP error').slice(0,160)};
    errors.push(error);console.log('LAB96_HTTP_ERROR',JSON.stringify(error));
    if(res.status===429){halt=true;haltReason='HTTP_429';cases.push({source:sourceId,level,valid:false,error});save();return;}
    if(res.status===503&&tries===1&&http<MAX_HTTP){await wait(3000);continue}
    if(res.status===503){halt=true;haltReason='HTTP_503';}
    cases.push({source:sourceId,level,valid:false,error});save();return;
   }
   let raw=String(answer.choices?.[0]?.message?.content||'').trim();
   if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/i,'').replace(/\s*~~~$/,'');
   let text;try{text=JSON.parse(raw)?.text}catch{}
   const metrics=evaluateLean(source,level,text);
   const valid=metrics.valid===true;
   cases.push({source:sourceId,level,valid,ms,plan:{originalLetters:plan.originalLetters,targetLetters:plan.targetLetters,short:plan.short,maxRows:plan.targetCap},
    metrics,completionTokens:answer.usage?.completion_tokens??null,semanticallyCertified:false});
   console.log('LAB96_CASE',JSON.stringify({source:sourceId,level,valid,actualReduction:metrics.reduction,rows:metrics.grid?.rows,cap:metrics.grid?.maxRows,
    band:metrics.band?.passes,grid:metrics.grid?.passes,both:metrics.completeMathPass,missingFactSignals:metrics.facts?.missing.length,ms}));
   save();return;
  }catch(e){
   const error={source:sourceId,level,call:http,message:String(e?.name||e).slice(0,180)};
   errors.push(error);cases.push({source:sourceId,level,valid:false,error});
   save();console.log('LAB96_RUNTIME_ERROR',JSON.stringify(error));return;
  }
 }
}
if(!KEY){errors.push({message:'Missing preexisting AI_API_KEY / GEMINI_API_KEY'});save();process.exit(1)}
console.log('LAB96_START',JSON.stringify({planned:CASES.length,limit:MAX_HTTP,model:MODEL}));
for(const [source,level] of CASES){
 if(halt||http>=MAX_HTTP)break;
 await test(source,level);
 if(halt)break;
 await wait(700);
}
const done=save();
console.log('LAB96_END',JSON.stringify({provider:done.provider,summary:done.summary}));
