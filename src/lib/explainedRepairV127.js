// LAB127: per-page, persistent bounded correction and transparent fallback.
// This file is pure: no network, timers, asynchronous jobs, or paid services.
export const MAX_CORRECTIONS_V127=5;

export function usableExplainedDraftV127(original,record){
 const expected=original?.segments||[],parts=record?.segments;
 return Array.isArray(parts)&&parts.length===expected.length&&
  expected.every((seg,i)=>parts[i]?.id===seg.id&&
   typeof parts[i].text==='string'&&parts[i].text.trim()&&
   !/[[]\[|\]\]|\{\{\s*TODO|\.\.\.\s*$/u.test(parts[i].text));
}
export function repairAttemptV127(previous={},errorCode=''){
 const initial=previous.initial===true;
 return {initial:true,
  corrections:Math.min(MAX_CORRECTIONS_V127,
   Number(previous.corrections||0)+(initial?1:0)),
  lastCode:String(errorCode||'').slice(0,150)};
}
export function correctionRemainingV127(state){
 return Math.max(0,MAX_CORRECTIONS_V127-Number(state?.corrections||0));
}
export function betterExplainedDraftV127(original,oldPage,newPage){
 if(!usableExplainedDraftV127(original,oldPage))return newPage;
 if(!usableExplainedDraftV127(original,newPage))return oldPage;
 if(newPage?.review?.ready===true)return newPage;
 if(oldPage?.review?.ready===true)return oldPage;
 const score=page=>{
  const issues=page?.review?.issues||[];
  const severe=issues.filter(x=>/PROTECTED|IMMUTABLE|RELATION|UNSUPPORTED|MISSING|CONTRADICT|EMPTY|TRUNCAT|INVALID/iu.test(x)).length;
  const generic=issues.length;
  const diff=Math.abs(Number(page?.review?.exactReduction??0)-50);
  return severe*100+generic*20+Math.min(30,diff);
 };
 return score(newPage)<score(oldPage)?newPage:oldPage;
}
export function reservedExplainedPageV127(original,record,state,{
 terminalCorrectionLimit=MAX_CORRECTIONS_V127
}={}){
 // The fast 50% edition intentionally caps repairs at TWO, whereas the
 // legacy contract caps at FIVE. The terminal limit is recorded explicitly
 // so a completed page cannot be stranded by a hidden 5-attempt check.
 const limit=terminalCorrectionLimit===2?2:MAX_CORRECTIONS_V127;
 // A structurally valid but one-line/trivial answer must NEVER replace
 // a long original page in the reserved edition. Keep the original text
 // available and mark sourceTextFallback instead of endorsing a slogan.
 const structurallyUsable=usableExplainedDraftV127(original,record);
 const originalLetters=(original?.segments||[]).map(s=>String(s.source||''))
   .join('\n').match(/\p{L}/gu)?.length||0;
 const draftLetters=(record?.segments||[]).map(s=>String(s.text||''))
   .join('\n').match(/\p{L}/gu)?.length||0;
 const usable=structurallyUsable&&(originalLetters<=250||
   draftLetters>=Math.max(80,Math.ceil(originalLetters*0.35)));
 const segments=usable?record.segments:
  (original.segments||[]).map(s=>({id:s.id,text:s.source}));
 const review=record?.review||{};
 const originalIssues=Array.isArray(review.issues)?review.issues:[];
 const issues=originalIssues.length?originalIssues:
  [usable?'V127_REWRITE_NOT_VERIFIED':'V127_NO_USABLE_EXPLANATION'];
 return {id:original.id,label:original.label,
  sourcePage:original.physicalPage,physicalPage:original.physicalPage,
  segments,glossary:usable&&Array.isArray(record.glossary)?record.glossary:[],
  review:{...review,ready:false,sizeCompliant:false,
   issues:[...new Set(issues)],
   acceptedWithReserve:true,sourceTextFallback:!usable,
   correctionAttempts:Math.min(MAX_CORRECTIONS_V127,
    Math.max(0,Number(state?.corrections??MAX_CORRECTIONS_V127))),
   lastCorrectionCode:state?.lastCode||null,
   ...(limit===2?{terminalCorrectionLimitV141:2,fastTerminalV141:true}:{}),
   semanticCertified:false}};
}
export function reserveUnreadPageV127(original){
 const parts=(original.segments||[]).map(s=>({id:s.id,text:s.source}));
 return {id:original.id,label:original.label,
  sourcePage:original.physicalPage,physicalPage:original.physicalPage,
  segments:parts,glossary:[],
  review:{ready:false,sizeCompliant:false,
   issues:['V127_COMPREHENSION_UNAVAILABLE'],
   acceptedWithReserve:true,sourceTextFallback:true,
   comprehensionUnavailable:true,correctionAttempts:0,
   semanticCertified:false}};
}
export function reserveAcceptedV127(original,record){
 if(record?.review?.provisionalOriginal===true){
  // A PDF-only original may legitimately contain square brackets, citations
  // or ellipses that must never be interpreted as Gemini placeholders.
  const source=original?.segments||[],segments=record?.segments;
  return Boolean(record.review.acceptedWithReserve===true&&
   record.review.sourceTextFallback===true&&
   Array.isArray(segments)&&segments.length===source.length&&
   source.every((item,i)=>segments[i]?.id===item.id&&
    segments[i]?.text===item.source));
 }
 const review=record?.review;
 if(review?.acceptedWithReserve!==true)return false;
 const fastTerminal=review.fastTerminalV141===true&&
  review.terminalCorrectionLimitV141===2&&review.correctionAttempts===2;
 const legacyTerminal=review.correctionAttempts===MAX_CORRECTIONS_V127||
  review.comprehensionUnavailable===true;
 if(!fastTerminal&&!legacyTerminal)return false;
 // Fallback originals must match the trusted source exactly; this grants
 // readable WITH-RESERVE completion, never length/semantic conformity.
 if(review.sourceTextFallback===true){
  const expected=original?.segments||[],actual=record?.segments||[];
  return actual.length===expected.length&&expected.every((item,i)=>
   actual[i]?.id===item.id&&actual[i]?.text===item.source);
 }
 return usableExplainedDraftV127(original,record);
}
export function reservationReportV127(pages){
 return (pages||[]).filter(p=>p?.review?.acceptedWithReserve===true)
  .map(p=>({page:Number(p.sourcePage),label:String(p.label||p.sourcePage),
   issues:Array.isArray(p.review.issues)?p.review.issues:[],
   sourceTextFallback:p.review.sourceTextFallback===true,
   provisionalOriginal:p.review.provisionalOriginal===true,
   corrections:Number(p.review.correctionAttempts)||0}))
  .sort((a,b)=>a.page-b.page);
}
