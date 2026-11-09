// StudyBook AI LAB103: single-sentence, source-backed quality correction.
// Does not invoke Gemini. Original LAB102 candidate is immutable.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {FIXTURES} from './lab93-semantic-gate.mjs';
import {budget,letters,wrap} from './lab92-stop-complete-engine.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
import {sha256,normalize} from './lab100-first-read-ledger.mjs';
const src=FIXTURES.find(x=>x.id==='concetto_sbilanciato');
assert(src,'source unavailable');
const lab102=JSON.parse(readFileSync('audit/reports/lab102-other-four-real-six-reductions.json','utf8'));
const sourcePage=lab102.pages.find(x=>x.source===src.id);
const output=sourcePage.versions.find(x=>x.level===20&&x.providerOk);
assert(output?.analysis?.sections?.length===src.concepts.length,'historical Gemini candidate not found');
const sections=output.analysis.sections;
const original=normalize(sections.map(s=>s.text).join(' '));
const sentence='Testimonianze diverse sullo stesso episodio dipendono da aspetti osservati o interessi particolari.';
const replacement='Due testimonianze sullo stesso episodio possono differire per aspetti osservati o interessi particolari.';
assert.equal(original.split(sentence).length-1,1,'not an exact unique sentence');
const candidate=original.replace(sentence,replacement);
assert(candidate!==original);
assert(src.concepts.join(' ').includes('Due testimonianze possono riferire lo stesso episodio in modo diverso'),'source mode is not traceable');
const b=budget(src,20);
function audit(t){
 const n=letters(t),w=wrap(t),g=relationshipGuard(src.id,normalize(src.concepts.join(' ')),t);
 return{letters:n,lettersSaved:b.originalLetters-n,reductionPercent:+(100*(1-n/b.originalLetters)).toFixed(2),
  rows:w.lines.length,maxRows:b.targetCap,inBand:b.band.low<=n&&n<=b.band.high,
  gridPass:w.lines.length<=b.targetCap&&!w.overlong,
  relationAlerts:g.alerts.map(a=>a.id),containsPossibility:/testimonianze.{0,70}possono differire/iu.test(t),
  textHash:sha256(normalize(t))};
}
const before=audit(original),after=audit(candidate);
assert(before.inBand&&before.gridPass,'incumbent was not quantitatively compliant');
assert(after.inBand&&after.gridPass,'targeted patch regressed mathematically or geometrically');
assert(after.containsPossibility,'modality restoration not demonstrated');
assert(!after.relationAlerts.some(x=>!before.relationAlerts.includes(x)),'regression in known relationships');
const report={study:'LAB103 isolated correction of one real archived Gemini sentence',
source:'concetto_sbilanciato',level:20,sourceHash:sourcePage.sourceHash,
originalGeminiUnmodified:true,oldSentence:sentence,replacementSentence:replacement,
before,after,retainedPrefixAndSuffix:true,otherSentencesUnchanged:true,
policy:'Single-sentence copy. No filler; no global regeneration; no APK/production writes.',
verdict:'MORE_FAITHFUL_MODALITY_WITH_NO_NUMERIC_GEOMETRIC_REGRESSION_NEEDS_INDEPENDENT_SEMANTIC_REVIEW',
semanticCertified:false,approvedForApp:false,geminiCalls:0,addedCostEuro:0};
writeFileSync('audit/reports/lab103-targeted-history-modality.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB103_HISTORY_TARGETED',JSON.stringify({before,after}));
