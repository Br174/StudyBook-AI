// LAB67: one shared numerical policy, distinct from the non-blocking
// LAB66 quality stage. Targets describe total alphabetical letters of the
// edition, never a rigid per-paragraph trimming rule.
import {studyLetters,percentReduced} from './studyPillarV38.js';
export const STUDY_LEVELS_V67=['summary','50','40','30','20','10'];
export const STUDY_TARGET_V67=Object.freeze({
 summary:{target:60,min:55,max:65},
 '50':{target:50,min:48,max:52},
 '40':{target:40,min:38,max:42},
 '30':{target:30,min:28,max:32},
 '20':{target:20,min:18,max:22},
 '10':{target:10,min:8,max:12}
});
export function editionReductionV67(units,drafts,level){
 const original=units.reduce((n,u)=>n+studyLetters(u.source),0);
 let output=0,missing=0;
 for(const u of units){
  const text=drafts?.[u.ci]?.[u.pi]?.editions?.[level];
  if(typeof text!=='string'||!text.trim()){missing++;continue;}
  output+=studyLetters(text);
 }
 const measured=missing?null:percentReduced(original,output);
 const policy=STUDY_TARGET_V67[level];
 if(!policy)throw Error('Unknown StudyBook edition '+level);
 return {level,originalLetters:original,outputLetters:output,
  measured,missing,goal:policy.target,
  min:policy.min,max:policy.max,within:
   measured!==null&&measured>=policy.min&&measured<=policy.max,
  distance:measured===null?Infinity:Math.abs(measured-policy.target)};
}
export function planRebalanceV67(units,drafts){
 return STUDY_LEVELS_V67.map(level=>editionReductionV67(units,drafts,level))
  .filter(e=>!e.within);
}
export function betterReductionV67(current,candidate){
 // LAB69: user targets are HARD acceptance ranges, not suggestions.
 // Improving 10% from 72% to 40% still MUST be rejected.
 // An already-conforming saved version is never replaced by a less precise one.
 return candidate?.within===true&&candidate?.measured!==null&&candidate?.missing===0&&
  Number.isFinite(candidate?.distance)&&
  (current?.within!==true||candidate.distance+0.2<current.distance);
}
