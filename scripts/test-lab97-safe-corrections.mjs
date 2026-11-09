// MotorLab LAB97 deterministic orthographic repair trial, audited on real Gemini outputs.
// Only two safe exact apostrophe patterns are automatically fixed. Semantics are only flagged.
// The research fixture and any production book are NEVER changed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {evaluateLean} from './lab96-eval.mjs';
import {sourceById} from './lab93-semantic-gate.mjs';
const raw=JSON.parse(readFileSync('audit/reports/lab97-level-specific-real.json','utf8'));
const replacements=[
 {from:/\bl alunno\b/giu,to:"l'alunno",name:"apostrophe_l_alunno"},
 {from:/\bl iscritto\b/giu,to:"l'iscritto",name:"apostrophe_l_iscritto"}
];
const letters=t=>(String(t).normalize('NFC').match(/\p{L}/gu)||[]).length;
function patch(input){
 let text=input;const changed=[];
 for(const rule of replacements){
  const before=text;
  text=text.replace(rule.from,rule.to);
  if(text!==before)changed.push(rule.name);
 }
 return{text,changed};
}
let seed=973174,randomChecks=0;
const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const problems=[];
for(let i=0;i<15000;i++){
 const n=Math.floor(r()*14);
 const parts=Array.from({length:n},(_,j)=>j%3===0?'l alunno':j%3===1?'l iscritto':'una regola');
 const original=parts.join(' '),changed=patch(original),repeat=patch(changed.text);
 if(letters(original)!==letters(changed.text))problems.push({i,issue:'letter count modified'});
 if(changed.text!==repeat.text)problems.push({i,issue:'not idempotent'});
 if(/l alunno|l iscritto/.test(changed.text))problems.push({i,issue:'missed safe repair'});
 randomChecks++;
 if(problems.length>8)break;
}
const examples=raw.results.filter(x=>x.valid).map(x=>{
 const src=sourceById(x.source);
 const before=x.metrics.text,corrected=patch(before);
 const m=evaluateLean(src,x.level,corrected.text);
 const signals=[];
 if(x.source==='medicina'&&/pu[oò]\s+aumentare/iu.test(src.concepts.join(' '))&&
    /\b(?:sale|aumenta)\s+sotto\s+sforzo/iu.test(before)&&!/\bpu[oò]\s+(?:aumentare|salire)/iu.test(before))
  signals.push('MODALITY_CHANGED_FROM_POSSIBILITY_TO_CERTAINTY');
 if(x.source==='concetto_sbilanciato'&&/fatti\s+documentati/iu.test(src.concepts.join(' '))&&/fatti\s+dimostrati/iu.test(before))
  signals.push('DOCUMENTED_NOT_SAME_AS_PROVEN');
 if(x.source==='scienze'&&/non\s+avvengono\s+a\s+ogni\s+lunazione/iu.test(src.concepts.join(' '))&&/esclude\s+ogni\s+lunazione/iu.test(before))
  signals.push('ECLIPSES_LUNATION_CAUSALITY_AMBIGUITY');
 if(x.source==='procedura'&&/\bregola interna\s+numero\s+12\b/iu.test(src.concepts.join(' '))&&/\bnorma\s+12\b/iu.test(before))
  signals.push('INTERNAL_RULE_CHANGED_TO_NORMA');
 if(letters(before)!==letters(corrected.text))problems.push({source:x.source,issue:'letters changed'});
 if(!m.valid||m.grid.rows>x.metrics.grid.rows||m.reduction!==x.metrics.reduction)problems.push({source:x.source,issue:'geometry or ratio changed'});
 return{source:x.source,level:x.level,originalLetters:letters(before),correctedLetters:letters(corrected.text),
  correctionNames:corrected.changed,
  originalLines:x.metrics.grid.rows,correctedLines:m.grid.rows,
  percentUnchanged:m.reduction===x.metrics.reduction,
  semanticRiskFlags:signals,
  correctedPreview:corrected.changed.length?corrected.text:null,
  canPublishWithoutSemanticReview:false};
});
const summary={simulatedSamples:randomChecks,realSamples:examples.length,
 realWithApostropheFix:examples.filter(x=>x.correctionNames.length).length,
 semanticRiskFlags:examples.reduce((n,x)=>n+x.semanticRiskFlags.length,0),
 allLettersUnchanged:examples.every(x=>x.originalLetters===x.correctedLetters),
 arithmeticOrFormattingFailures:problems.length};
const report={study:'LAB97 limited deterministic postprocessing and preservation of modal meaning',
 date:new Date().toISOString(),
 method:'Whitelist punctuation repairs; never change source letters. Review-only flags for possibility, evidence strength and negation. No provider calls.',
 caution:'These whitelisted fixes only work on the present examples; never auto-generalize Italian apostrophes with broad regex. Semantic risk flags cannot be auto-repaired with punctuation alone.',
 summary,examples,problems};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab97-safe-fixes-and-semantic-risks.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB97_SAFE_FIXES',JSON.stringify(summary));
if(problems.length||summary.realWithApostropheFix!==1||summary.semanticRiskFlags<3)process.exitCode=1;
