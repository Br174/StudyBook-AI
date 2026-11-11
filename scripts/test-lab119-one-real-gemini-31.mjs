// LAB119 real ONE provider response, two public synthetic pages.
// No private PDF, no retry, no paid model, no APK or Worker changes.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {prepareSemanticLadderV119,composeSemanticLadderV119,
 semanticLadderInstructionV119,semanticLadderUserV119}
 from '../src/lib/studySemanticLadderV119.js';
import {STUDY_LEVELS_V67} from '../src/lib/studyRebalancePolicyV67.js';
const file='audit/reports/lab119-one-real-response-31.json';
mkdirSync('audit/reports',{recursive:true});
const record={lab:'LAB119B',method:'single-core-five-expansions',
 source:'PUBLIC_SYNTHETIC_TWO_PAGES',
 realUserPdfUsed:false,freeTier:true,model:'gemini-3.1-flash-lite',
 requests:0,retries:0,status:'INITIALIZED',levels:[],
 semanticCertified:false,approvedForApp:false,rawReply:null};
const save=()=>writeFileSync(file,JSON.stringify(record,null,2)+'\n');
save();
const key=process.env.AI_TEST_KEY||'';
if(!key){record.status='NO_EXISTING_FREE_KEY';save();process.exit(2)}
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const samples=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:String(i)+':0',source:x.text,
  pageStart:i+1,pageEnd:i+1}));
const plan=prepareSemanticLadderV119(samples);
const unitSchema={type:'object',additionalProperties:false,
 properties:{id:{type:'string'},
  core:{type:'string'},extra50:{type:'string'},extra40:{type:'string'},
  extra30:{type:'string'},extra20:{type:'string'},extra10:{type:'string'}},
 required:['id','core','extra50','extra40','extra30','extra20','extra10']};
const responseFormat={type:'json_schema',json_schema:{
 name:'studybook_lab119_core_additions',strict:true,
 schema:{type:'object',additionalProperties:false,
  properties:{units:{type:'array',items:unitSchema}},required:['units']}}};
try{
 const began=Date.now();
 record.requests=1;record.status='REQUEST_SUBMITTED';save();
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',{
  method:'POST',signal:AbortSignal.timeout(110000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
  body:JSON.stringify({model:record.model,temperature:0.05,
   reasoning_effort:'low',max_tokens:12500,response_format:responseFormat,
   messages:[
    {role:'system',content:semanticLadderInstructionV119()+ '\\n'+[
      'CONTROPROVA LAB119B: NON scrivere parole come ulteriori dettagli inclusi, testo originario, conformità o spiegazioni generiche. Ogni frase di tutte le sei parti deve riportare una informazione concreta del documento originale.',
      'Tutti i concetti distinti della fonte sono fondamentali: elenca internamente tutti i fatti prima di scrivere CORE. Scegli termini brevi preservando ogni negazione, eccezione e rapporto causale. Influire non significa causare.',
      'Distribuisci la lunghezza delle risposte: CORE da solo deve raggiungere almeno il 35% e non oltre il 45% delle lettere originali di ciascuna unità. Ogni extra aggiunge circa il 10% delle LETTERE ORIGINALI; il totale CORE + 5 extra deve conservare circa il 90% delle lettere originali.',
      'Non copiare la fonte intera nel CORE. Non sostituire un fatto omesso con una frase meta-descrittiva. Per ogni campo aggiuntivo includi soltanto spiegazioni specifiche, presenti nella fonte e NON già ripetute nei campi precedenti.',
      'Se non ci sono sufficienti dettagli non ripetitivi per un extra, riporta comunque la migliore espansione vera senza inventare filler; il software registrerà il mancato raggiungimento della quota.',
      'Testo finale non una lista di titoli del capitolo: ogni frase autonoma, leggibile e concreta.'
     ].join('\\n')},
    {role:'user',content:JSON.stringify(semanticLadderUserV119(plan))}]})
 });
 record.elapsedMs=Date.now()-began;
 record.httpStatus=response.status;
 const payload=await response.json().catch(()=>null);
 if(!response.ok){
  record.status='PROVIDER_ERROR';record.error='HTTP_'+response.status;
  record.providerCode=String(payload?.error?.status||'UNKNOWN').slice(0,80);
  save();console.log(JSON.stringify({lab:record.lab,requests:1,
   httpStatus:record.httpStatus,elapsedMs:record.elapsedMs,error:record.error}));
  process.exit(2);
 }
 record.promptTokens=payload?.usage?.prompt_tokens??null;
 record.outputTokens=payload?.usage?.completion_tokens??null;
 record.finishReason=payload?.choices?.[0]?.finish_reason??null;
 let answer;
 try{answer=JSON.parse(payload?.choices?.[0]?.message?.content||'')}
 catch{throw Error('NON_JSON_MODEL_REPLY')}
 record.rawReply=answer;save();
 const assembled=composeSemanticLadderV119(plan,answer);
 record.levels=STUDY_LEVELS_V67.map(level=>{
  const q=assembled.quality[level];
  return{level,actualReduction:q.achievedReduction,
   targetReduction:level==='summary'?60:Number(level),
   numericAndRows:q.numericAndRowsPass,
   passingPages:q.compliantPages,totalPages:q.pageCount,
   strictPreliminarySafe:q.strictPreliminarySafe,
   factualWarnings:q.meaningDiagnostics,
   text:assembled.partsByLevel[level]};
 });
 record.numericLevelPasses=record.levels.filter(l=>l.numericAndRows).length;
 record.contentPreliminaryLevelPasses=record.levels.filter(l=>l.strictPreliminarySafe).length;
 record.status=record.numericLevelPasses===6&&
  record.contentPreliminaryLevelPasses===6?
   'PASS_PRELIMINARY_NOT_SEMANTICALLY_CERTIFIED':
   'NOT_APPROVED_NUMERIC_OR_SEMANTIC_RISK';
 save();
 console.log(JSON.stringify({lab:record.lab,requests:record.requests,
  retries:0,elapsedMs:record.elapsedMs,promptTokens:record.promptTokens,
  outputTokens:record.outputTokens,
  numericLevelPasses:record.numericLevelPasses,
  contentPreliminaryLevelPasses:record.contentPreliminaryLevelPasses,
  results:record.levels.map(q=>({level:q.level,reduction:q.actualReduction,
   pagesPass:q.passingPages,total:q.totalPages,numeric:q.numericAndRows,
   preliminaryContent:q.strictPreliminarySafe,
   risks:q.factualWarnings.map(w=>({
    lostNumeric:w.lostNumericalClaims,
    introducedNumeric:w.inventedNumericalClaims,
    missingHighValue:w.highValueMissing,
    missingProtected:w.protectedMissing,
    qualifierScope:w.qualifierScopeMismatches,
    directional:w.directionalAdvisories.length
   }))})),
  semanticCertified:false,approvedForApp:false},null,2));
 if(record.status.startsWith('NOT_APPROVED'))process.exitCode=2;
}catch(e){
 record.error=String(e?.message||e).slice(0,230);
 record.status='RESEARCH_ERROR';save();
 console.error(JSON.stringify({lab:record.lab,status:record.status,
  error:record.error,requests:record.requests}));process.exitCode=2;
}
