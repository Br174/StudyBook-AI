// MotorLab StudyBook LAB89: deterministic proportional concept-row allocator.
// Fixed 60-cell monospace research grid, NOT proportional-font PDF rendering.
export const WIDTH=60;
export const MEAN_LETTERS=46.346;
export const MEAN_SPACES=11.502;
export const LEVELS=[65,50,40,30,20,10];
export function alpha(s){return (String(s||'').normalize('NFC').match(/\p{L}/gu)||[]).length}
export function words(s){return String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim().split(' ').filter(Boolean)}
export function wrap(s,width=WIDTH){
 const ls=[];let line='',longWord=false;
 for(const w of words(s)){
  if([...w].length>width)longWord=true;
  const trial=line?line+' '+w:w;
  if([...trial].length>width&&line){ls.push(line);line=w}else line=trial;
 }
 if(line)ls.push(line);
 return {lines:ls,longWord};
}
const sum=v=>v.reduce((a,b)=>a+b,0);
export function largestRemainder(total,weights){
 if(!Number.isInteger(total)||total<0)throw Error('bad total');
 if(!weights.length)return total===0?[]:null;
 if(!weights.every(w=>Number.isFinite(w)&&w>=0))throw Error('bad weights');
 const mass=sum(weights);
 const normalized=mass>0?weights.map(x=>x/mass):weights.map(()=>1/weights.length);
 const ideal=normalized.map(w=>w*total);
 const result=ideal.map(x=>Math.floor(x));
 let rest=total-sum(result);
 const order=ideal.map((x,i)=>({i,frac:x-result[i],weight:weights[i]}))
  .sort((a,b)=>b.frac-a.frac||b.weight-a.weight||a.i-b.i);
 for(let i=0;i<rest;i++)result[order[i].i]++;
 if(sum(result)!==total||result.some(x=>x<0))throw Error('apportionment invariants');
 return result;
}
export function allocate(source,reduction){
 if(!LEVELS.includes(reduction))throw Error('Unsupported reduction '+reduction);
 const concepts=source.concepts;
 if(!Array.isArray(concepts)||concepts.length<1)throw Error('No concepts');
 const letters=concepts.map(alpha);
 const totalLetters=sum(letters),originalRows=wrap(concepts.join(' ')).lines.length;
 const short=originalRows<=5;
 const desired=Math.round(totalLetters*(100-reduction)/100);
 const maxRows=short?5:Math.max(1,Math.round(desired/MEAN_LETTERS));
 const minRows=concepts.map((_,i)=>Number(source.minimumRows?.[i]||1));
 const lowerRows=sum(minRows);
 if(maxRows<lowerRows)return {source:source.id,reduction,totalLetters,originalRows,short,desired,maxRows,feasible:false,
  reason:'ESSENTIAL_CONCEPTS_REQUIRE_MORE_ROWS_THAN_PAGE_BUDGET',lowerRows,minRows,conceptCount:concepts.length};
 const priorities=concepts.map((_,i)=>Number(source.importance?.[i]||1));
 const extraWeights=letters.map((l,i)=>Math.max(0,l/MEAN_LETTERS-minRows[i])*priorities[i]);
 const portions=largestRemainder(maxRows-lowerRows,extraWeights.some(x=>x>0)?extraWeights:letters.map((x,i)=>x*priorities[i]));
 const assigned=minRows.map((x,i)=>x+portions[i]);
 const desiredByConcept=largestRemainder(desired,letters);
 const segments=concepts.map((c,i)=>({
  id:'C'+(i+1),source:c,sourceLetters:letters[i],sourceRowsApprox:+(letters[i]/MEAN_LETTERS).toFixed(2),
  importance:priorities[i],minRows:minRows[i],maxRows:assigned[i],
  estimatedLettersCapacity:+(assigned[i]*MEAN_LETTERS).toFixed(2),
  suggestedLetters:short?null:desiredByConcept[i],
  keyPoints:source.keyPoints?.[i]||[],
  technicalTerms:(source.flags||[]).filter(term=>c.toLocaleLowerCase('it').includes(term.toLocaleLowerCase('it')))
 }));
 if(sum(assigned)!==maxRows||assigned.some((n,i)=>n<minRows[i]))throw Error('bad row invariant');
 if(!short&&sum(desiredByConcept)!==desired)throw Error('bad letters invariant');
 return {source:source.id,reduction,totalLetters,originalRows,short,desired,maxRows,feasible:true,
   reductionBand:short?null:{minLetters:Math.ceil(totalLetters*(1-(reduction+5)/100)),maxLetters:Math.floor(totalLetters*(1-(reduction-5)/100))},
   allocatedRowSum:sum(assigned),conceptCount:segments.length,segments,
   allMustKeep:(source.keyPoints||[]).flat(),
   riskSignals:segments.filter(s=>!short&&s.suggestedLetters>s.estimatedLettersCapacity+5).map(s=>s.id+':estimated density high')
 };
}
export function validate(source,plan,sections){
 const structurallyValid=Array.isArray(sections)&&sections.length===plan.segments.length&&
  sections.every((s,i)=>s&&s.id===plan.segments[i].id&&typeof s.text==='string'&&s.text.trim().length>0);
 if(!structurallyValid)return{structurallyValid:false,gridPass:false,bandPass:false,combinedPass:false,reason:'missing/misaligned sections'};
 const per=sections.map((s,i)=>{
  const original=String(s.text||'');
  const layout=wrap(original),limit=plan.segments[i].maxRows;
  const broken=/\p{L}-\s*\n\s*\p{L}/u.test(original)||/(\p{L})\s*\n\s*(\p{L})/u.test(original);
  const malformed=/\b(?:dall|all|l|un)\s+(?:asse|inclinazione|aria|altra)\b/iu.test(original);
  const maxLine=layout.lines.length?Math.max(...layout.lines.map(x=>[...x].length)):0;
  return{id:s.id,rawText:original,rows:layout.lines.length,limit,gridPass:layout.lines.length<=limit&&!layout.longWord,
   rawLines:original.split('\n').length,rawLineWidths:original.split('\n').map(x=>[...x].length),
   letterCount:alpha(original),brokenWord:broken,malformedApostrophe:malformed,
   wordIntegrity:!broken&&!malformed,layoutPreview:layout.lines,maxLineWidth:maxLine};
 });
 const rawText=sections.map(s=>s.text.trim()).join(' ');
 const actual=alpha(rawText);
 const bandPass=plan.short||actual>=plan.reductionBand.minLetters&&actual<=plan.reductionBand.maxLetters;
 const gridPass=per.every(s=>s.gridPass);
 return {structurallyValid:true,gridPass,bandPass,combinedPass:gridPass&&bandPass,
  wordIntegrityPass:per.every(s=>s.wordIntegrity),actualLetters:actual,
  actualReduction:+(100*(1-actual/plan.totalLetters)).toFixed(2),
  originalLetters:plan.totalLetters,missingTechnicalTermsAt1020:plan.reduction<=20?(source.flags||[]).filter(t=>!rawText.toLocaleLowerCase('it').includes(t.toLocaleLowerCase('it'))):[],
  geometry:per,rawText};
}
