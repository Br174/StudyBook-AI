// LAB140 pure helpers. No additional Gemini call or semantic certification.
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const norm=value=>String(value||'').normalize('NFC');
const escapeRegex=text=>Array.from(text).map(ch=>
  '\\^$.*+?()[]{}|'.includes(ch)?'\\'+ch:ch).join('');
// The V139 reader demanded the special **(termine)** marker. A matching
// plain-language term, with Unicode word boundaries, must anchor the sidebar.
export function glossaryTermMentionedV140(sentence,term){
 const candidate=norm(term).trim().replace(/\s+/gu,' ');
 if(!candidate||candidate.length>100)return false;
 const text=norm(sentence).replace(/\*\*\(([^)\n]+)\)\*\*/gu,'$1')
  .replace(/\s+/gu,' ');
 const pattern=escapeRegex(candidate).replace(/\s+/gu,'\\s+');
 return new RegExp('(^|[^\\p{L}\\p{N}])'+pattern+
   '(?=$|[^\\p{L}\\p{N}])','iu').test(text);
}
// Learn from successfully generated pages. No extra requests or rewriting.
// Scale remains near one, preserving the intended 50% reduction.
export function nextLengthTargetScaleV140(current,observations=[]){
 const base=Number.isFinite(current)?clamp(current,0.88,1.12):1;
 const samples=observations.filter(r=>
  r&&r.ready===true&&!r.shortPage&&
  Number.isFinite(r.sourceUnits)&&r.sourceUnits>=400&&
  Number.isFinite(r.outputUnits)&&r.outputUnits>0);
 if(!samples.length)return base;
 let observed=0,weight=0;
 for(const r of samples){
  const source=Math.min(3000,r.sourceUnits);
  const ratio=r.outputUnits/(r.sourceUnits*0.5*base);
  if(ratio<0.6||ratio>1.5)continue;
  observed+=source*ratio;weight+=source;
 }
 if(!weight)return base;
 const next=clamp(base*Math.pow(1/(observed/weight),0.35),0.88,1.12);
 return Math.round(next*1000)/1000;
}
export function targetScaleV140(value){
 if(value==null||value==='')return 1;
 const number=Number(value);
 return Number.isFinite(number)?clamp(number,0.88,1.12):1;
}
export function applyTargetScaleV140(payload,scale){
 const factor=targetScaleV140(scale);
 return {...payload,pages:(payload.pages||[]).map(p=>({
  ...p,targetBodyUnits:Math.max(1,Math.round(p.targetBodyUnits*factor)),
  segments:(p.segments||[]).map(s=>({
   ...s,targetSegmentUnits:Math.max(1,Math.round(s.targetSegmentUnits*factor))
  }))
 }))};
}
