// StudyBook AI LAB111: linear natural-page block planning for large books.
// No Gemini calls; exactly preserves LAB51 token/char estimates and boundaries.
// Does NOT split a paragraph, physical source page, or natural page range.
import {assignBudgetsV51,naturalBoundaryV51,safeNaturalInputLimitV55,
 BULK_INPUT_TOKEN_CEILING,BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';

import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';

const MAX_REQUEST_CHARS=1200000;
const LEVELS=new Set(['summary','50','40','30','20','10']);
export const STUDY_LINEAR_BLOCK_PLANNER_V111='lab111-linear-natural-boundary-planner-v1';

export function planNaturalBlocksLinearV111(units,level,{
 maxInputTokens=BULK_INPUT_TOKEN_CEILING,
 maxOutputTokens=BULK_OUTPUT_TOKEN_CEILING
}={}){
 const requested=String(level);
 if(!LEVELS.has(requested))throw Error('Livello sconosciuto.');
 const bounded=assignBudgetsV51(units,requested);
 const effectiveInputTokens=safeNaturalInputLimitV55(bounded,requested,maxInputTokens);
 const outputRatio=1-STUDY_TARGET_V67[requested].target/100;
 const blocks=[];
 let start=0;
 while(start<bounded.length){
  let chars=0,count=0,lastSafe=-1;
  for(let i=start;i<bounded.length;i++){
   const nextChars=chars+bounded[i].source.length,nextCount=count+1;
   const input=Math.ceil(nextChars/2)+nextCount*120+1200;
   const output=Math.ceil(nextChars*outputRatio/1.5)+nextCount*115+1800;
   if(input>effectiveInputTokens||output>maxOutputTokens||
      nextChars>MAX_REQUEST_CHARS)break;
   chars=nextChars;count=nextCount;
   if(naturalBoundaryV51(bounded,i))lastSafe=i+1;
  }
  if(lastSafe<=start)throw Object.assign(new Error(
   'Una pagina integra supera la capacità sicura, non è possibile tagliarla a metà.'
  ),{code:'NATURAL_BOUNDARY_REQUIRED'});
  blocks.push(bounded.slice(start,lastSafe));
  start=lastSafe;
 }
 return blocks;
}
