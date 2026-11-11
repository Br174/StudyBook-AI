// Zero-quota replay of the EXACT old Gemini 3.5 answer.
// Never alters user's installed app. Never automatically applies to books.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSemanticLadderV119} from '../src/lib/studySemanticLadderV119.js';
import {restoreSourceCarriersV119}
 from '../src/lib/studySourceCarrierRestoreV119.js';
const old=JSON.parse(readFileSync('audit/reports/lab119-one-real-response.json','utf8'));
if(old.lab!=='LAB119'||old.requests!==1||!old.rawReply)throw Error('OLD_REAL_REPLY_REQUIRED');
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const samples=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',pageStart:i+1,pageEnd:i+1,source:x.text}));
const plan=prepareSemanticLadderV119(samples);
const result=restoreSourceCarriersV119(plan,old.rawReply);
assert.equal(result.modelCalls,0);
assert.equal(result.approvedForApp,false);
assert.ok(result.changes.length>0,'No supported semantic source restoration found');
assert.ok(result.changes.some(c=>c.reasons.includes('INFLUENCE_TO_CAUSE')),
 'Luna and Sun must not be upgraded from influence to causation');
assert.ok(!result.restoredReply.units[0].core.includes('Sole causano le maree'),
 'The original source-backed influence must replace the false cause');
assert.ok(result.restoredReply.units[0].core.includes('La Luna influisce sulle maree insieme al Sole.'),
 'Restore literal original scientific wording');
const report={lab:'LAB119D',sourceRun:42985330555,
 newGeminiCalls:0,restoredClaims:result.changes,
 unresolvedAmbiguities:result.ambiguous,
 originalAndRestoredNumerics:result.comparisons,
 semanticCertified:false,approvedForApp:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab119d-real-carrier-restore.json',
 JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({lab:report.lab,additionalGeminiCalls:0,
 protectedOriginalRestorations:report.restoredClaims.length,
 reasons:report.restoredClaims.map(c=>c.reasons),
 unsafelyAmbiguous:report.unresolvedAmbiguities.length,
 results:report.originalAndRestoredNumerics,
 approvedForApp:false},null,2));
