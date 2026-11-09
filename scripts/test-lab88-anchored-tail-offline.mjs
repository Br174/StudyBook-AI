// MotorLab StudyBook LAB88: local-only rehearsal of the user's anchored-final-lines proposal.
// No Gemini provider calls, no production changes. Uses prior LAB86 real outputs.
// This does not certify semantic correctness; intact prefixes require a distinct QA gate.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const IN='audit/reports/lab86-six-levels-real-gemini.json';
const OUT='audit/reports/lab88-anchored-tail-offline.json';
const data=JSON.parse(readFileSync(IN,'utf8'));
const WIDTH=60;
function splitSentences(t){
 const s=String(t||'').replace(/\s+/gu,' ').trim();
 return (s.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/gu)||[]).map(x=>x.trim()).filter(Boolean);
}
function wrap(text,width=WIDTH){
 const words=String(text||'').replace(/\s+/gu,' ').trim().split(' ').filter(Boolean);
 const lines=[];let line='';
 for(const word of words){
  if(!line){line=word;continue}
  if((line+' '+word).length>width){lines.push(line);line=word}else line+=' '+word;
 }
 if(line)lines.push(line);
 return lines;
}
function rowsFor(t){return wrap(t).length}
const samples=[];
for(const rec of data.records){
 const maxRows=rec.geometryCap;
 // Adaptive reservation: a third of the grid, but no more than 4 rows.
 const tailReserved=Math.min(4,Math.max(2,Math.ceil(maxRows/3)));
 const prefixMaxRows=maxRows-tailReserved;
 const sentences=splitSentences(rec.text);
 const prefix=[];
 for(const s of sentences){
  const next=[...prefix,s].join(' ');
  if(rowsFor(next)<=prefixMaxRows)prefix.push(s);
  else break;
 }
 const suffix=sentences.slice(prefix.length);
 const preserved=prefix.join(' ');
 const tail=suffix.join(' ');
 const oldFullRows=rowsFor(rec.text);
 const freelyRepacked=rowsFor(preserved+(tail?' '+tail:''));
 const lastLineLen=wrap(preserved).at(-1)?.length||0;
 const independentTailRows=rowsFor(tail);
 const mayUseRemainderInPrefixLastLine=lastLineLen>0&&lastLineLen<WIDTH;
 samples.push({
  source:rec.source,level:rec.level,maxRows,tailReserved,prefixMaxRows,
  totalSentences:sentences.length,finishedPrefixSentences:prefix.length,remainingSentences:suffix.length,
  prefixRows:rowsFor(preserved),independentTailRows,
  tailFitsIfForcedNewLine:independentTailRows<=tailReserved,
  oldFullRows,oldFits:oldFullRows<=maxRows,
  repackedWithoutUnnecessaryNewLineRows:freelyRepacked,
  repackedFits:freelyRepacked<=maxRows,
  mayUseRemainderInPrefixLastLine,
  lastPrefixLineUsedPositions:lastLineLen,
  notes:[
   'The prefix is frozen only after independently proving it correct; the candidate is not automatically trusted.',
   'No newlines inserted between complete sentences unless physical wrap requires them.',
   'Extra content must not be cut. If a remaining concept cannot fit, keep original and escalate bounded targeted revision.'
  ]
 });
}
const aggregate={
 samples:samples.length,withSentenceBoundaries:samples.filter(x=>x.finishedPrefixSentences>0).length,
 oldAlreadyFits:samples.filter(x=>x.oldFits).length,
 tailFitsWithForcedNewLine:samples.filter(x=>x.tailFitsIfForcedNewLine).length,
 fullTextFitsWithoutForcedNewLine:samples.filter(x=>x.repackedFits).length,
 overflowsToRepair:samples.filter(x=>!x.oldFits).length,
 verifiedSafeFrozenPrefixes:0
};
const report={
 experiment:'LAB88 preliminary offline sentence-anchored reservation feasibility',
 date:new Date().toISOString(),
 provenance:IN,
 method:'sentence-boundary prefix, reserve min(4,max(2,ceil(maxRows/3))) rows for final concepts; word-wrap at 60 monospace cells; do NOT force newline after period',
 warning:'This is NOT a new Gemini repair test. It does not prove that remaining concepts can be compressed into remaining cells without loss. Sentence splitting by punctuation is an approximate prototype, not an article-level or discourse parser.',
 safeguards:['Preserve only previously semantically verified complete sentences','Track required source concepts and assign missing ones to tail','Do not change typeface, physical page width, or line cap','Refuse overflow, refusal is not automatic truncation','Avoid rewriting already correct prefix, but rollback if missing concepts preclude tail-only correction','Check factual accuracy, all figures, technical terminology and negative constraints','If no feasible tail exists: keep original and flag non-compressibility'],
 aggregate,samples};
mkdirSync('audit/reports',{recursive:true});writeFileSync(OUT,JSON.stringify(report,null,2)+'\n');
console.log('LAB88_OFFLINE',JSON.stringify(aggregate));
if(samples.length!==9||aggregate.overflowsToRepair!==2)process.exitCode=1;
