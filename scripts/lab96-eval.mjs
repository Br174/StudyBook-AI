// StudyBook/MotorLab LAB96: shared evaluation of a single Italian text per page.
// Precomputed atomic fact ledger is used ONLY AFTER generation; it is NEVER sent to Gemini.
import {budget,letters,wrap,WIDTH,AVG} from './lab92-stop-complete-engine.mjs';
import {requiredFacts} from './lab93-semantic-gate.mjs';
export function evaluateLean(source,level,text){
 const b=budget(source,level);
 if(typeof text!=='string'||!text.trim())return {valid:false,reason:'missing text',budget:b};
 const normalized=text.normalize('NFC').replace(/\s+/gu,' ').trim();
 const geometry=wrap(normalized),alphabetic=letters(normalized);
 const percent=+((1-alphabetic/b.originalLetters)*100).toFixed(2);
 const band=b.short||alphabetic>=b.band.low&&alphabetic<=b.band.high;
 const grid=geometry.lines.length<=b.targetCap&&!geometry.overlong;
 const factRules=requiredFacts(source,level).flatMap(c=>[
  ...c.core.map(r=>({...r,importance:'core',concept:c.id})),
  ...c.support.map(r=>({...r,importance:'support',concept:c.id}))
 ]);
 const missing=factRules.filter(rule=>!new RegExp(rule.re,'iu').test(normalized))
  .map(r=>({fact:r.id,importance:r.importance,concept:r.concept}));
 const spellingSignals=[];
 if(/\bpoichè\b/iu.test(normalized))spellingSignals.push('poichè should be poiché');
 if(/\b(?:l|all|dall)\s+(?:apparato|ossigeno|emoglobina|asse|inspirazione|espirazione|aria)\b/iu.test(normalized))spellingSignals.push('apostrophe broken');
 if(/\b(?:Mareee|di e la notte)\b/iu.test(normalized))spellingSignals.push('malformed phrase');
 if(/\p{L}-\s*[\r\n]\s*\p{L}/u.test(text))spellingSignals.push('hyphenated broken word');
 const lastLine=geometry.lines.at(-1)||'';
 const usedFractional=geometry.lines.length?geometry.lines.length-1+[...lastLine].length/WIDTH:0;
 const smallUnder=!b.short&&alphabetic<b.band.low&&b.band.low-alphabetic<=Math.ceil(AVG.letters);
 return{valid:true,originalLetters:b.originalLetters,targetLetters:b.targetLetters,
  actualLetters:alphabetic,reduction:percent,band:{...b.band,passes:band},
  grid:{rows:geometry.lines.length,maxRows:b.targetCap,passes:grid,maxActualWidth:Math.max(0,...geometry.lines.map(l=>[...l].length)),
   lastRowCells:[...lastLine].length,fractionalEquivalent:+usedFractional.toFixed(3)},
  completeMathPass:band&&grid,short:b.short,
  smallShortfallReview:smallUnder,
  facts:{total:factRules.length,matched:factRules.length-missing.length,missing},
  spellingSignals,semanticallyCertified:false,
  noPaddingVerified:false,
  text:normalized,
  words:(normalized.match(/\S+/gu)||[]).length};
}
