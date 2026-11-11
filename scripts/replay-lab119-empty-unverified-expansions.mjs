// LAB119B: read ONLY the previously saved real Gemini answer.
// Remove unsupported self-descriptive filler, WITHOUT calling provider or
// inventing substitute sentences. Report true 6-level compliance afterward.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {prepareSemanticLadderV119,composeSemanticLadderV119}
 from '../src/lib/studySemanticLadderV119.js';
const saved=JSON.parse(readFileSync('audit/reports/lab119-one-real-response.json','utf8'));
assert.equal(saved.lab,'LAB119');
assert.equal(saved.requests,1);
assert.equal(saved.source,'PUBLIC_SYNTHETIC_TWO_PAGES');
assert.ok(Array.isArray(saved.rawReply?.units));
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const units=fixture.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',source:x.text,pageStart:i+1,pageEnd:i+1}));
const plan=prepareSemanticLadderV119(units);
const initial=composeSemanticLadderV119(plan,saved.rawReply);
const raw=structuredClone(saved.rawReply);
const originalFields=raw.units.map(row=>({...row}));
const stripped=[];
for(let i=0;i<raw.units.length;i++){
 const diagnostics=initial.quality['10'].meaningDiagnostics[i];
 for(const d of diagnostics.invalidGeneratedFields){
  if(d.field==='core')throw Error('UNSUPPORTED_CORE_REQUIRES_REVIEW');
  if(!d.field.startsWith('extra'))throw Error('UNKNOWN_FIELD');
  stripped.push({unit:raw.units[i].id,field:d.field,reason:d.reason});
  raw.units[i][d.field]='';
 }
}
assert.equal(stripped.length,2,'Two sourced model filler fields must be caught');
const cleaned=composeSemanticLadderV119(plan,raw);
const changes=[];
for(const level of ['summary','50','40','30','20','10']){
 const before=initial.quality[level],after=cleaned.quality[level];
 changes.push({level,beforeReduction:before.achievedReduction,
  afterReduction:after.achievedReduction,
  beforeNumericRowsPass:before.numericAndRowsPass,
  afterNumericRowsPass:after.numericAndRowsPass,
  afterPassingPages:after.compliantPages,of:after.pageCount,
  afterPreliminarySafety:after.strictPreliminarySafe,
  missingGrowthUnits:after.missingGrowthUnits,
  metatextRemaining:after.meaningDiagnostics.reduce((n,x)=>
   n+x.invalidGeneratedFields.length,0)});
}
assert.equal(cleaned.allSixActuallyProgressive,false);
assert.equal(cleaned.allSixCompliantAndProgressive,false);
assert.equal(cleaned.approvedForApp,false);
assert.equal(cleaned.semanticCertified,false);
const report={lab:'LAB119B',sourceRun:42985330555,
 originalProviderRequests:1,replayProviderRequests:0,
 originalFieldsPreserved:originalFields.length===raw.units.length,
 stripped,results:changes,allSixQuantitative:
  Object.values(cleaned.quality).every(x=>x.numericAndRowsPass),
 allSixActuallyProgressive:cleaned.allSixActuallyProgressive,
 semanticCertified:false,approvedForApp:false};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab119b-real-no-filler-replay.json',
 JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
