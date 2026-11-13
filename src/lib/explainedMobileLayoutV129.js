// LAB129: screen-only glossary layout; never changes PDF or saved text.
// Terms are read in source order, grouped into one top-aligned sidebar.
export function glossaryForExplainedPageV129(rows=[]){
 const seen=new Set();
 return (Array.isArray(rows)?rows:[]).flatMap(row=>row.notes||[]).filter(note=>{
  const term=String(note?.term||'').trim();
  const definition=String(note?.definition||'').trim();
  const key=term.toLocaleLowerCase('it-IT');
  if(!term||!definition||seen.has(key))return false;
  seen.add(key);return true;
 });
}
