// LAB45: only mechanical punctuation can be repaired locally.
// Re-run every existing semantic/pillar audit after this transformation.
import {checkSentence} from './studyQualityGuard.js';
import {studyLetters} from './studyPillarV38.js';
export function restoreMissingTerminalPunctuation(text){
  const source=String(text||'').trim();
  if(source.length<35 || /[.!?;:»”"')\]]$/u.test(source))return source;
  const before=checkSentence(source);
  if(!before.issues.includes('unterminated')||
      before.issues.some(issue=>issue!=='unterminated'))return source;
  const candidate=source+'.';
  if(!checkSentence(candidate).valid||studyLetters(source)!==studyLetters(candidate))return source;
  return candidate;
}
