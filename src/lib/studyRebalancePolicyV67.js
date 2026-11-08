// LAB67: one shared numerical policy, distinct from the non-blocking
// LAB66 quality stage. Targets describe total alphabetical letters of the
// edition, never a rigid per-paragraph trimming rule.
import {studyLetters,percentReduced} from './studyPillarV38.js';
export const STUDY_LEVELS_V67=['summary','50','40','30','20','10'];
export const STUDY_TARGET_V67=Object.freeze({
 summary:{target:60,min:55,max:70},
 '50':{target:50,min:45,max:55},
 '40':{target:40,min:35,max:45},
 '30':{target:30,min:25,max:35},
 '20':{target:20,min:15,max:25},
 '10':{target:10,min:5,max:15}
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
 // An improvement is measured, not guessed. Keep prior texts intact when a
 // candidate is worse. An out-of-band candidate can still be an improvement,
 // but the quality report continues to flag it as imprecise.
 return candidate?.measured!==null&&candidate?.missing===0&&
  Number.isFinite(candidate?.distance)&&
  (current?.measured===null||candidate.distance+1.5<current.distance);
}
