// LAB59: expose real PHYSICAL PAGE progress only, separated into the three
// user-facing phases. No network request, no extra worker and no fake progress.
// Keep the original PDF and saved Gemini checkpoints as the sole source of truth.
export const STUDY_LEVEL_ORDER_V59=['summary','50','40','30','20','10'];
export const studyLevelLabelV59=level=>level==='summary'?'Riassunto':level+'%';
const positive=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
const present=v=>typeof v==='string'&&v.trim().length>0;

// Preserve unit ids and original chapter/paragraph references for checkpoint
// compatibility; only the sequence in which Gemini receives pages changes.
export function orderSourceUnitsV59(units){
 return [...units].sort((a,b)=>a.pageStart-b.pageStart||
   a.ci-b.ci||a.pi-b.pi);
}
export function studyPhaseProgressV59(book,{acquisition=null}={}){
 const snapshot=book?.editionsV36||null;
 const pageCount=positive(book?.canonicalBookMap?.pageCount)||
   positive(book?.sourceData?.structure?.pageCount)||
   positive(acquisition?.total)||0;
 const acquired=Math.min(pageCount,Math.max(0,Number(acquisition?.done ??
   (snapshot? pageCount:0))||0));
 if(!snapshot){
   return {phase:'acquisition',title:'Acquisizione',pageCount,
     acquired,levels:[]};
 }
 const qualityMode=snapshot?.publicationModeV66==='generated-text-quality-not-certified';
 const phase=qualityMode?'quality':
   (snapshot.draftComplete===true &&
     (['review','repair','complete'].includes(snapshot.phase)||snapshot.complete===true))
     ?'correction':'compression';
 const pages=new Map();
 const chapters=book?.chapters||[];
 const drafts=snapshot.draftRowsV57||[];
 const checked=snapshot.stagedRows||snapshot.rows||[];
 for(let ci=0;ci<chapters.length;ci++){
   const chapter=chapters[ci];
   for(let pi=0;pi<(chapter?.paragraphs||[]).length;pi++){
     const p=chapter.paragraphs[pi];
     const start=positive(p.sourcePageStart)||positive(chapter.pageStart);
     const end=positive(p.sourcePageEnd)||positive(chapter.pageEnd)||start;
     if(!start||!end||end<start||end-start>30||start>pageCount)continue;
     const approved=checked[ci]?.[pi];
     const raw=drafts[ci]?.[pi];
     for(let pg=start;pg<=Math.min(end,pageCount);pg++){
       if(!pages.has(pg))pages.set(pg,[]);
       pages.get(pg).push({draft:raw,approved});
     }
   }
 }
 const persistent=snapshot.checkpointPersistent!==false;
 const levels=STUDY_LEVEL_ORDER_V59.map(id=>{
   let compressed=0,corrected=0;
   for(let pg=1;pg<=pageCount;pg++){
     const units=pages.get(pg);
     if(!units?.length)continue; // never fabricate readiness for unmapped pages
     const completeDraft=units.every(u=>
       present(u.draft?.editions?.[id])||
       (u.approved?.verified?.[id]===true &&
        present(u.approved?.editions?.[id])));
     const completeReview=persistent&&units.every(u=>
       u.approved?.verified?.[id]===true&&
       present(u.approved?.editions?.[id]));
     if(completeDraft)compressed++;
     if(completeReview)corrected++;
   }
   const audited=qualityMode?snapshot.qualityV66?.levels?.[id]:null;
   return {id,label:studyLevelLabelV59(id),
     completed:phase==='quality'?Number(audited?.checked)||0:
       phase==='correction'?corrected:compressed,
     compressed,corrected,total:pageCount,
     warnings:qualityMode?Number(audited?.warnings)||0:null,
     available:qualityMode?Number(audited?.available)||0:null,
     actualReduction:qualityMode?audited?.actualReduction:null,
     exactLength:qualityMode?audited?.exactLength:null};
 });
 return {phase,title:phase==='compression'?'Compressione':
     phase==='quality'?'Controllo qualità':'Verifica e correzione',
   pageCount,acquired:pageCount,levels};
}
