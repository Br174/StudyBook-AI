// LAB65: mechanical-copy detection for all six study editions.
// A similarity warning NEVER replaces fidelity or semantic certification.
import {studyLetters} from './studyPillarV38.js';
const THRESHOLDS={summary:.64,'50':.70,'40':.75,'30':.80,'20':.84,'10':.88};
const terms=t=>String(t||'').toLocaleLowerCase('it-IT')
 .match(/[\p{L}\p{N}]+/gu)||[];
const shingles=(arr,n)=>arr.length<n?[]:Array.from(
 {length:arr.length-n+1},(_,i)=>arr.slice(i,i+n).join(' '));
export function rewriteQualityV65(source,draft,level){
 const input=terms(source),output=terms(draft);
 const srcLetters=studyLetters(source),outLetters=studyLetters(draft);
 const ratio=srcLetters?outLetters/srcLetters:null;
 const fiveSource=new Set(shingles(input,5));
 const fiveOutput=shingles(output,5);
 const copied=fiveOutput.length?
  fiveOutput.filter(x=>fiveSource.has(x)).length/fiveOutput.length:0;
 const unique=new Set(input).size;
 // Short legal clauses, definitions and artificial repeated-token tests
 // cannot be safely assessed through lexical overlap alone.
 const evaluable=input.length>=32&&output.length>=18&&unique>=10;
 const threshold=THRESHOLDS[level]??THRESHOLDS.summary;
 const needsRewrite=evaluable&&copied>=threshold;
 return {level,evaluable,needsRewrite,
  copiedFiveGramRatio:Math.round(copied*10000)/10000,
  retainedLetterRatio:ratio,sourceWordCount:input.length,
  draftWordCount:output.length,uniqueSourceWords:unique,
  threshold,reason:needsRewrite?'mechanical-copy-v65':null};
}
