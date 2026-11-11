// LAB118: exact historical one-call Gemini response, NO provider calls.
// Incomplete variants are measured, not retried and not silently renumbered.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {inspectPartialGeminiReplyV118}
 from '../src/lib/studyClaimLedgerV118.js';
const file=process.argv[2]||'audit/reports/lab118-one-real-claim-evidence.json';
const saved=JSON.parse(readFileSync(file,'utf8'));
assert.equal(saved.lab,'LAB118');
assert.equal(saved.modelCalls,1);
assert.ok(saved.modelReply?.units?.length===2);
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const sources=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSourceTiersV116(sources);
const result=inspectPartialGeminiReplyV118(plan,saved.modelReply);
assert.equal(result.providerRetriesMadeByInspector,0);
assert.equal(result.sourceEvidence.geminiCalls,0);
assert.equal(result.allEditCountsValid,false);
assert.ok(result.counts.every(c=>c.missingOrUnalignedEdits>0));
assert.ok(result.sourceEvidence.units.every(unit=>['50','summary'].every(level=>
 unit.levels[level].claims.every(c=>c.quoteIsSubstringOfActualOutput!==false))));
const report={lab:'LAB118',mode:'EXACT_PROVIDER_REPLY_OFFLINE_REPLAY',
 originRun:42953808440,providerCallsInReplay:0,providerCallsInOriginal:1,
 originalModelCallElapsedMs:saved.elapsedMs,
 expectedAndActualEdits:result.counts,
 totalSourceClaims:result.sourceEvidence.totalSourceClaims,
 safety:result.sourceEvidence.units.map(unit=>({
  page:unit.id,
  level50:{
   actualReduction:unit.levels['50'].actualReduction,
   numericInBand:unit.levels['50'].numericInBand,
   missingClaims:unit.levels['50'].missingCount,
   passedPreliminaryGuard:unit.levels['50'].preliminaryPass,
   note:'Quotes extracted from actual macro text, not trusted model claims'
  },
  summary:{
   actualReduction:unit.levels.summary.actualReduction,
   numericInBand:unit.levels.summary.numericInBand,
   missingClaims:unit.levels.summary.missingCount,
   passedPreliminaryGuard:unit.levels.summary.preliminaryPass
  }
 })),
 totalClaimWarnings:result.sourceEvidence.totalUnsupported,
 refusedFalseEvidence:true,retainedOriginalForUnalignedEdits:true,
 providerRetriesAdded:0,approvedForApp:false,semanticCertified:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab118-real-offline-replay.json',
 JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
