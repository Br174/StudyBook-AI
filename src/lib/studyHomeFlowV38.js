// LAB38 hotfix: one owner for Home creation/resume/navigation decisions.
// The local preprocessing counter is never a Gemini-completion counter.
export function studyHomeAction({generating=false,hasSource=false,hasCurrentIncomplete=false,hasSavedIncomplete=false,hasCurrentBook=false}={}){
  if(generating)return 'active';
  if(hasCurrentIncomplete)return 'resume';
  if(hasCurrentBook)return 'open';
  if(hasSource)return 'create';
  if(hasSavedIncomplete)return 'resume';
  return 'empty';
}
export function studyProgressLabel({phase='idle',done=0,total=0,status=''}={}){
  const safeDone=Math.max(0,Math.floor(Number(done)||0));
  const safeTotal=Math.max(0,Math.floor(Number(total)||0));
  if(phase==='preparing')return 'Preparazione del documento · '+String(status||'preparo i capitoli');
  if(phase==='gemini')return 'Edizioni Gemini · '+safeDone+'/'+safeTotal+' parti IA verificate · '+String(status||'checkpoint');
  return String(status||'Pronto');
}
export const sameStoredDocument=(candidate,libraryId,filename)=>
  Boolean(candidate?.id&&(candidate.id===libraryId||(!libraryId&&candidate.fileName===filename)));
