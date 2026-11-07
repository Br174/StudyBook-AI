// LAB51: use only complete source paragraphs and natural chapter/page boundaries.
// Text-only planning. The immutable PDF and scanner photographs are never mutated.
import {allocateExactLetterBudgets,studyLetters} from './studyPillarV38.js';

export const BULK_INPUT_TOKEN_CEILING=900000;
export const BULK_OUTPUT_TOKEN_CEILING=50000;
const MAX_REQUEST_CHARS=1200000;
const LEVELS=new Set(['summary','50','40','30','20','10']);
const numeric=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
const clean=v=>String(v??'').trim();

export function bookUnitsV51(book){
  const units=[];
  const chapters=book?.chapters||[];
  for(let ci=0;ci<chapters.length;ci++){
    const ch=chapters[ci];
    for(let pi=0;pi<(ch.paragraphs||[]).length;pi++){
      const p=ch.paragraphs[pi];
      const source=clean(p?.original);
      if(!source)throw Object.assign(new Error('Paragrafo originale vuoto: verifica il PDF prima di elaborare.'),{code:'SOURCE_EMPTY'});
      const start=numeric(p.sourcePageStart)||numeric(ch.pageStart);
      const end=numeric(p.sourcePageEnd)||numeric(ch.pageEnd)||start;
      if(!start||!end||end<start)throw Object.assign(new Error('Riferimento alla pagina originale non verificato.'),{code:'SOURCE_PAGE_UNCERTAIN'});
      units.push({id:ci+':'+pi,ci,pi,source,pageStart:start,pageEnd:end,
        chapterTitle:clean(ch.title),sectionTitle:clean(p.sourceSection)});
    }
  }
  if(!units.length)throw Object.assign(new Error('Nessun testo originale utilizzabile.'),{code:'SOURCE_EMPTY'});
  return units;
}
export function naturalBoundaryV51(units,i){
  if(i===units.length-1)return true;
  const a=units[i],b=units[i+1];
  // Never divide a source page midway or break a paragraph spanning pages.
  return a.ci!==b.ci || (a.pageEnd<b.pageStart);
}
function estimatedTokens(units,level){
  const letters=units.reduce((n,x)=>n+studyLetters(x.source),0);
  const chars=units.reduce((n,x)=>n+x.source.length,0);
  const ratio=level==='summary'?0.44:1-Number(level)/100;
  // Deliberately conservative Italian/JSON estimate, including IDs and thinking.
  return {input:Math.ceil(chars/2)+units.length*120+1200,
    output:Math.ceil(chars*ratio/1.5)+units.length*115+1800,
    chars};
}
export function assignBudgetsV51(units,level){
  const sources=units.map(x=>x.source);
  const caps=allocateExactLetterBudgets(sources,50);
  const targets=level==='summary'?caps:
    allocateExactLetterBudgets(sources,Number(level));
  return units.map((u,i)=>({...u,targetLetters:level==='summary'?null:targets[i],
    summaryCapLetters:Math.max(0,caps[i]-(level==='summary'&&i===0?1:0))}));
}
export function planNaturalBlocksV51(units,level,{
  maxInputTokens=BULK_INPUT_TOKEN_CEILING,
  maxOutputTokens=BULK_OUTPUT_TOKEN_CEILING
}={}){
  if(!LEVELS.has(String(level)))throw new Error('Livello sconosciuto.');
  const bounded=assignBudgetsV51(units,String(level));
  const blocks=[];
  let start=0;
  while(start<bounded.length){
    let lastSafe=-1;
    for(let i=start;i<bounded.length;i++){
      const candidate=bounded.slice(start,i+1);
      const estimate=estimatedTokens(candidate,String(level));
      if(estimate.input>maxInputTokens||estimate.output>maxOutputTokens||
         estimate.chars>MAX_REQUEST_CHARS)break;
      if(naturalBoundaryV51(bounded,i))lastSafe=i+1;
    }
    if(lastSafe<=start)throw Object.assign(new Error('Una pagina o sezione integra supera la capacità sicura: impossibile tagliarla a metà.'),{code:'NATURAL_BOUNDARY_REQUIRED'});
    blocks.push(bounded.slice(start,lastSafe));
    start=lastSafe;
  }
  return blocks;
}
export function bisectAtNaturalBoundaryV51(block){
  let best=-1,score=Infinity;
  for(let i=0;i<block.length-1;i++){
    if(!naturalBoundaryV51(block,i))continue;
    const left=block.slice(0,i+1).reduce((n,x)=>n+x.source.length,0);
    const right=block.slice(i+1).reduce((n,x)=>n+x.source.length,0);
    const cost=Math.abs(left-right);
    if(cost<score){score=cost;best=i+1;}
  }
  return best>0?[block.slice(0,best),block.slice(best)]:null;
}
export function blockLetterTargetV51(block,level){
  if(level==='summary')return {targetLetters:null,
    summaryCapLetters:block.reduce((n,u)=>n+u.summaryCapLetters,0)};
  return {targetLetters:block.reduce((n,u)=>n+u.targetLetters,0),
    summaryCapLetters:null};
}
