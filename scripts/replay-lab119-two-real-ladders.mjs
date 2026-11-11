// LAB119C offline REPLAY of two previously saved provider replies.
// 0 Gemini calls, no new book imports or Android builds.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {prepareSemanticLadderV119} from '../src/lib/studySemanticLadderV119.js';
import {rebalanceSemanticLadderV119} from '../src/lib/studyLadderRebalanceV119.js';
const f=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const source=f.sources.filter(x=>['scienze','procedura'].includes(x.id))
 .map((x,i)=>({id:i+':0',source:x.text,pageStart:i+1,pageEnd:i+1}));
const plan=prepareSemanticLadderV119(source);
const out={lab:'LAB119C',localRebalanceOnly:true,
 originalGeminiCalls:2,newGeminiCalls:0,
 source:'TWO_PUBLIC_SYNTHETIC_PAGES',runs:[],semanticCertified:false,
 approvedForApp:false};
for(const [label,filepath] of [
 ['Gemini3.5','/tmp/lab119-35/lab119-one-real-response.json'],
 ['Gemini3.1','/tmp/lab119-31/lab119-one-real-response-31.json']]){
 const raw=JSON.parse(readFileSync(filepath,'utf8'));
 if(raw.requests!==1||!Array.isArray(raw.rawReply?.units))
  throw Error('LAB119C_WRONG_REAL_REPLY_'+label);
 const result=rebalanceSemanticLadderV119(plan,raw.rawReply);
 const levels=Object.entries(result.quality).map(([level,q])=>({
  level,achievedReduction:q.reduction,
  pagesPassingLetters:q.pagesPassed,pagesTotal:q.pagesTotal,
  numericAndRows:q.numericAndRowsPass,
  preliminarySemanticWarnings:q.preliminarySemanticWarnings
 }));
 out.runs.push({model:label,
  originalNumericLevelPasses:raw.numericLevelPasses,
  recalibratedNumericLevelPasses:levels.filter(x=>x.numericAndRows).length,
  rejectedCandidates:result.candidateStatistics,
  missingFactsLikely:result.missingFactsLikely,
  levels,providerRequestsMade:result.providerRequestsMade,
  semanticCertified:false,approvedForApp:false});
}
out.anyRealNumericalImprovement=out.runs.some(x=>
 x.recalibratedNumericLevelPasses>x.originalNumericLevelPasses);
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab119-offline-rebalance-two-real-replies.json',
 JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({lab:out.lab,additionalGeminiCalls:0,
 anyNumericalImprovement:out.anyRealNumericalImprovement,
 results:out.runs.map(x=>({model:x.model,before:x.originalNumericLevelPasses,
  after:x.recalibratedNumericLevelPasses,
  rejected:x.rejectedCandidates,
  semanticUnverified:x.missingFactsLikely,levels:x.levels.map(q=>({
   level:q.level,reduction:q.achievedReduction,
   pagePass:q.pagesPassingLetters,of:q.pagesTotal,
   numericAndRows:q.numericAndRows
  }))})),approvedForApp:false},null,2));
if(!out.runs.every(x=>x.providerRequestsMade===0))process.exitCode=2;
