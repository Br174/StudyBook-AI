// LAB101c: editorially proposed single priority correction on a TEST COPY.
// No Gemini calls, no modifications to model facts or the actual LAB101 stored output.
// "Registro: who and when" is independently essential for the source concept C4.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {rankFirstRead} from './lab101-priority-ledger.mjs';
import {priorityRiskAudit} from './lab101-concept-priority-gate.mjs';
const history=JSON.parse(readFileSync('audit/reports/lab101-real-priorities.json','utf8'));
const src=FIXTURES.find(x=>x.id==='procedura'),page=history.pages.find(x=>x.source==='procedura');
const originalFacts=page.rawPriorities.map(x=>({...x}));
const candidateFacts=originalFacts.map(x=>({...x}));
const item=candidateFacts.find(x=>x.id==='F11');
if(!item||item.priority!=='supporto'||!/registro|destinatar|giorno/iu.test(item.claim))
 throw Error('EXPECTED_UNDERPRIORITIZED_FACT_NOT_FOUND');
item.priority='fondamentale';
const original=rankFirstRead(src,{facts:originalFacts}),candidate=rankFirstRead(src,{facts:candidateFacts});
const oldRisk=priorityRiskAudit(src,original.ledger),newRisk=priorityRiskAudit(src,candidate.ledger);
const preserved=originalFacts.every((f,i)=>Object.entries(f).every(([k,v])=>
 k==='priority'||candidateFacts[i][k]===v));
const edits=originalFacts.flatMap((f,i)=>f.priority!==candidateFacts[i].priority?[{
 factId:f.id,from:f.priority,to:candidateFacts[i].priority,evidence:f.evidence,claim:f.claim
}]:[]);
const errors=[];
if(!original.valid||!candidate.valid)errors.push('CANDIDATE_SOURCE_INVALID');
if(!preserved||edits.length!==1||edits[0].factId!=='F11')errors.push('CHANGED_FACT_CONTENT_OR_MULTIPLE_PRIORITIES');
if(oldRisk.byConcept.find(x=>x.concept==='C4').fundamental!==0)errors.push('ORIGINAL_C4_MUST_HAVE_ZERO_CORE');
if(newRisk.byConcept.find(x=>x.concept==='C4').fundamental!==1)errors.push('C4_CORE_NOT_RECOVERED');
if(original.ledger.hash===candidate.ledger.hash)errors.push('PRIORITY_HASH_STALE');
if(original.ledger.sourceHash!==candidate.ledger.sourceHash)errors.push('SOURCE_TEXT_HASH_CHANGED');
if(candidate.plans.length!==6||candidate.plans.some(x=>!x.fundamentalFactIds.includes('F11')))
 errors.push('NEW_CORE_NOT_PROTECTED_IN_ALL_SIX');
const summary={
 editedFactPriorities:edits.length,unchangedClaims:preserved,
 sourceHashUnchanged:original.ledger.sourceHash===candidate.ledger.sourceHash,
 distinctPriorityHashes:original.ledger.hash!==candidate.ledger.hash,
 beforeC4Core:oldRisk.byConcept.find(x=>x.concept==='C4').fundamental,
 afterC4Core:newRisk.byConcept.find(x=>x.concept==='C4').fundamental,
 originalHighRiskFlags:oldRisk.highRiskFlags,
 afterHighRiskFlags:newRisk.highRiskFlags,
 additionalModelCalls:0,sixPlansChecked:candidate.plans.length,
 productionApproved:false,errors:errors.length
};
const doc={study:'LAB101c local editorial priority correction feasibility',
 date:new Date().toISOString(),summary,edits,errors,
 remainingFlags:newRisk.flags,
 originalHash:original.ledger.hash,revisedHash:candidate.ledger.hash,
 originalSixLevelFingerprint:original.plans.map(x=>x.rankedInventoryHash),
 revisedSixLevelFingerprint:candidate.plans.map(x=>x.rankedInventoryHash),
 warning:'This is an explicit review-based correction on a cloned experimental fact map. It is not a generally reliable automatic ranking algorithm; the remaining negative-clause support flag needs review. No actual reduced texts or app release.'};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab101-local-priority-correction.json',JSON.stringify(doc,null,2)+'\n');
console.log('LAB101_LOCAL_CORRECTION',JSON.stringify(summary));
if(errors.length)process.exitCode=1;
