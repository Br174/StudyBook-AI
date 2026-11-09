// StudyBook LAB99 offline relation robustness and targeted patch rollback.
// 20k deterministic adversarial cases, ALL original sources checked, all 15 LAB98 outputs replayed.
// Zero Gemini requests; handcrafted candidate sentences are feasibility illustrations only.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {evaluateLean} from './lab96-eval.mjs';
import {sentences,relationshipGuard,relationRulesFor} from './lab99-relational-guard.mjs';
import {analyzeCandidate} from './lab99-targeted-sentence-patch.mjs';
const older=JSON.parse(readFileSync('audit/reports/lab98-real-gemini.json','utf8'));
const cases=JSON.parse(readFileSync('audit/test-fixtures/lab99-sentence-repair-cases.json','utf8')).cases;
const golden={
 tides_sole_scienze50:'La Luna e il Sole influiscono sulle maree.',
 hemoglobin_red_cells_medicina20:"Nei globuli rossi, l'emoglobina trasporta gran parte dell'ossigeno.",
 unread_reserved_procedura40:'Se prenotato, va restituito alla scadenza anche se la lettura non è finita.',
 eclipses_lunation_scienze40:'Le eclissi richiedono allineamenti particolari e non avvengono a ogni lunazione.'
};
const problems=[],replayed=[],orig=[];
const source=id=>FIXTURES.find(x=>x.id===id);
for(const s of FIXTURES){
 const txt=s.concepts.join(' ');
 const scan=relationshipGuard(s.id,txt,txt);
 orig.push({source:s.id,checked:scan.applicable,alerts:scan.alerts.map(x=>x.id)});
 if(scan.alerts.length||scan.applicable<1)problems.push({source:s.id,issue:'false alert on unchanged original',alerts:scan.alerts});
}
for(const result of older.results.filter(x=>x.valid)){
 const s=source(result.source), original=s.concepts.join(' ');
 const check=relationshipGuard(s.id,original,result.metrics.text);
 const m=evaluateLean(s,result.level,result.metrics.text);
 if(m.reduction!==result.metrics.reduction)problems.push({source:s.id,level:result.level,issue:'ratio drift'});
 replayed.push({source:result.source,level:result.level,math:m.completeMathPass,
  oldGuardAlerts:result.guard.alerts.map(x=>x.id),relationalAlerts:check.alerts.map(x=>x.id),
  criticalFacts:check.applicable,hadNoOldGuardAlerts:result.guard.alerts.length===0});
}
const prepared=[];
for(const entry of cases){
 const s=source(entry.source),found=older.results.find(x=>x.valid&&x.source===entry.source&&x.level===entry.level);
 if(!found)throw Error('Case missing from LAB98 output '+entry.id);
 const test=analyzeCandidate(s,entry.level,found.metrics.text,entry,golden[entry.id]);
 prepared.push({caseId:entry.id,type:'MANUALLY_AUTHORED_REFERENCE_NOT_GEMINI',verdict:test.verdict,
  factsFixed:test.targetRecovered,geometryBefore:test.old?.rows,geometryAfter:test.next?.rows,
  percentBefore:test.old?.reduction,percentAfter:test.next?.reduction,
  reasons:test.forbiddenReasons,proposedText:test.newText,approvedForApp:false});
 if(!test.candidateValid||!test.targetRecovered)problems.push({caseId:entry.id,issue:'handwritten relation not detected'});
}
// Remove the sentence containing a relation; it must be flagged even if another paragraph has related words.
const allValidPairs=[];
for(const s of FIXTURES){
 const sourceText=s.concepts.join(' '),parts=sentences(sourceText);
 for(const rule of relationRulesFor(s.id)){
  if(!rule.orig.test(sourceText))continue;
  const index=parts.findIndex(sentence=>rule.words.every(re=>re.test(sentence)));
  if(index<0)problems.push({source:s.id,rule:rule.id,issue:'original has relation but not in one sentence'});
  else allValidPairs.push({s,sourceText,parts,index,rule});
 }
}
let seed=9988111;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let mutations=0,detected=0;
for(let n=0;n<20000;n++){
 const record=allValidPairs[Math.floor(random()*allValidPairs.length)];
 const modified=record.parts.map((line,i)=>i===record.index?'Informazione specifica omessa.':line).join(' ');
 const check=relationshipGuard(record.s.id,record.sourceText,modified);
 mutations++;
 if(check.alerts.some(x=>x.id===record.rule.id))detected++;
 else problems.push({source:record.s.id,rule:record.rule.id,issue:'deliberate source relation deletion unflagged',index:n});
 if(problems.length>=8)break;
}
for(const c of cases){
 const s=source(c.source),item=older.results.find(x=>x.valid&&x.source===c.source&&x.level===c.level);
 // Wrong replacements must be rejected without any part of the original source changing.
 const bad=analyzeCandidate(s,c.level,item.metrics.text,c,'Riga completata senza informazioni.');
 if(bad.candidateValid&&bad.acceptedMathematically)problems.push({caseId:c.id,issue:'irrelevant patch accepted'});
}
const improvements=replayed.filter(x=>x.hadNoOldGuardAlerts&&x.relationalAlerts.length>0);
const summary={originalPages:orig.length,originalFalseAlerts:orig.reduce((a,x)=>a+x.alerts.length,0),
 relationsInOriginals:allValidPairs.length,oldPagesReplayed:replayed.length,
 historicalFalseNegativesRevealed:improvements.length,
 handcraftedPatches:prepared.length,handcraftedProvisionalAccepted:prepared.filter(x=>x.verdict==='PRELIMINARY_ACCEPT_NEEDS_SEMANTIC_REVIEW').length,
 deliberateMutations:mutations,mutationsDetected:detected,issues:problems.length};
const out={study:'LAB99 relation verification, patch safety and rollback offline',
 date:new Date().toISOString(),modelCalls:0,summary,originals:orig,historical:replayed,handcrafted:prepared,
 limitations:'Rules are manually developed for five fixed synthetic study pages; same-sentence matches can miss valid paraphrases or miss wrong meaning. Handwritten candidate edits are NOT Gemini generated and NOT production-ready.',
 problems};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab99-relational-offline.json',JSON.stringify(out,null,2)+'\n');
console.log('LAB99_OFFLINE_FINAL',JSON.stringify(summary));
if(problems.length||detected!==mutations)process.exitCode=1;
