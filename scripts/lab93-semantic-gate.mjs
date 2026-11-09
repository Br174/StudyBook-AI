// MotorLab StudyBook LAB93: precomputed atomic facts from first reading, never regenerated per reduction.
// Regex matches are preliminary alarms only: they are not proof of entailment or expert fact checking.
import {readFileSync} from 'node:fs';
export const LEDGER=JSON.parse(readFileSync('audit/test-fixtures/lab93-atomic-fact-ledger.json','utf8'));
export const FIXTURES=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources;
export function sourceById(id){return FIXTURES.find(s=>s.id===id)}
export function requiredFacts(source,level){
 const l=LEDGER.sources[source.id];
 if(!l||l.length!==source.concepts.length)throw Error('ledger/source mismatch');
 return l.map((entry,i)=>({
  id:'C'+(i+1),
  core:entry.core,
  support:level<=20?entry.support:[],
  supportNotRequired:level>20?entry.support.map(x=>x.id):[]
 }));
}
export function checkFactCoverage(source,level,sections){
 const rubric=requiredFacts(source,level);
 if(!Array.isArray(sections)||sections.length!==source.concepts.length) return {valid:false,missing:[{issue:'wrong section count'}]};
 const missing=[],details=[];let count=0,passed=0;
 for(let i=0;i<rubric.length;i++){
  if(sections[i]?.id!==rubric[i].id||typeof sections[i]?.text!=='string')return{valid:false,missing:[{issue:'wrong id / text',i}]};
  const sourceText=source.concepts[i];
  const generated=sections[i].text.normalize('NFC');
  for(const item of [...rubric[i].core,...rubric[i].support]){
   const re=new RegExp(item.re,'iu');
   const sourcePass=re.test(sourceText);
   if(!sourcePass)throw Error('broken semantic rubric: not found in source '+source.id+' '+rubric[i].id+' '+item.id);
   const found=re.test(generated);
   count++;if(found)passed++;
   if(!found)missing.push({concept:rubric[i].id,fact:item.id,type:rubric[i].core.includes(item)?'core':'support',sourceEvidence:sourceText.slice(0,180)});
  }
  details.push({concept:rubric[i].id,wordCount:generated.trim().split(/\s+/u).length,
   content:generated});
 }
 return{valid:true,required:count,matched:passed,missingCount:missing.length,missing,details,
  note:'A regex match is NOT proof that a proposition has the correct polarity, causality or conditions. Manual QA mandatory.'};
}
