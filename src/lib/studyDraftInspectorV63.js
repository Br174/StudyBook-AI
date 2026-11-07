// LAB63: read-only audit of existing physical-page checkpoints.
// Deliberately NO Gemini calls, no storage writes, no recompression.
// The number approved in the progress widget may NOT be a published prefix.
export const STUDY_LEVELS_V63=[
 {id:'summary',label:'Riassunto'},{id:'50',label:'50%'},
 {id:'40',label:'40%'},{id:'30',label:'30%'},
 {id:'20',label:'20%'},{id:'10',label:'10%'}
];
const positive=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const sanitize=x=>typeof x==='string'?x.trim():'';
function physicalMappings(book){
 const total=positive(book?.canonicalBookMap?.pageCount)||
  positive(book?.sourceData?.structure?.pageCount)||0;
 const chapters=book?.chapters||[];
 const byPage=new Map(Array.from({length:total},(_,i)=>[i+1,[]]));
 for(let ci=0;ci<chapters.length;ci++){
  const chapter=chapters[ci];
  for(let pi=0;pi<(chapter?.paragraphs||[]).length;pi++){
   const p=chapter.paragraphs[pi];
   const start=positive(p?.sourcePageStart)||positive(chapter?.pageStart);
   const end=positive(p?.sourcePageEnd)||positive(chapter?.pageEnd)||start;
   // Same source-page validation as the LAB59 visible page counters.
   if(!start||!end||end<start||end-start>30||start>total)continue;
   for(let page=start;page<=Math.min(end,total);page++)
    byPage.get(page).push({ci,pi,original:sanitize(
     typeof p==='string'?p:p?.original||p?.text||''
    ),spansPages:start!==end});
  }
 }
 return {total,byPage};
}
export function inspectStudyDraftPagesV63(book,level='summary'){
 const snapshot=book?.editionsV36||null;
 const {total,byPage}=physicalMappings(book);
 const checked=snapshot?.stagedRows||snapshot?.rows||[];
 const drafts=snapshot?.draftRowsV57||[];
 const published=snapshot?.rows||[];
 const prefix=Number(snapshot?.publishedThroughPage?.[level])||0;
 const persisted=snapshot?.checkpointPersistent!==false;
 const pages=Array.from({length:total},(_,i)=>{
  const page=i+1;
  const mapped=byPage.get(page)||[];
  const originals=[];
  const draftsText=[];
  const accepted=[];
  let acceptedUnits=0,withDraftUnits=0,hasAnyText=false;
  for(const unit of mapped){
   const {ci,pi,original}=unit;
   if(original)originals.push(original);
   const row=checked[ci]?.[pi];
   const value=sanitize(row?.editions?.[level]);
   const isVerified=row?.verified?.[level]===true&&nonempty(value);
   const raw=sanitize(drafts[ci]?.[pi]?.editions?.[level])||
     (isVerified?value:'');
   if(raw){draftsText.push(raw);withDraftUnits++;hasAnyText=true;}
   if(isVerified){accepted.push(value);acceptedUnits++;hasAnyText=true;}
  }
  const approved=mapped.length>0&&persisted&&acceptedUnits===mapped.length;
  const partial=acceptedUnits>0&&!approved;
  const publishedInReader=approved&&page<=prefix&&
   mapped.every(u=>published[u.ci]?.[u.pi]?.verified?.[level]===true&&
    nonempty(published[u.ci]?.[u.pi]?.editions?.[level]));
  const state=approved?'approved':partial?'partial':
    hasAnyText?'draft':mapped.length?'empty':'unmapped';
  return {page,state,approved,partial,publishedInReader,units:mapped.length,
   acceptedUnits,withDraftUnits,
   original:originals.join('\n\n'),
   draft:draftsText.join('\n\n'),
   accepted:accepted.join('\n\n'),
   sourceSpansPages:mapped.some(x=>x.spansPages)};
 });
 return {level,total,pages,
  approved:pages.filter(p=>p.approved).length,
  published:pages.filter(p=>p.publishedInReader).length,
  drafted:pages.filter(p=>p.draft.length>0).length,
  partial:pages.filter(p=>p.partial).length,
  missing:pages.filter(p=>!p.draft&&!p.accepted).length,
  persisted,
  checkpointUpdatedAt:snapshot?.updatedAt||null,
  // Important: LAB/version of each accepted page was not recorded historically.
  canProveOriginLab:false};
}
