// LAB73: single-owner, page-safe Gemini network recovery.
// Signed experimental update source: P0 defined-letter-counter fix, Scudo P1 preflight passed.
// These helpers NEVER call Gemini or modify a source/draft.
// Small books preserve LAB58's efficient large blocks. Dense books start with
// a safer bounded output envelope; measured transport faults split only at
// complete original page boundaries and never retry an identical failed block.
import {naturalBoundaryV51,bisectAtNaturalBoundaryV51,
 BULK_OUTPUT_TOKEN_CEILING} from './integralPlannerV51.js';

export const STUDY_NETWORK_SPLIT_LIMIT_V73=4;
const NETWORK_CODES_V73=new Set(['AI_PROVIDER_NETWORK','AI_CLIENT_NETWORK',
 'AI_PROVIDER_TIMEOUT','AI_TIMEOUT_OR_NETWORK']);
const minmax=(n,min,max)=>Math.min(max,Math.max(min,Math.round(Number(n)||0)));
export function isRecoverableNetworkV73(code){
 return NETWORK_CODES_V73.has(String(code||''));
}
export function initialStudyOutputLimitV73(units,previous=null){
 const saved=Number(previous?.providerBlockOutputLimitV73||
   previous?.diagnostics?.providerBlockOutputLimitV73);
 if(saved>=4800&&saved<=BULK_OUTPUT_TOKEN_CEILING)
  return Math.floor(saved);
 // P0 diagnosis: LAB72 first-pass ReferenceError, not proven oversized
 // network requests. Preserve the approved LAB58 large-block fast path.
 // Only shrink after an actual explicit network fault, not merely due to
 // 44 pages or 674 concepts. No extra calls for healthy books.
 return BULK_OUTPUT_TOKEN_CEILING;
}
export function minimumFullPageOutputV73(block,level){
 const ratio=level==='summary'?.44:1-Number(level)/100;
 let since=0,minRequired=0;
 for(let i=0;i<block.length;i++){
  if(!naturalBoundaryV51(block,i))continue;
  const slice=block.slice(since,i+1),chars=slice.reduce((n,u)=>n+u.source.length,0);
  minRequired=Math.max(minRequired,
   Math.ceil(chars*ratio/1.5)+slice.length*115+1800);
  since=i+1;
 }
 return minRequired;
}
export function safeNetworkSplitV73(block,level,{
 code,used=0,currentOutputLimit=BULK_OUTPUT_TOKEN_CEILING
}={}){
 if(!isRecoverableNetworkV73(code)||
    Number(used)>=STUDY_NETWORK_SPLIT_LIMIT_V73||
    !Array.isArray(block)||block.length<2)
  return null;
 const halves=bisectAtNaturalBoundaryV51(block);
 if(!halves)return null;
 const minPage=Math.max(minimumFullPageOutputV73(halves[0],level),
  minimumFullPageOutputV73(halves[1],level));
 if(minPage>BULK_OUTPUT_TOKEN_CEILING)return null;
 const nextOutputLimit=Math.max(minPage+256,
  minmax(Number(currentOutputLimit)*.72,4800,BULK_OUTPUT_TOKEN_CEILING));
 return {halves,nextOutputLimit:Math.min(BULK_OUTPUT_TOKEN_CEILING,
   Math.min(Number(currentOutputLimit)||BULK_OUTPUT_TOKEN_CEILING,nextOutputLimit)),
  strategy:'bisect-complete-source-pages-only',retrySameBlock:false};
}
