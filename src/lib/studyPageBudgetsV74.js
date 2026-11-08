// LAB74: one SOURCE-derived page/range letter budget before Gemini writes.
// Tolerance is ±5 percentage points of the ORIGINAL alphabetical letters:
// 100 original, 50% reduction => target 50 retained, minimum 45, maximum 55.
// Multi-page original paragraphs remain indivisible: an overlapping page
// range is ONE atomic budget, never a fictitiously split physical page.
import {studyLetters,percentReduced} from './studyPillarV38.js';
import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';

const validPage=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):null;
const validText=x=>typeof x==='string'&&x.trim().length>0;
export const STUDY_PAGE_LETTER_POLICY_V74='original-page-source-letters-plusminus-5pct-v1';

export function sourceLetterBudgetV74(sourceLetters,level){
 const n=Number(sourceLetters),policy=STUDY_TARGET_V67[String(level)];
 if(!policy||!Number.isSafeInteger(n)||n<=0)
  throw Object.assign(new Error('Fonte o livello mancante per il budget lettere'),
   {code:'PAGE_LETTER_BUDGET_INVALID'});
 const targetLetters=Math.round(n*(100-policy.target)/100);
 const minLetters=Math.ceil(n*(100-policy.max)/100);
 const maxLetters=Math.floor(n*(100-policy.min)/100);
 // On a 1- or 2-letter physical page the interval may have no integer.
 // Keep the true interval and mark it impossible, never silently fabricate
 // a passing result or cut/fill a word.
 return {originalLetters:n,level:String(level),
  reductionPercent:policy.target,
  targetLetters,minLetters,maxLetters,
  tolerancePercentagePoints:5,
  integerFeasible:minLetters<=maxLetters};
}
export function pageLetterBudgetsV74(units,level){
 if(!Array.isArray(units)||!units.length)
  throw Object.assign(new Error('Nessuna pagina originale disponibile'),
   {code:'PAGE_LETTER_BUDGET_INVALID'});
 const groups=[];
 for(const u of units){
  const a=validPage(u.pageStart??u.sourcePageStart),
   b=validPage(u.pageEnd??u.sourcePageEnd??u.pageStart);
  if(!a||!b||a>b||!validText(u.source)||typeof u.id!=='string')
   throw Object.assign(new Error('Pagine originali non verificabili'),
    {code:'SOURCE_PAGE_UNCERTAIN'});
  const tail=groups[groups.length-1];
  // The original sequence is authoritative; do not split original paragraphs.
  if(tail&&a<=tail.pageEnd){
   tail.pageEnd=Math.max(tail.pageEnd,b);
   tail.originalLetters+=studyLetters(u.source);
   tail.unitIds.push(u.id);
  }else{
   if(tail&&a<tail.pageStart)
    throw Object.assign(new Error('Ordine delle pagine non verificato'),
     {code:'SOURCE_PAGE_UNCERTAIN'});
   groups.push({pageStart:a,pageEnd:b,originalLetters:studyLetters(u.source),
    unitIds:[u.id]});
  }
 }
 return groups.map(g=>({
   pageStart:g.pageStart,pageEnd:g.pageEnd,unitIds:g.unitIds,
   ...sourceLetterBudgetV74(g.originalLetters,level)
 }));
}
export function pageLetterReviewV74(units,parts,level){
 const budgets=pageLetterBudgetsV74(units,level);
 const map=new Map((parts||[]).filter(x=>typeof x?.id==='string')
  .map(x=>[x.id,x.text]));
 const groups=budgets.map(g=>{
  let outputLetters=0,missing=false;
  for(const id of g.unitIds){
   const text=map.get(id);
   if(!validText(text)){missing=true;continue}
   outputLetters+=studyLetters(text);
  }
  const withinBand=!missing&&g.integerFeasible&&
   outputLetters>=g.minLetters&&outputLetters<=g.maxLetters;
  return {...g,outputLetters,missing,
   achievedReduction:missing?null:percentReduced(g.originalLetters,outputLetters),
   withinBand};
 });
 return {policy:STUDY_PAGE_LETTER_POLICY_V74,
  groups,withinBand:groups.every(g=>g.withinBand),
  pagesCovered:[...new Set(groups.flatMap(g=>
   Array.from({length:g.pageEnd-g.pageStart+1},(_,i)=>g.pageStart+i)))]
    .sort((a,b)=>a-b)};
}
