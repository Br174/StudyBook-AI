// LAB100b offline-only: repair the single capitalization mismatch in the SOURCE QUOTE,
// not in Gemini's claim. Replay all 5 first-read outputs and 6 reduction plans each.
// Stress 20k deliberately non-source quotations: none may be silently accepted.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {caseOnlyEvidenceFix,recheckSixPlans} from './lab100-verify-evidence-case.mjs';
import {sha256} from './lab100-first-read-ledger.mjs';
const raw=JSON.parse(readFileSync('audit/reports/lab100-real-first-read.json','utf8'));
const MANUAL=JSON.parse(readFileSync('audit/test-fixtures/lab93-atomic-fact-ledger.json','utf8')).sources;
const errors=[],cases=[],plans=[];
for(const source of FIXTURES){
 const prior=raw.results.find(x=>x.source===source.id);
 const before=JSON.stringify(prior.rawModelFacts);
 const result=caseOnlyEvidenceFix(source,{facts:prior.rawModelFacts});
 const after=JSON.stringify(prior.rawModelFacts);
 if(after!==before)errors.push({source:source.id,reason:'INPUT_DATA_MUTATED'});
 if(!result.valid)errors.push({source:source.id,reason:'CASE_FIX_DID_NOT_RESTORE_LEDGER',details:result.validationErrors});
 const reuses=result.valid?recheckSixPlans(source,result):null;
 const modelClaims=prior.rawModelFacts.map(f=>f.claim).join(' ');
 const reference=MANUAL[source.id].flatMap(entry=>[...entry.core,...entry.support]);
 const missing=reference.filter(f=>!new RegExp(f.re,'iu').test(modelClaims)).map(f=>f.id);
 const sourceSignature=sha256(source.concepts.join(' ').normalize('NFC').replace(/\s+/gu,' ').trim());
 if(reuses?.plans.length!==6||reuses.plans.some(p=>p.ledgerSourceHash!==sourceSignature))
  errors.push({source:source.id,reason:'FINGERPRINT_OR_REUSE_INCORRECT'});
 for(const p of reuses?.plans||[])plans.push({source:source.id,level:p.level,ledgerHash:p.ledgerHash,
   letters:p.targetLetters,rows:p.maxRows});
 cases.push({
  source:source.id,originalModelAnchorValidated:prior.anchorValidated,
  afterSafeMetadataFix:result.valid,caseOnlyChanges:result.changes,
  originalClaimHash:sha256(modelClaims),claimHashAfterFix:sha256(result.facts.map(f=>f.claim).join(' ')),
  modelClaimsIntact:result.facts.every((f,i)=>f.claim===prior.rawModelFacts[i].claim),
  modelFacts:result.facts.length,referenceRubricItems:reference.length,
  lexicalRubricMatches:reference.length-missing.length,missingRubricHints:missing,
  warnings:result.validationWarnings,
  sixPlans:reuses?.plans.length||0,
  semanticCertification:false
 });
 if(!cases.at(-1).modelClaimsIntact)errors.push({source:source.id,reason:'MODEL_CLAIM_CHANGED'});
}
let seed=100021,negative=0,negativeRejected=0;
const random=()=>((seed=(Math.imul(seed,1103515245)+12345)>>>0)/4294967296);
for(let n=0;n<20000;n++){
 const source=FIXTURES[Math.floor(random()*FIXTURES.length)];
 const first=raw.results.find(x=>x.source===source.id);
 const facts=first.rawModelFacts.map(x=>({...x}));
 const i=Math.floor(random()*facts.length);
 facts[i].evidence='La frase inventata non appare nella fonte, numero='+n;
 const result=caseOnlyEvidenceFix(source,{facts});
 negative++;if(!result.valid&&result.rejections.length)negativeRejected++;
 else errors.push({n,source:source.id,reason:'SOURCE_HALLUCINATED_EVIDENCE_ACCEPTED'});
 if(errors.length>4)break;
}
const summary={sources:cases.length,firstReadingGeminiCalls:raw.provider.attempts,
 sourceFacts:cases.reduce((n,x)=>n+x.modelFacts,0),
 originalValid:cases.filter(x=>x.originalModelAnchorValidated).length,
 safeMetadataCorrections:cases.reduce((n,x)=>n+x.caseOnlyChanges.length,0),
 finalAnchorValid:cases.filter(x=>x.afterSafeMetadataFix).length,
 sixLevelPlans:plans.length,
 manualRubricTotal:cases.reduce((n,x)=>n+x.referenceRubricItems,0),
 lexicalRubricMatched:cases.reduce((n,x)=>n+x.lexicalRubricMatches,0),
 negativeCases:negative,negativeRejected,modelClaimsUnmodified:cases.every(x=>x.modelClaimsIntact),
 semanticallyCertified:0,errors:errors.length};
const report={study:'LAB100 safe evidence quote case reconciliation and six-level reuse',
 date:new Date().toISOString(),modelCallsThisAudit:0,summary,cases,plans,errors,
 caution:'Literal source quote and manually calibrated regex matching are not proof of semantic equivalence, and this test does not certify full-book PDF segmentation.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab100-safe-anchor-final.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB100_FINAL_SAFE_ANCHORS',JSON.stringify(summary));
if(errors.length||summary.finalAnchorValid!==5||summary.sixLevelPlans!==30||negativeRejected!==negative)process.exitCode=1;
