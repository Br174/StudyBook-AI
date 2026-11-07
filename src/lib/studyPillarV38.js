// StudyBook AI permanent pedagogical contract. See docs/STUDYBOOK_STUDIO_PROGRESSIVO_PILASTRO_V1.md.
// The six levels are the SAME essential concepts at increasing depth, not six unrelated extracts.
import {extractProtectedItems} from './fidelityEngine.js';

export const STUDY_PILLAR_VERSION='studybook-progressive-v38-1';
export const STUDY_ORDER=['summary','50','40','30','20','10','0'];
export const STUDY_PERCENTAGES=[10,20,30,40,50];
export const studyLetters=(value='')=>(String(value).match(/\p{L}/gu)||[]).length;
export const exactRetained=(letters,percentage)=>Math.round(Math.max(0,letters)*(1-percentage/100));
export const percentReduced=(before,after)=>before>0?Math.round((1-after/before)*1000)/10:null;
const stop=new Set(['La','Il','Lo','Gli','Le','Un','Uno','Una','In','Per','Nel','Nella','Questo',
  'Questa','Sono','Come','Quando','Articolo','Capitolo','Dopo','Prima','Tra','Con','Senza','Tale']);
// LAB42: sentence-initial capitals and generic textbook headings are not
// automatically proper names. Precise legal facts and recognized names stay
// protected; semantic faithfulness remains checked by the separate guard.
const GENERIC_CAPITALIZED_WORDS=new Set([
  'Piuttosto','Distinzione','Tuttavia','Inoltre','Dunque','Infatti','Quindi',
  'Pertanto','Viceversa','Comunque','Eppure','Anzitutto','Innanzitutto',
  'Introduzione','Conclusione','Premessa','Approfondimento','Definizione',
  'Esempio','Paragrafo','Sezione','Capitolo','Teoria','Concetto','Norma'
]);
export function coreAnchors(source){
  const text=String(source||'');
  const names=[...text.matchAll(/(?<!\p{L})\p{Lu}\p{Ll}{2,}(?!\p{L})/gu)]
    .filter(hit=>{
      const name=hit[0];
      if(stop.has(name)||GENERIC_CAPITALIZED_WORDS.has(name))return false;
      const before=text.slice(0,hit.index);
      const sentenceStart=/(?:^|[.!?:;\n]\s*)$/u.test(before);
      const after=text.slice(hit.index+name.length);
      // Both members of "Kant e Bobbio" are real co-mentioned names.
      const properPair=/^\s+(?:e|ed|o)\s+\p{Lu}\p{Ll}{2,}(?!\p{L})/u.test(after);
      return !sentenceStart||properPair;
    }).map(hit=>hit[0]);
  const acronyms=[...text.matchAll(/(?<![\p{L}\p{N}])\p{Lu}{2,8}(?![\p{L}\p{N}])/gu)]
    .map(hit=>hit[0]).filter(name=>!stop.has(name));
  const protectedFacts=extractProtectedItems(text)
    .filter(x=>['legal-ref','date-number','deadline'].includes(x.kind)).map(x=>x.value);
  return [...new Set([...protectedFacts,...acronyms,...names])].slice(0,20);
}
export function allocateExactLetterBudgets(sourceChunks,percentage){
  const lengths=sourceChunks.map(studyLetters),total=lengths.reduce((a,b)=>a+b,0);
  const exact=exactRetained(total,percentage);
  const numerator=100-percentage;
  const floors=lengths.map(n=>Math.floor(n*numerator/100));
  const remainders=lengths.map((n,i)=>({i,rem:(n*numerator)%100}));
  remainders.sort((a,b)=>b.rem-a.rem||a.i-b.i);
  let unassigned=exact-floors.reduce((a,b)=>a+b,0);
  for(let i=0;i<remainders.length&&unassigned>0;i++,unassigned--)floors[remainders[i].i]++;
  if(unassigned!==0)throw Error('Quota lettere non coerente');
  return floors;
}
export function inspectProgressiveEdition(source,text,level,{targetLetters=null,summaryCapLetters=null}={}){
  const originalLetters=studyLetters(source),outputLetters=studyLetters(text);
  const isSummary=level==='summary';
  const percent=Number(level);
  const goal=isSummary?null:(targetLetters==null?exactRetained(originalLetters,percent):targetLetters);
  const cap=isSummary?(summaryCapLetters==null?Math.max(0,exactRetained(originalLetters,50)-1):summaryCapLetters):null;
  const issues=[];
  if(!String(text||'').trim())issues.push('missing-edition');
  if(isSummary){
    if(outputLetters>cap)issues.push('summary-must-be-shorter-than-50');
  }else if(outputLetters!==goal){
    issues.push('exact-letters-target:'+goal+';actual:'+outputLetters+';delta:'+(outputLetters-goal));
  }
  const missing=coreAnchors(source).filter(item=>!String(text||'').toLocaleLowerCase('it-IT').includes(item.toLocaleLowerCase('it-IT')));
  if(missing.length)issues.push('essential-anchors-missing:'+missing.slice(0,8).join(','));
  return {verified:issues.length===0,issues,targetLetters:goal,summaryCapLetters:cap,
    originalLetters,outputLetters,achievedPercent:percentReduced(originalLetters,outputLetters),missingAnchors:missing};
}
export function assertProgressiveBook(rows,originalSources){
  // Read-only overall audit for publication, not a generation or mutation shortcut.
  return STUDY_PERCENTAGES.map(level=>{
    const sourceLetters=originalSources.reduce((n,x)=>n+studyLetters(x),0);
    const expected=exactRetained(sourceLetters,level);
    const actual=rows.reduce((n,row)=>n+studyLetters(row.editions?.[String(level)]||''),0);
    const complete=rows.every(row=>row.verified?.[String(level)]===true);
    return {level,expected,actual,complete,exact:complete&&expected===actual};
  });
}
