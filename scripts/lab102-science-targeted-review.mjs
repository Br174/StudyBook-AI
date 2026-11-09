// MotorLab LAB102: two independently reviewed targeted science edits.
// This is an isolated audit copy, never a production change or automatic
// semantic certificate. Complete raw Gemini responses remain intact.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {sourceById} from './lab93-semantic-gate.mjs';
import {budget,evaluate} from './lab92-stop-complete-engine.mjs';
import {relationshipGuard} from './lab99-relational-guard.mjs';
const science=sourceById('scienze');
const generated=JSON.parse(readFileSync('audit/reports/lab102-real-six-reductions.json','utf8'));
const actual=generated.pages.find(p=>p.source==='scienze');
assert(actual&&actual.versions.length===6,'Six Gemini versions required');
const replacements={
  65:[
   'La Terra ruota: giorno e notte.',
   'Orbita attorno al Sole in un anno. Stagioni: asse inclinato, non distanza.',
   'Luna e Sole causano maree. Eclissi: allineamento, non ogni lunazione.',
   'Metodo: ipotesi verificabili, osservazioni ripetibili; un risultato isolato non basta. Distinguere moti e cause.'
  ],
  30:[
   null,null,null,
   'Metodo scientifico: ipotesi verificabili e osservazioni ripetibili; un solo risultato non basta. Distinguere movimenti e cause delle variazioni.'
  ]
};
const results=[];
for(const level of [65,30]){
 const origin=actual.versions.find(v=>v.level===level);
 assert(origin.providerOk,'Gemini version absent '+level);
 const current=origin.analysis.sections;
 const changed=replacements[level];
 const edited=current.map((s,i)=>({id:s.id,text:changed[i]??s.text}));
 const oldEval=evaluate(science,budget(science,level),current);
 const newEval=evaluate(science,budget(science,level),edited);
 const oldGuard=relationshipGuard('scienze',science.concepts.join(' '),current.map(x=>x.text).join(' '));
 const newGuard=relationshipGuard('scienze',science.concepts.join(' '),edited.map(x=>x.text).join(' '));
 const oldAlertIds=new Set(oldGuard.alerts.map(x=>x.id));
 const newlyMissing=newGuard.alerts.map(x=>x.id).filter(x=>!oldAlertIds.has(x));
 const pass=newEval.strictBand&&newEval.fitsTarget&&newEval.wordIntegrity&&!newlyMissing.length&&newGuard.alerts.length===0;
 results.push({
  level,editType:level===30?'replace_only_C4_incomplete_sentence':'compact_only_four_concept_sentences_of_failed_summary',
  original:current,proposal:edited,
  before:{letters:oldEval.letters,reduction:oldEval.reduction,rows:oldEval.rows,cap:oldEval.targetCap,alerts:[...oldAlertIds]},
  after:{letters:newEval.letters,reduction:newEval.reduction,rows:newEval.rows,cap:newEval.targetCap,
   withinLetterBand:newEval.strictBand,gridFits:newEval.fitsTarget,
   relationAlerts:newGuard.alerts.map(x=>x.id),virtualRows:newEval.virtualRows},
  noNewRelationAlerts:newlyMissing.length===0,numericGeometricPass:pass,
  semanticCertified:false,approvedForApp:false,
  verdict:pass?'MATHEMATICALLY_CONFORMING_NEEDS_EDITORIAL_REVIEW':'REJECT_AND_KEEP_GEMINI_ORIGINAL'
 });
 assert(pass,'Targeted patch failed mathematical, geometric, or relation guard: '+level);
}
const report={date:new Date().toISOString(),scope:'LAB102 isolated science samples, first Gemini originals untouched',
 originalEvidence:'audit/reports/lab102-real-six-reductions.json',
 patches:results,semanticCertified:false,appApproval:false,
 limitations:'An independent human/expert must still validate meaning. Regex/lexical co-occurrence may approve false claims. Virtual 60-cell rows are not physical A4 layout.'};
const path='audit/reports/lab102-science-targeted-review.json';
writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log('LAB102_TARGETED',JSON.stringify(results.map(x=>({level:x.level,pass:x.numericGeometricPass,from:x.before,to:{letters:x.after.letters,reduction:x.after.reduction,rows:x.after.rows,alerts:x.after.relationAlerts}}))));
