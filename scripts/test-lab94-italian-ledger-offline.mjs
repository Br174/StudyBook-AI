// MotorLab LAB94: verify Italian descriptions map exactly to 64 internal fact IDs.
// No provider calls. Internal IDs are never passed into generative instructions.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const ledger=JSON.parse(readFileSync('audit/test-fixtures/lab93-atomic-fact-ledger.json','utf8'));
const italian=JSON.parse(readFileSync('audit/test-fixtures/lab94-facts-italiano.json','utf8')).sources;
let count=0;const errors=[];
for(const [source,groups] of Object.entries(ledger.sources)){
 for(const [i,group] of groups.entries())for(const rule of [...group.core,...group.support]){
  count++;
  const phrase=italian[source]?.[rule.id];
  if(!phrase||typeof phrase!=='string'||phrase.length<12)errors.push({source,concept:i+1,id:rule.id,problem:'missing/short Italian fact'});
  if(phrase?.includes('_'))errors.push({source,id:rule.id,problem:'internal ID visible'});
  if(/\b(?:the|only if|from|testable|repeatable|oxygen|deadline|filing|right to|day|night)\b/iu.test(phrase||''))errors.push({source,id:rule.id,problem:'English phrase'});
 }
}
const output={study:'LAB94 italian atomic facts for one-pass StudyBook prompts',totalValidated:count,failed:errors.length,
 internalFactCodesAppearInPrompt:false,language:'it',errors,
 warning:'This test checks phrase language and completeness, not semantic entailment nor Gemini quality.'};
mkdirSync('audit/reports',{recursive:true});writeFileSync('audit/reports/lab94-italian-fact-ledger-offline.json',JSON.stringify(output,null,2)+'\n');
console.log('LAB94_ITALIAN_LEDGER',JSON.stringify({total:count,errors:errors.length}));
if(errors.length||count!==64)process.exitCode=1;
