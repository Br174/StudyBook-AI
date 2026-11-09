// MotorLab StudyBook LAB99b: ONE additional quota-bounded attempt for a rejected sentence.
// Only optional targeted correction when a first attempt recovers a source relation
// but misses the page's letter band. Never asks Gemini to revise the whole page.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {analyzeCandidate} from './lab99-targeted-sentence-patch.mjs';
const PREV=JSON.parse(readFileSync('audit/reports/lab99-gemini-sentence-repairs.json','utf8'));
const LIST=JSON.parse(readFileSync('audit/test-fixtures/lab99-sentence-repair-cases.json','utf8')).cases;
const OUTPUT='audit/reports/lab99-one-retry-gemini.json';
const MODEL='gemini-3.5-flash-lite',API='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',KEY=process.env.AI_TEST_KEY||'';
const format={type:'json_schema',json_schema:{name:'studybook_lab99b_compact_sentence',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{sentence:{type:'string'}},required:['sentence']}}};
const rejected=PREV.results.filter(x=>x.received&&x.check?.verdict==='REJECT_ROLLBACK'&&x.check?.forbiddenReasons.length===1&&x.check.forbiddenReasons.includes('LETTER_BAND_OUTSIDE'));
let attempts=0,providerError=null,result=null;
function save(){
 const report={study:'LAB99b exactly one targeted follow-up for one failed candidate',date:new Date().toISOString(),
  allowedCases:rejected.length,attempts,model:MODEL,providerError,result,
  limits:'Never additional calls after 429/503; only one call for first failed sentence. No production edits.',
  semanticCertification:false,prodModified:false};
 mkdirSync('audit/reports',{recursive:true});
 writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
 return report;
}
const page=rejected[0];
if(rejected.length!==1||page.caseId!=='unread_reserved_procedura40'){
 console.log('LAB99B_SKIP_NOT_UNIQUE_REJECTION',JSON.stringify({rejected:rejected.length}));save();process.exit(0);
}
const c=LIST.find(x=>x.id===page.caseId),src=FIXTURES.find(x=>x.id===c.source);
const upper=Math.floor(page.check.old.letters/(1-page.check.old.reduction/100)*(1-(c.level-5)/100));
const preciseOriginalLetters=src.concepts.join(' ').match(/\p{L}/gu).length;
const high=Math.floor(preciseOriginalLetters*(1-(c.level-5)/100));
const needToSave=Math.max(1,page.check.next.letters-high);
if(!KEY){providerError='No existing secret';save();process.exit(1)}
const prompt=[
 'StudyBook AI: RISCRIVI SOLO UNA FRASE ITALIANA. Questo è un unico tentativo di rendere più concisa la frase proposta, non una nuova generazione di pagina.',
 'FONTE AUTOREVOLE: '+c.evidence,
 'FRASE GIA PROPOSTA MA TROPPO LUNGA: '+page.modelOutputSentence,
 'Devi risparmiare almeno '+needToSave+' lettere alfabetiche rispetto alla frase proposta, ma senza cancellare: (1) libro già riservato/prenotato; (2) obbligo di restituzione; (3) scadenza; (4) anche se la lettura non è finita.',
 'Nessuna informazione nuova, nessuna abbreviazione innaturale, niente sintesi dell intera pagina. Il testo attorno a questa frase resterà invariato.',
 'Rispondi con un solo JSON {"sentence":"..."} contenente UNA frase italiana grammaticale che termini con un punto.'
].join('\n\n');
try{
 attempts=1;
 const start=performance.now();
 const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},
  body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:240,response_format:format,
   messages:[{role:'user',content:prompt}]}),
  signal:AbortSignal.timeout(50000)});
 const ms=Math.round(performance.now()-start);
 const payload=await r.json().catch(()=>({}));
 if(!r.ok){
  providerError={status:r.status,message:String(payload.error?.message||'HTTP error').slice(0,140)};
  console.log('LAB99B_PROVIDER_STOP',JSON.stringify(providerError));
 }else{
  let raw=String(payload.choices?.[0]?.message?.content||'').trim();
  if(raw.startsWith('~~~'))raw=raw.replace(/^~~~json\s*/iu,'').replace(/\s*~~~$/u,'');
  let candidate='';try{candidate=String(JSON.parse(raw).sentence||'')}catch{}
  const check=analyzeCandidate(src,c.level,page.check.oldText,c,candidate);
  result={caseId:c.id,output:candidate,ms,check,approvedForApp:false};
  console.log('LAB99B_RETRY',JSON.stringify({caseId:c.id,output:candidate,accepted:check.acceptedMathematically,
   percent:check.next?.reduction,rows:check.next?.rows,limit:check.next?.cap,why:check.forbiddenReasons}));
 }
}catch(e){
 providerError={issue:String(e?.name||e).slice(0,150)};
 console.log('LAB99B_RUNTIME_STOP',JSON.stringify(providerError));
}
const done=save();
console.log('LAB99B_FINAL',JSON.stringify({attempts:done.attempts,accepted:done.result?.check?.acceptedMathematically||false,hasProviderError:!!done.providerError}));
