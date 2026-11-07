// LAB53: deterministic editorial fit, exact letters without deleting factual text.
// A draft is NEVER verified until every educational guard passes.
import {studyLetters} from './studyPillarV38.js';
import {auditFidelity,auditProgressiveConcepts} from './fidelityEngine.js';

// Italian discourse equivalents. Never edit negations, citations or legal names.
const PAIRS=[
 ['per esempio','ad esempio'],
 ['cioè','ossia'],
 ['inoltre','in più'],
 ['perciò','pertanto'],
 ['soltanto','solo'],
 ['infatti','in effetti'],
 ['tuttavia','però'],
];
function escapeRegex(s){return s.replace(/[.*+?^$()|[\]{}]/g,'\\$&');}
function replaceOne(text,from,to){
 const re=new RegExp('(^|[^\\p{L}])('+escapeRegex(from)+')(?=$|[^\\p{L}])','giu');
 let match;
 while((match=re.exec(text))){
   const at=match.index+match[1].length;
   const raw=match[2];
   const firstUpper=raw[0]===raw[0].toLocaleUpperCase('it-IT');
   const replacement=firstUpper?to[0].toLocaleUpperCase('it-IT')+to.slice(1):to;
   return {text:text.slice(0,at)+replacement+text.slice(at+raw.length),at};
 }
 return null;
}
export function auditStudyUnitV53(unit,level,value){
 const source=String(unit?.source||'');
 const text=String(value||'').trim();
 const target=level==='summary'?Number(unit?.summaryCapLetters):Number(unit?.targetLetters);
 const length=studyLetters(text);
 const delta=level==='summary'?Math.max(0,length-target):length-target;
 const fidelity=auditFidelity(source,text);
 const concepts=auditProgressiveConcepts(source,text);
 const reasons=[];
 if(!text)reasons.push('empty');
 if(!Number.isFinite(target)||target<0)reasons.push('invalid-target');
 else if(level==='summary'?length>target:length!==target)reasons.push('letter-budget');
 if(fidelity.missingProtected.length)reasons.push('missing-protected');
 if(fidelity.qualifierMismatches.length)reasons.push('scoped-qualifier');
 if(concepts.issues.length)reasons.push(...concepts.issues);
 return {ok:reasons.length===0,reasons,target,length,delta,
   protectedMissing:fidelity.missingProtected.length,
   qualifierFailures:fidelity.qualifierMismatches.length,
   conceptualFailures:concepts.issues.length};
}
export function fitStudyUnitV53(unit,level,value,{maxEdits=160}={}){
 const original=String(value||'').trim();
 let best=original,diag=auditStudyUnitV53(unit,level,best);
 if(diag.ok)return {text:best,audit:diag,edits:0};
 if(diag.reasons.some(x=>x!=='letter-budget'))return {text:best,audit:diag,edits:0};
 if(level==='summary'&&diag.delta<=0)return {text:best,audit:diag,edits:0};
 const budget=Math.max(8,Math.floor(studyLetters(unit.source)*.02));
 if(Math.abs(diag.delta)>budget)return {text:best,audit:diag,edits:0};
 let edits=0;
 while(edits<maxEdits){
   const now=auditStudyUnitV53(unit,level,best);
   if(now.ok)return {text:best,audit:now,edits};
   const gap=now.delta;
   if(!gap||now.reasons.some(x=>x!=='letter-budget'))break;
   const choices=[];
   for(const [a,b] of PAIRS){
     for(const [from,to] of [[a,b],[b,a]]){
       const size=studyLetters(to)-studyLetters(from);
       if((gap>0&&size>=0)||(gap<0&&size<=0)||Math.abs(size)>Math.abs(gap))continue;
       const replacement=replaceOne(best,from,to);
       if(!replacement)continue;
       choices.push({...replacement,size});
     }
   }
   if(!choices.length)break;
   choices.sort((a,b)=>Math.abs(gap+a.size)-Math.abs(gap+b.size)||a.at-b.at);
   let changed=false;
   for(const opt of choices){
     const check=auditStudyUnitV53(unit,level,opt.text);
     if(check.reasons.some(x=>x!=='letter-budget'))continue;
     if(Math.abs(check.delta)>=Math.abs(gap))continue;
     best=opt.text;edits++;changed=true;break;
   }
   if(!changed)break;
 }
 return {text:best,audit:auditStudyUnitV53(unit,level,best),edits};
}
export function reviewGeminiPartsV53(block,level,parts){
 const all=new Map(),accepted=new Set(block.map(u=>u.id));
 if(Array.isArray(parts))for(const part of parts){
   if(accepted.has(part?.id)&&typeof part.text==='string'&&!all.has(part.id))
     all.set(part.id,part.text);
 }
 const verified=[],failed=[],diagnostics={};
 for(const unit of block){
   if(!all.has(unit.id)){
     failed.push({unit,reason:['missing-ordered-paragraphs'],
       letterDelta:null,targetLetters:null,observedLetters:null});
     diagnostics['missing-ordered-paragraphs']=(diagnostics['missing-ordered-paragraphs']||0)+1;
     continue;
   }
   const draft=all.get(unit.id);
   const fit=fitStudyUnitV53(unit,level,draft);
   if(fit.audit.ok)verified.push({unit,text:fit.text});
   else{
     failed.push({unit,draft,reason:fit.audit.reasons,
       letterDelta:fit.audit.delta,targetLetters:fit.audit.target,
       observedLetters:fit.audit.length});
     for(const code of fit.audit.reasons)diagnostics[code]=(diagnostics[code]||0)+1;
   }
 }
 return {structural:all.size>0,verified,failed,
   publicReason:failed.length?'some-paragraphs-need-repair':'verified',
   numeric:{received:all.size,verified:verified.length,unverified:failed.length,
     expected:block.length,issues:diagnostics}};
}
