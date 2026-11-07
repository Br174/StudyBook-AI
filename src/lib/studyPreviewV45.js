// LAB45: progress can be READ without falsely approving full paragraphs.
// Input contains ONLY separately checkpoint-verified fragments, never drafts.
export function buildVerifiedFragmentPreviewV45(section){
  const count=Math.max(0,Math.min(10000,Number(section?.count)||0));
  const units=new Map();
  for(const entry of section?.parts||[]){
    const i=Number(entry?.index);
    if(Number.isInteger(i)&&i>=0&&i<count&&typeof entry.text==='string'&&entry.text.trim())
      units.set(i,entry.text.trim());
  }
  if(!count||!units.size)return null;
  const rows=[];
  for(let i=0;i<count;i++){
    if(units.has(i))rows.push(units.get(i));
    else rows.push('[Parte '+(i+1)+' in elaborazione, non verificata]');
  }
  return {text:rows.join('\n\n'),verifiedFragments:units.size,totalFragments:count,complete:units.size===count};
}
