import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';
// LAB51: use only complete source paragraphs and natural chapter/page boundaries.
// Text-only planning. The immutable PDF and scanner photographs are never mutated.
import {allocateExactLetterBudgets,studyLetters} from './studyPillarV38.js';

export const BULK_INPUT_TOKEN_CEILING=900000;
export const BULK_OUTPUT_TOKEN_CEILING=50000;
const MAX_REQUEST_CHARS=1200000;
const LEVELS=new Set(['summary','50','40','30','20','10']);
const numeric=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
const clean=v=>String(v??'').trim();

export function bookUnitsV51(book){
  const units=[];
  const chapters=book?.chapters||[];
  for(let ci=0;ci<chapters.length;ci++){
    const ch=chapters[ci];
    for(let pi=0;pi<(ch.paragraphs||[]).length;pi++){
      const p=ch.paragraphs[pi];
      const source=clean(p?.original);
      if(!source)throw Object.assign(new Error('Paragrafo originale vuoto: verifica il PDF prima di elaborare.'),{code:'SOURCE_EMPTY'});
      const start=numeric(p.sourcePageStart)||numeric(ch.pageStart);
      const end=numeric(p.sourcePageEnd)||numeric(ch.pageEnd)||start;
      if(!start||!end||end<start)throw Object.assign(new Error('Riferimento alla pagina originale non verificato.'),{code:'SOURCE_PAGE_UNCERTAIN'});
      units.push({id:ci+':'+pi,ci,pi,source,pageStart:start,pageEnd:end,
        chapterTitle:clean(ch.title),sectionTitle:clean(p.sourceSection)});
    }
  }
  if(!units.length)throw Object.assign(new Error('Nessun testo originale utilizzabile.'),{code:'SOURCE_EMPTY'});
  return units;
}
export function naturalBoundaryV51(units,i){
  if(i===units.length-1)return true;
  const a=units[i],b=units[i+1];
  // Never divide a source page midway or break a paragraph spanning pages.
  // A chapter change on the SAME physical page is not a safe cut.
  return a.pageEnd < b.pageStart;
}
function estimatedTokens(units,level){
  const letters=units.reduce((n,x)=>n+studyLetters(x.source),0);
  const chars=units.reduce((n,x)=>n+x.source.length,0);
  const ratio=1-STUDY_TARGET_V67[String(level)].target/100;
  // Deliberately conservative Italian/JSON estimate, including IDs and thinking.
  return {input:Math.ceil(chars/2)+units.length*120+1200,
    output:Math.ceil(chars*ratio/1.5)+units.length*115+1800,
    chars};
}
export function assignBudgetsV51(units,level){
  const sources=units.map(x=>x.source);
  // LAB72: Riassunto now targets 60% reduction under the canonical policy,
  // not the old legacy 50%-retention upper bound.
  const reduction=STUDY_TARGET_V67[String(level)].target;
  const caps=allocateExactLetterBudgets(sources,STUDY_TARGET_V67.summary.target);
  const targets=level==='summary'?caps:
    allocateExactLetterBudgets(sources,reduction);
  return units.map((u,i)=>({...u,targetLetters:level==='summary'?null:targets[i],
    summaryCapLetters:caps[i]}));
}
export function minimumCompletePageInputV55(units,level){
  // Recompute across the WHOLE book, not just the block that returned 503.
  // A later page can be larger than the block which triggered the cooldown.
  let start=0,minimum=0;
  for(let i=0;i<units.length;i++){
    if(!naturalBoundaryV51(units,i))continue;
    minimum=Math.max(minimum,estimatedTokens(units.slice(start,i+1),String(level)).input);
    start=i+1;
  }
  return minimum;
}
export function safeNaturalInputLimitV55(units,level,requestedLimit){
  const floor=minimumCompletePageInputV55(units,level);
  const requested=Number.isFinite(Number(requestedLimit))
    ?Math.max(1600,Math.floor(Number(requestedLimit))):BULK_INPUT_TOKEN_CEILING;
  // The client's upper bound remains 900k; we never bypass model limits.
  // The floor can only raise an overly aggressive adaptive budget, NOT the
  // hard provider budget. If a whole page exceeds 900k, fail safely.
  if(floor>BULK_INPUT_TOKEN_CEILING){
    throw Object.assign(new Error('Pagina originale troppo grande per il limite Gemini: verifica manuale necessaria, nessuna pagina tagliata.'),{
      code:'NATURAL_PAGE_EXCEEDS_PROVIDER_CAP',neededInputTokens:floor});
  }
  return Math.min(BULK_INPUT_TOKEN_CEILING,Math.max(requested,floor+256));
}
export function planNaturalBlocksV51(units,level,{
  maxInputTokens=BULK_INPUT_TOKEN_CEILING,
  maxOutputTokens=BULK_OUTPUT_TOKEN_CEILING
}={}){
  if(!LEVELS.has(String(level)))throw new Error('Livello sconosciuto.');
  const bounded=assignBudgetsV51(units,String(level));
  // LAB55: a saved reduced limit MUST NOT strand a later complete page.
  // This is the actual cause of NATURAL_BOUNDARY_REQUIRED after LAB54's 503.
  const effectiveInputTokens=safeNaturalInputLimitV55(bounded,String(level),maxInputTokens);
  const blocks=[];
  let start=0;
  while(start<bounded.length){
    let lastSafe=-1;
    for(let i=start;i<bounded.length;i++){
      const candidate=bounded.slice(start,i+1);
      const estimate=estimatedTokens(candidate,String(level));
      if(estimate.input>effectiveInputTokens||estimate.output>maxOutputTokens||
         estimate.chars>MAX_REQUEST_CHARS)break;
      if(naturalBoundaryV51(bounded,i))lastSafe=i+1;
    }
    if(lastSafe<=start)throw Object.assign(new Error('Una pagina o sezione integra supera la capacità sicura: impossibile tagliarla a metà.'),{code:'NATURAL_BOUNDARY_REQUIRED'});
    blocks.push(bounded.slice(start,lastSafe));
    start=lastSafe;
  }
  return blocks;
}
export function bisectAtNaturalBoundaryV51(block){
  let best=-1,score=Infinity;
  for(let i=0;i<block.length-1;i++){
    if(!naturalBoundaryV51(block,i))continue;
    const left=block.slice(0,i+1).reduce((n,x)=>n+x.source.length,0);
    const right=block.slice(i+1).reduce((n,x)=>n+x.source.length,0);
    const cost=Math.abs(left-right);
    if(cost<score){score=cost;best=i+1;}
  }
  return best>0?[block.slice(0,best),block.slice(best)]:null;
}
export function blockLetterTargetV51(block,level){
  if(level==='summary')return {targetLetters:null,
    summaryCapLetters:block.reduce((n,u)=>n+u.summaryCapLetters,0)};
  return {targetLetters:block.reduce((n,u)=>n+u.targetLetters,0),
    summaryCapLetters:null};
}


// LAB54: after a 503, reduce the NEXT request's context budget while
// respecting physical-page/chapter boundaries. No source paragraph is cut.
export function adaptiveOverloadBudgetV54(block,level,currentLimit,attempt=1){
  const current=Math.max(1600,Math.floor(Number(currentLimit)||BULK_INPUT_TOKEN_CEILING));
  if(!Array.isArray(block)||!block.length)return {inputLimit:current,reduced:false};
  const ratio=Number(attempt)>=3?0.34:Number(attempt)>=2?0.50:0.70;
  const overloadTokens=estimatedTokens(block,level).input;
  let pageStart=0;
  let largestWholePage=0;
  for(let i=0;i<block.length;i++){
    if(!naturalBoundaryV51(block,i))continue;
    largestWholePage=Math.max(largestWholePage,
      estimatedTokens(block.slice(pageStart,i+1),level).input);
    pageStart=i+1;
  }
  // If the *single* complete page is too large, never silently halve it.
  const floor=Math.max(1600,largestWholePage+300);
  const next=Math.min(current,Math.max(floor,Math.floor(overloadTokens*ratio)));
  return {inputLimit:next,reduced:next<current,largestWholePage,
    previousLimit:current,overloadTokens,
    reason:next<current?'overload-smaller-full-pages':'single-page-or-minimum-limit'};
}
