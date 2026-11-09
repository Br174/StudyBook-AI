// MotorLab LAB100 offline first-reading stress: 5 pages x 6 levels, 30k seeded tampering checks.
// NO Gemini calls. Synthetic perfect baseline deliberately copies source sentences; it is
// ONLY an integrity calibration, NOT an AI-generated fact ledger or semantic success.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {validateLedger,splitSentences,splitClauses,makeSixPlans,sha256} from './lab100-first-read-ledger.mjs';
const errors=[],originals=[],warnings=[],plans=[];
for(const src of FIXTURES){
 const source=src.concepts.join(' '),sentences=splitSentences(source);
 const facts=sentences.map((s,i)=>({id:'F'+(i+1),sourceSentence:s.id,evidence:s.text,
  claim:s.text,kind:'fatto',essential:true}));
 const chk=validateLedger(src,{facts});
 if(!chk.valid)errors.push({source:src.id,issue:'literal baseline must validate',errors:chk.errors});
 const reuse=makeSixPlans(src,chk.payload);
 if(reuse.plans.length!==6||new Set(reuse.plans.map(p=>p.ledgerHash)).size!==1)
   errors.push({source:src.id,issue:'six level immutable reuse failed'});
 for(const p of reuse.plans)plans.push({source:src.id,level:p.level,letters:p.targetLetters,maxRows:p.maxRows,hash:p.ledgerHash});
 originals.push({source:src.id,sourceSentences:sentences.length,clauses:sentences.reduce((n,s)=>n+splitClauses(s.text).length,0),
  sourceLetters:chk.completeness?.sourceLetters,anchorValidation:chk.valid,warnings:chk.warnings.length,
  sameInventoryAcrossSixLevels:true});
 warnings.push(...chk.warnings.filter(x=>x.startsWith('CRITICAL_MARKER')).map(w=>src.id+':'+w));
}
const seeded=[];let seed=10011234;
const next=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<30000;i++){
 const src=FIXTURES[Math.floor(next()*FIXTURES.length)],text=src.concepts.join(' ');
 const split=splitSentences(text);
 const f=split.map((s,k)=>({id:'F'+(k+1),sourceSentence:s.id,evidence:s.text,claim:s.text,kind:'fatto',essential:true}));
 const idx=Math.floor(next()*f.length);
 const operation=i%5;
 let detected=false;
 if(operation===0){ // drops a whole sentence's only fact
  f.splice(idx,1);
  detected=!validateLedger(src,{facts:f}).valid;
 }else if(operation===1){ // cross-page invented evidence
  f[idx].evidence='INFORMAZIONE NON PRESENTE NELLA FONTE';
  detected=!validateLedger(src,{facts:f}).valid;
 }else if(operation===2){ // invented nonexistent sentence
  f[idx].sourceSentence='S'+(split.length+1);
  detected=!validateLedger(src,{facts:f}).valid;
 }else if(operation===3){ // duplicate fact IDs
  f.push({...f[idx]});
  detected=!validateLedger(src,{facts:f}).valid;
 }else{ // use cached ledger with a different source by ID or content
  const v=validateLedger(src,{facts:f});
  try{const change={...src,concepts:[...src.concepts,'Una nuova frase non analizzata.']};
   makeSixPlans(change,v.payload);
  }catch(e){detected=String(e).includes('LEDGER_SOURCE_HASH_MISMATCH')}
 }
 if(!detected){errors.push({i,source:src.id,operation,issue:'source integrity tamper was not detected'});if(errors.length>=5)break}
 if(i<15)seeded.push({source:src.id,operation,detected});
}
const summary={sources:originals.length,levelPlans:plans.length,seededCases:errors.length?Math.min(30000,seeded.length):30000,
  stableReuse:originals.every(x=>x.sameInventoryAcrossSixLevels),syntaxDefects:errors.length,
  sourceEvidenceWarnings:warnings.length,modelCalls:0};
const report={study:'LAB100 deterministic first-read integrity and six-level reuse',
 date:new Date().toISOString(),scope:'Five benchmark pages, synthetic literal source-as-ledger reference, not model understanding.',
 summary,originals,plans,representativeTampering:seeded,errors,
 caution:'Letter and source-anchor completeness cannot certify semantic correctness. A source sentence with two facts can still be incompletely represented by one model-generated claim.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab100-first-read-offline.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB100_OFFLINE_RESULT',JSON.stringify(summary));
if(errors.length||plans.length!==30)process.exitCode=1;
