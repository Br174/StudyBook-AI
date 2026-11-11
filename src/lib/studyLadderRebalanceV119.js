// StudyBook LAB119C: local redistribution of REAL model-written expansion
// SENTENCES across six levels. No new Gemini calls. A full sentence is never
// cut, artificial filler is rejected, and results remain uncertified.
import {studyLetters} from './studyPillarV38.js';
import {STUDY_LEVELS_V67} from './studyRebalancePolicyV67.js';
import {pageLetterBudgetsV74,pageLetterReviewV74}
 from './studyPageBudgetsV74.js';
import {studyGeometryReviewV78} from './studyGeometryV78.js';
import {auditFidelity,extractProtectedItems} from './fidelityEngine.js';
import {inspectBestOfV76} from './studyBestOfV76.js';
import {STUDY_SEMANTIC_LADDER_V119} from './studySemanticLadderV119.js';

export const STUDY_LADDER_REBALANCE_V119='lab119c-source-supported-sentences-six-levels-no-gemini';
const SEQUENCE=['summary','50','40','30','20','10'];
const FIELDS=['extra50','extra40','extra30','extra20','extra10'];
const norm=s=>String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim();
const sentences=s=>(norm(s).match(/[^.!?]+(?:[.!?]+|$)/gu)||[])
 .map(norm).filter(Boolean);
const tok=s=>[...new Set((norm(s).toLocaleLowerCase('it-IT')
 .match(/[\p{L}]{4,}/gu)||[]))];
const isGeneric=s=>/\b(?:ulteriori dettagli|dettagli completi|testo originario|modifiche strutturali|conformità totale|contenuto incluso)\b/iu.test(s);
function unsupported(source,s){
 if(isGeneric(s))return'GENERIC_FILLER';
 if(studyLetters(s)<9)return'TOO_SHORT';
 const overlap=new Set(tok(source));
 const shared=tok(s).filter(x=>overlap.has(x)).length;
 if(shared<2)return'NO_OBSERVABLE_SOURCE_SUPPORT';
 const origNums=new Set(source.match(/\b\d+(?:[.,]\d+)?\b/gu)||[]);
 const extraNums=(s.match(/\b\d+(?:[.,]\d+)?\b/gu)||[])
  .filter(x=>!origNums.has(x));
 if(extraNums.length)return'INVENTED_NUMERIC_VALUE';
 // Source-to-fragment warnings are conservative; this helps detect
 // scientifically stronger claims such as "cause" for "influence".
 // The existing page-level assessor also reports "missing protected"
 // when given only ONE sentence of a whole page. That is NOT a legitimate
 // reason to reject an independently valid addition; only semantic-direction
 // contradictions belong in this local sentence gate.
 const risk=inspectBestOfV76(source,s,'50').semanticAdvisories
  .filter(v=>v!=='missing-protected-facts'&&v!=='qualifier-scope-review');
 if(risk.length)return'SEMANTIC_DIRECTION_WARNING';
 const protectedOriginal=new Set(extractProtectedItems(source)
  .filter(x=>x.kind!=='qualifier').map(x=>x.kind+':'+x.value.toLowerCase()));
 const newItems=extractProtectedItems(s)
  .filter(x=>x.kind!=='qualifier'&&!protectedOriginal.has(x.kind+':'+x.value.toLowerCase()));
 if(newItems.length)return'NEW_PROTECTED_FACT';
 return null;
}
function chooseAdditions(available,needed,minAdd,maxAdd,remainingMax){
 const dp=new Map([[0,{cost:0,items:[]}]]);
 const cap=320;
 for(let i=0;i<available.length;i++){
  const o=available[i],next=new Map(dp);
  for(const [sum,rec] of dp){
   const ns=sum+o.letters;
   if(ns>remainingMax)continue;
   const option={cost:rec.cost+o.priority,items:[...rec.items,o.id]};
   const prev=next.get(ns);
   if(!prev||option.cost<prev.cost)next.set(ns,option);
  }
  const entries=[...next.entries()];
  if(entries.length<=cap){dp.clear();entries.forEach(([k,v])=>dp.set(k,v));continue;}
  const diff=k=>Math.max(0,minAdd-k,k-maxAdd);
  entries.sort((a,b)=>diff(a[0])-diff(b[0])||
   Math.abs(a[0]-needed)-Math.abs(b[0]-needed)||
   a[1].cost-b[1].cost);
  dp.clear();entries.slice(0,cap).forEach(([k,v])=>dp.set(k,v));
 }
 const sorted=[...dp.entries()].sort((a,b)=>{
  const bad=n=>n<minAdd||n>maxAdd;
  return Number(bad(a[0]))-Number(bad(b[0]))||
   Math.abs(a[0]-needed)-Math.abs(b[0]-needed)||
   a[1].cost-b[1].cost;
 });
 return{length:sorted[0][0],items:sorted[0][1].items};
}
export function rebalanceSemanticLadderV119(plan,response){
 if(plan?.policy!==STUDY_SEMANTIC_LADDER_V119||
   !Array.isArray(response?.units)||response.units.length!==plan.units.length)
  throw Error('LAB119C_SOURCE_RESPONSE_MISMATCH');
 // Research pilot only: a shared physical page needs a grouped optimization,
 // not independent unit budgets masquerading as per-page compliance.
 const group=pageLetterBudgetsV74(plan.units,'10');
 if(group.some(x=>x.unitIds.length!==1))throw Error('LAB119C_SHARED_PAGE_NOT_SUPPORTED');
 const unitSolutions=plan.units.map((source,i)=>{
  const row=response.units[i];
  if(row?.id!==source.id||!row.core?.trim())throw Error('LAB119C_UNIT_MISMATCH');
  const core=norm(row.core),startLetters=studyLetters(core);
  let counter=0;
  const seen=new Set(sentences(core).map(s=>s.toLowerCase()));
  const rejected=[],available=[];
  FIELDS.forEach((field,rank)=>{
   if(typeof row[field]!=='string')throw Error('LAB119C_MISSING_FIELD_'+field);
   for(const part of sentences(row[field])){
    const key=part.toLowerCase();
    const reason=seen.has(key)?'DUPLICATE_FULL_SENTENCE':unsupported(source.source,part);
    if(reason){rejected.push({field,reason,preview:part.slice(0,90)});continue}
    seen.add(key);
    available.push({id:counter++,text:part,
     letters:studyLetters(part),priority:rank*2+1});
   }
  });
  let selected=new Set();
  const outputs={};
  for(const level of SEQUENCE){
   const b=pageLetterBudgetsV74([source],level)[0];
   const len=startLetters+available.filter(o=>selected.has(o.id))
    .reduce((n,o)=>n+o.letters,0);
   const still=available.filter(o=>!selected.has(o.id));
   const remain=still.reduce((n,o)=>n+o.letters,0);
   const picked=chooseAdditions(still,b.targetLetters-len,
    Math.max(0,b.minLetters-len),
    Math.max(0,b.maxLetters-len),remain);
   picked.items.forEach(id=>selected.add(id));
   const final=norm([core,...available
    .filter(o=>selected.has(o.id)).map(o=>o.text)].join(' '));
   const letters=studyLetters(final);
   const a=auditFidelity(source.source,final);
   const dir=inspectBestOfV76(source.source,final,level).semanticAdvisories;
   outputs[level]={text:final,letters,
    withinLetterRange:letters>=b.minLetters&&letters<=b.maxLetters,
    sourceFactWarnings:a.missingHighValue.length+a.missingProtected.length+
      a.qualifierMismatches.length,
    directionalWarnings:dir,
    semanticCertified:false};
  }
  return{id:source.id,outputs,candidates:available.length,
   rejected,coreLetters:startLetters};
 });
 const editions={},quality={};
 for(const level of SEQUENCE){
  const parts=unitSolutions.map(u=>({id:u.id,text:u.outputs[level].text}));
  const letters=pageLetterReviewV74(plan.units,parts,level);
  const rows=studyGeometryReviewV78(plan.units,parts,level);
  quality[level]={reduction:Math.round((1-parts.reduce(
   (n,p)=>n+studyLetters(p.text),0)/plan.originalLetters)*1000)/10,
   numericAndRowsPass:letters.withinBand&&rows.complete,
   pagesPassed:letters.groups.filter(x=>x.withinBand).length,
   pagesTotal:letters.groups.length,
   preliminarySemanticWarnings:unitSolutions.map(x=>({
    id:x.id,count:x.outputs[level].sourceFactWarnings+
     x.outputs[level].directionalWarnings.length
   })),
   semanticCertified:false};
  editions[level]=parts;
 }
 return{policy:STUDY_LADDER_REBALANCE_V119,partsByLevel:editions,
  quality,missingFactsLikely:unitSolutions.some(u=>
   SEQUENCE.some(level=>u.outputs[level].sourceFactWarnings||
    u.outputs[level].directionalWarnings.length)),
  candidateStatistics:unitSolutions.map(u=>({
   id:u.id,usable:u.candidates,rejected:u.rejected,coreLetters:u.coreLetters})),
  providerRequestsMade:0,semanticCertified:false,approvedForApp:false};
}
