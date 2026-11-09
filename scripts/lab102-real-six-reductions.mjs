// StudyBook AI / MotorLab LAB102. Experimental six real reductions, not Android code.
// Source authority: immutable LAB101 first-reading ledgers; only a copy of each
// reduced text is generated. This runner is free-tier bounded and checkpointed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {letters,wrap,budget,evaluate} from './lab92-stop-complete-engine.mjs';
import {normalize,sha256} from './lab100-first-read-ledger.mjs';
import {mapSentencesToConcepts,priorityRiskAudit} from './lab101-concept-priority-gate.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';

const INPUT='audit/reports/lab101-real-priorities.json';
const OUTPUT='audit/reports/lab102-real-six-reductions.json';
const SCHEMA={type:'json_schema',json_schema:{name:'lab102_page_sections',strict:true,
 schema:{type:'object',additionalProperties:false,properties:{
  sections:{type:'array',items:{type:'object',additionalProperties:false,
   properties:{id:{type:'string'},text:{type:'string'}},required:['id','text']}}
 },required:['sections']}}};
const LEVEL_ORDER=[65,50,40,30,20,10];
const MODEL='gemini-3.5-flash-lite';
const ENDPOINT='https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fixturesById=new Map(FIXTURES.map(s=>[s.id,s]));
const firstRead=JSON.parse(readFileSync(INPUT,'utf8'));
const audits=new Map(firstRead.pages.filter(p=>p.anchorValidated).map(p=>[p.source,p]));
const selection=(process.env.LAB102_PAGE_SELECTION||'scienze').split(',').map(x=>x.trim()).filter(Boolean);
const chosen=selection.includes('all')?FIXTURES.map(s=>s.id):selection;
const perPageLimit=8; // Six real versions plus at most two recoverable 503 retries.
let attempts=0,halted=false,haltReason=null;
const errors=[],pages=[];

function prepare(id){
 const source=fixturesById.get(id),old=audits.get(id);
 if(!source||!old||!old.ledger||old.plans?.length!==6)throw Error('NO_VERIFIED_LAB101_SOURCE_'+id);
 const sourceText=normalize(source.concepts.join(' '));
 if(sha256(sourceText)!==old.ledger.sourceHash)throw Error('SOURCE_HASH_CHANGED_'+id);
 if(old.ledger.sourceId!==id||old.plans.some(p=>p.rankedInventoryHash!==old.ledger.hash))
  throw Error('INVENTORY_PLAN_HASH_CHANGED_'+id);
 const risks=priorityRiskAudit(source,old.ledger);
 const sentenceOwner=mapSentencesToConcepts(source);
 const checks=source.concepts.map((_,i)=>{
  const cid='C'+(i+1);
  const facts=old.ledger.facts.filter(f=>sentenceOwner.get(f.sourceSentence)===cid);
  return{cid,facts};
 });
 const plans=LEVEL_ORDER.map(level=>{
  const saved=old.plans.find(p=>p.level===level);
  const actual=budget(source,level);
  if(!saved||saved.targetLetters!==actual.targetLetters||saved.maxRows!==actual.targetCap)
   throw Error('PLAN_DRIFT_'+id+'_'+level);
  return{...saved,originalRows:actual.originalRows,short:actual.short,targetCap:actual.targetCap,toleranceCap:actual.toleranceCap};
 });
 return{source,old,risks,checks,plans,sourceHash:old.ledger.sourceHash};
}
function createPrompt(ctx,plan){
 const page=ctx.source;
 const text=[];
 text.push('STUDYBOOK LAB102: scrivi una vera versione DI STUDIO in italiano di UNA sola pagina, conservando il significato originale.');
 text.push('RIDUZIONE RICHIESTA: '+(plan.level===65?'Riassunto circa 65%':plan.level+'%')+'. Fonte: '+plan.originalLetters+' lettere alfabetiche Unicode. Obiettivo '+plan.targetLetters+' lettere, fascia '+plan.band.low+'..'+plan.band.high+' lettere. Massimo '+plan.maxRows+' righe virtuali di 60 caratteri (spazi e segni compresi), senza spezzare parole. Non usare font più piccolo o altre pagine.');
 text.push('Sono richieste '+page.concepts.length+' unità C1...C'+page.concepts.length+'. Rispondi con sections, stessa sequenza, una stringa italiana per unità. Non spostare contenuti tra unità.');
 text.push('Conserva TUTTI i fatti fondamentali, compresi negazioni, cause, condizioni, numeri, possibilità e distinzioni; non far diventare «può» «deve», «non» una frase affermativa, o «documentato» «dimostrato». Se la percentuale è incompatibile con tutti i fatti, scrivi la versione più fedele possibile: non cancellare fatti per inseguire il numero.');
 text.push('Dai priorità al senso, poi alla quantità. Dal 50% al Riassunto espressione sintetica; al 10% testo quasi completo. Stile semplice ma conserva vocaboli tecnici indispensabili. Quando il pensiero finisce, FERMATI: niente riempitivi o completamento artificioso della riga. Niente parole spezzate.');
 if(plan.short)text.push('Pagina originale molto breve: nessun obbligo di percentuale, ma conservazione dei concetti e massima chiarezza.');
 for(let i=0;i<ctx.checks.length;i++){
  const x=ctx.checks[i],essential=x.facts.filter(f=>f.priority==='fondamentale').map(f=>f.claim);
  const support=x.facts.filter(f=>f.priority==='supporto').map(f=>f.claim);
  text.push(x.cid+' ORIGINALE: '+page.concepts[i]);
  // Reuse ranked LAB101 facts without quotes, full ledger, or second first-read API.
  text.push(x.cid+' FONDAMENTALI GIÀ VERIFICATI ALLA FONTE: '+essential.join(' | '));
  if(support.length)text.push(x.cid+' SUPPORTI DA CONSIDERARE: '+support.join(' | '));
 }
 text.push('Rispondi ESCLUSIVAMENTE con JSON {"sections":[{"id":"C1","text":"..."},...]}. Non includere titoli nuovi, percentuali, spiegazioni del conteggio o commenti.');
 return text.join('\n\n');
}
function review(ctx,plan,payload){
 const sections=payload?.sections;
 const metrics=evaluate(ctx.source,plan,sections);
 if(!metrics.valid)return{receivedSections:sections,metrics,verdict:'REJECT_FORMAT',semanticCertified:false,approvedForApp:false};
 const joined=sections.map(x=>x.text).join(' ');
 const relation=relationshipGuard(ctx.source.id,normalize(ctx.source.concepts.join(' ')),joined);
 const criticalAlerts=relation.alerts||[];
 const mathPass=metrics.strictBand&&metrics.fitsTarget&&metrics.wordIntegrity&&!metrics.spuriousMultipleSpaces;
 const lexicalAlarmCount=metrics.missingRubric.length+metrics.technicalMissing.length;
 return{
  sections,metrics:{
   sourceLetters:metrics.sourceLetters,targetLetters:metrics.targetLetters,actualLetters:metrics.letters,
   reductionPercent:metrics.reduction,percentageDeviation:metrics.deviationPoints,
   strictBand:metrics.strictBand,rows:metrics.rows,maxRows:metrics.targetCap,
   virtualRows:metrics.virtualRows,overflows:!metrics.fitsTarget,maxRowWidth:metrics.maxRowWidth,
   wordIntegrity:metrics.wordIntegrity,lexicalWarnings:metrics.missingRubric,
   technicalWarnings:metrics.technicalMissing,spuriousMultipleSpaces:metrics.spuriousMultipleSpaces,
   shortPageExempt:plan.short
  },
  relationAlerts:criticalAlerts,
  preliminaryMathPass:mathPass,
  preliminaryLexicalPass:lexicalAlarmCount===0,
  verdict:mathPass&&lexicalAlarmCount===0&&criticalAlerts.length===0
   ?'NEEDS_HUMAN_SEMANTIC_REVIEW':'REJECT_OR_REVIEW_WITH_TARGETED_REPAIR',
  semanticCertified:false,approvedForApp:false,
  note:'Regex/guard pass is NOT semantic equivalence. Validate source-backed facts, polarity, modality, relations before promotion.'
 };
}
function write(){
 mkdirSync('audit/reports',{recursive:true});
 const summary={selectedPages:chosen.length,processedPages:pages.length,
  successfulGenerations:pages.flatMap(x=>x.versions).filter(v=>v?.providerOk).length,
  expectedGenerations:chosen.length*6,
  numericAndGridPasses:pages.flatMap(x=>x.versions).filter(v=>v?.analysis?.preliminaryMathPass).length,
  preliminarySemanticCertificates:0,approvedForApp:0,
  providerAttempts:attempts,halted,haltReason};
 const data={study:'StudyBook LAB102 real six-level pages',generatedAt:new Date().toISOString(),
  source:'LAB101 original single-read inventories, no new fact extractions',model:MODEL,scope:selection,
  limits:{perPageLimit,freeTierOnly:true,backoff:'one retry for 503, stop on 429'},
  summary,errors,pages,
  constraints:'No production changes, no A4 claim, no Android build, no new secret or paid service. Synthetic pre-extracted samples.'};
 writeFileSync(OUTPUT,JSON.stringify(data,null,2)+'\n');return data;
}
async function request(ctx,plan,state){
 let perPageAttempts=0;
 for(let tryIndex=0;tryIndex<2&&!halted&&perPageAttempts<2;tryIndex++){
  attempts++;perPageAttempts++;state.providerCalls++;
  const start=performance.now();
  try{
   const r=await fetch(ENDPOINT,{
    method:'POST',
    headers:{Authorization:'Bearer '+process.env.AI_TEST_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:MODEL,temperature:0.1,max_tokens:3000,response_format:SCHEMA,
     messages:[{role:'user',content:createPrompt(ctx,plan)}]}),
    signal:AbortSignal.timeout(90000)
   });
   const durationMs=Math.round(performance.now()-start);
   const body=await r.json().catch(()=>({}));
   if(!r.ok){
    errors.push({page:ctx.source.id,level:plan.level,http:r.status,durationMs,
      message:String(body.error?.message||'Provider error').slice(0,160)});
    if(r.status===429){halted=true;haltReason='FREE_TIER_RATE_LIMIT_429';return{providerOk:false,http:429};}
    if(r.status===503&&tryIndex===0&&state.providerCalls<perPageLimit){await sleep(3600);continue;}
    if(r.status===503){halted=true;haltReason='PROVIDER_UNAVAILABLE_503';}
    return{providerOk:false,http:r.status};
   }
   const raw=String(body.choices?.[0]?.message?.content||'').trim();
   let obj;
   try{obj=JSON.parse(raw)}catch{
    errors.push({page:ctx.source.id,level:plan.level,error:'INVALID_JSON',sample:raw.slice(0,100)});
    return{providerOk:false,error:'INVALID_JSON'};
   }
   const analysis=review(ctx,plan,obj);
   return{level:plan.level,providerOk:true,durationMs,analysis};
  }catch(e){
   errors.push({page:ctx.source.id,level:plan.level,error:String(e?.name||e).slice(0,100)});
   return{providerOk:false,error:'RUNTIME_ERROR'};
  }
 }
 return{providerOk:false,error:'RETRY_LIMIT'};
}
function selfTest(){
 const ctx=prepare('scienze');
 assert.equal(ctx.old.ledger.facts.length,12);
 assert.equal(ctx.plans.length,6);
 assert.equal(ctx.plans[0].level,65);
 assert.equal(ctx.plans[5].level,10);
 assert.equal(ctx.plans[0].originalLetters,599);
 assert.equal(ctx.plans.every(p=>p.rankedInventoryHash===ctx.old.ledger.hash),true);
 assert.equal(letters('è ù a 19!!'),3);
 assert.deepEqual(wrap('Uno due tre',7).lines,['Uno due','tre']);
 const bad=review(ctx,ctx.plans[0],{sections:[{id:'C1',text:'rotazione'}]});
 assert.equal(bad.verdict,'REJECT_FORMAT');
 const goodShape=review(ctx,ctx.plans[5],{sections:ctx.source.concepts.map((text,i)=>({id:'C'+(i+1),text}))});
 assert.equal(goodShape.semanticCertified,false);
 assert.equal(goodShape.approvedForApp,false);
 console.log('LAB102_OFFLINE_SELFTEST',JSON.stringify({result:'PASS',sourceFacts:12,plans:6,unicode:true,geometry:true,semanticCertification:false}));
}
async function main(){
 if(process.argv.includes('--self-test')){selfTest();return}
 if(!process.env.AI_TEST_KEY){errors.push({error:'PREEXISTING_FREE_KEY_MISSING'});write();throw Error('PREEXISTING_FREE_KEY_MISSING')}
 for(const id of chosen){
  if(halted)break;
  const ctx=prepare(id);
  const page={source:id,sourceHash:ctx.sourceHash,inventoryHash:ctx.old.ledger.hash,
   fundamentalFacts:ctx.old.ledger.hierarchy.fundamental.length,
   priorityFlags:ctx.risks.flags,originalRows:ctx.plans[0].originalRows,providerCalls:0,versions:[]};
  pages.push(page);
  for(const plan of ctx.plans){
   if(halted||page.providerCalls>=perPageLimit)break;
   const version=await request(ctx,plan,page);
   page.versions.push(version);
   const analysis=version.analysis;
   console.log('LAB102_LEVEL',JSON.stringify({page:id,level:plan.level,
    providerOk:version.providerOk,letters:analysis?.metrics?.actualLetters,
    reduction:analysis?.metrics?.reductionPercent,rows:analysis?.metrics?.rows,
    cap:plan.maxRows,pass:analysis?.preliminaryMathPass,verdict:analysis?.verdict}));
   write(); // Durable evidence per generated level, no full-page redo.
   await sleep(850);
  }
  if(page.versions.length<6){halted=true;haltReason=haltReason||'INCOMPLETE_PAGE';write();}
 }
 const out=write();
 console.log('LAB102_FINAL',JSON.stringify(out.summary));
}
if(fileURLToPath(import.meta.url)===resolve(process.argv[1]))await main();
