// LAB130 — shared deterministic request and evidence guard (Worker + Android).
export const STUDY_TOOLS_CONTRACT_V130='lab130-gemini-on-demand-v1';
export const STUDY_TOOLS_V130=['flashcards','quiz','map','oral'];
const MAX_SOURCE=14000;
const SPACE=/\s+/gu;
const STOP=/[«“](?:perché|che|come|quale|essa|questo|questa)[»”]\s*(?:o\s*[»”])?/iu;
export const compactV130=value=>String(value||'').replace(SPACE,' ').trim();
export function studyToolPayloadV130(value){
 const x=value&&typeof value==='object'?value:{};
 const tool=String(x.tool||'');
 const scope=['page','chapter','book'].includes(x.scope)?x.scope:'chapter';
 const title=compactV130(x.chapterTitle).slice(0,150);
 const passages=Array.isArray(x.passages)?x.passages:[];
 if(!STUDY_TOOLS_V130.includes(tool)||!passages.length||passages.length>40)
  return {ok:false,code:'V130_REQUEST_INVALID'};
 const normalized=[];let used=0;
 for(const p of passages){
  const text=compactV130(p?.text);
  if(text.length<35||text.length>12000||used+text.length>MAX_SOURCE)
   return {ok:false,code:'V130_SOURCE_INVALID'};
  normalized.push({page:String(p?.page||'').slice(0,20),
   title:compactV130(p?.title).slice(0,120),text});
  used+=text.length;
 }
 return {ok:true,tool,scope,chapterTitle:title,passages:normalized,
  sourceChars:used,sampled:x.sampled===true};
}
function validQuestion(q){
 return q.length>=24&&q.length<=230&&!STOP.test(q)&&
  !/[«“][^»”]*\s+o\s*[»”]/u.test(q)&&
  !/[«“]\s*[»”]/u.test(q)&&
  !/\b(?:e|o|per|come|nel|nella)\s*[?]$/iu.test(q);
}
export function auditStudyToolItemsV130(tool,items,passages){
 const corpus=compactV130((passages||[]).map(p=>p.text).join(' '));
 const source=corpus.toLocaleLowerCase('it-IT');
 const accepted=[],seen=new Set();const rejected=[];
 if(!STUDY_TOOLS_V130.includes(tool)||!Array.isArray(items))
  return {items:[],rejected:['V130_ITEMS_INVALID']};
 for(const raw of items.slice(0,14)){
  const item=raw&&typeof raw==='object'?raw:null;
  const evidence=compactV130(item?.evidence);
  if(!evidence||evidence.length<22||evidence.length>320||
     !source.includes(evidence.toLocaleLowerCase('it-IT'))){
   rejected.push('V130_EVIDENCE_NOT_IN_SOURCE');continue;
  }
  const question=compactV130(item.question);
  const answer=compactV130(item.answer);
  const signature=compactV130(question||item.title).toLocaleLowerCase('it-IT');
  if(!signature||seen.has(signature)){rejected.push('V130_DUPLICATE');continue;}
  if(tool==='map'){
   const title=compactV130(item.title);
   const points=Array.isArray(item.points)?item.points.map(compactV130)
    .filter(x=>x.length>=12&&x.length<=220).slice(0,4):[];
   const keywords=Array.isArray(item.keywords)?item.keywords.map(compactV130)
    .filter(x=>x.length>=4&&x.length<=65).slice(0,6):[];
   if(title.length<5||title.length>110||!points.length){
    rejected.push('V130_MAP_INVALID');continue;
   }
   accepted.push({title,points,keywords,evidence});
  }else if(tool==='quiz'){
   const options=Array.isArray(item.options)?item.options.map(compactV130):[];
   const correctIndex=Number(item.correctIndex);
   const explanation=compactV130(item.explanation);
   if(!validQuestion(question)||options.length!==3||
      options.some(x=>x.length<5||x.length>190)||
      new Set(options.map(x=>x.toLocaleLowerCase('it-IT'))).size!==3||
      !Number.isInteger(correctIndex)||correctIndex<0||correctIndex>2||
      explanation.length<20||explanation.length>400){
    rejected.push('V130_QUIZ_INVALID');continue;
   }
   accepted.push({question,options,correctIndex,explanation,evidence});
  }else{
   if(!validQuestion(question)||answer.length<18||answer.length>600){
    rejected.push('V130_QUESTION_INVALID');continue;
   }
   if(tool==='flashcards')accepted.push({front:question,back:answer,evidence});
   else accepted.push({question,answer,evidence});
  }
  seen.add(signature);
  if(accepted.length===8)break;
 }
 return {items:accepted,rejected};
}
