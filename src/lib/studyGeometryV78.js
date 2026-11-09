// StudyBook LAB78: canonical deterministic geometry between real Worker prompt
// and local quality gate, matching the LAB92/97 best-of methodology.
// 60 virtual monospaced cells is NOT a physical A4 print certification.
// This module contains NO provider calls, filler, word truncation or reflow
// of the actual draft; it computes source-anchored constraints only.
import {studyLetters} from './studyPillarV38.js';
import {pageLetterBudgetsV74} from './studyPageBudgetsV74.js';

export const STUDY_GEOMETRY_V78='lab78-real-worker-60-cell-source-pages-v1';
export const STUDY_ROW_WIDTH_V78=60;
export const STUDY_AVG_V78=Object.freeze({
 letters:46.346,naturalSpaces:7.844,justifySpaces:3.658,
 punctuation:1.966,digits:0.186
});
export function wrapStudyWordsV78(text,width=STUDY_ROW_WIDTH_V78){
 const words=String(text??'').normalize('NFC').replace(/\s+/gu,' ').trim().split(' ').filter(Boolean);
 const lines=[];
 let line='',overlong=false;
 for(const word of words){
  const n=[...word].length;
  if(n>width)overlong=true;
  if(line&&[...line].length+1+n>width){lines.push(line);line=word}
  else line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 return{rows:lines.length,lastRowCells:[...(lines.at(-1)||'')].length,
  longestRowCells:Math.max(0,...lines.map(l=>[...l].length)),overlong,
  // Only for tests/audit; never feed text content to public logs.
  lines};
}
export function largestRemainderV78(total,weights){
 if(!Number.isSafeInteger(total)||total<0||!Array.isArray(weights)||!weights.length||
  weights.some(n=>!Number.isFinite(n)||n<0))
  throw Error('LAB78_INVALID_ALLOCATION');
 const sum=weights.reduce((a,b)=>a+b,0);
 const exact=weights.map(n=>sum?total*n/sum:total/weights.length);
 const result=exact.map(Math.floor);
 let left=total-result.reduce((a,b)=>a+b,0);
 const ranked=exact.map((x,i)=>({i,frac:x-result[i]}))
  .sort((a,b)=>b.frac-a.frac||a.i-b.i);
 for(let j=0;j<left;j++)result[ranked[j].i]++;
 return result;
}
export function studyGeometryPlanV78(units,level){
 const pages=pageLetterBudgetsV74(units,String(level));
 const byId=new Map(units.map(u=>[u.id,u]));
 const groups=pages.map(p=>{
  const sourceParts=p.unitIds.map(id=>{
   const u=byId.get(id);
   if(!u)throw Error('LAB78_SOURCE_MISSING');
   return String(u.source||'').normalize('NFC').trim();
  });
  const originalText=sourceParts.join(' ');
  const sourceLayout=wrapStudyWordsV78(originalText);
  const short=sourceLayout.rows<=5;
  const rowCap=short?5:Math.ceil(p.targetLetters/STUDY_AVG_V78.letters);
  const unitTargets=largestRemainderV78(p.targetLetters,sourceParts.map(studyLetters));
  const targetNaturalSpaces=Math.round(rowCap*STUDY_AVG_V78.naturalSpaces);
  return{
   pageStart:p.pageStart,pageEnd:p.pageEnd,
   ids:p.unitIds,sourceLetters:p.originalLetters,
   targetLetters:p.targetLetters,minLetters:p.minLetters,maxLetters:p.maxLetters,
   rowWidth:STUDY_ROW_WIDTH_V78,maxRows:rowCap,originalRows:sourceLayout.rows,
   shortSource:short,
   targetNaturalSpaces, // empirical estimate, never filler requirement
   unitTargets:p.unitIds.map((id,i)=>({id,targetLetters:unitTargets[i]}))
  };
 });
 return{policy:STUDY_GEOMETRY_V78,level:String(level),width:STUDY_ROW_WIDTH_V78,
  sourceGroups:groups.length,groups};
}
export function studyGeometryPromptV78(plan){
 if(plan?.policy!==STUDY_GEOMETRY_V78)throw Error('LAB78_GEOMETRY_UNAVAILABLE');
 const guidance=[
  'METODO DI IMPAGINAZIONE LAB78, UGUALE A QUELLO DELLE PROVE MIGLIORI: 60 posizioni per riga monospaziata virtuale.',
  'Per ogni pagina originale o intervallo inseparabile il prospetto qui sotto indica il numero MASSIMO di righe, il bersaglio e la fascia di LETTERE conservate. Una riga contiene lettere, spazi, segni e cifre; nel calcolo della percentuale si contano SOLO le lettere Unicode.',
  'Scrivi testo naturale CONTINUO per ciascun id, SENZA andare a capo e SENZA spezzare parole. StudyBook dispone le parole nelle righe virtuali da 60 posizioni. NON aggiungere spazi multipli o testo di riempimento per completare le righe.',
  'Per le pagine normali mira al NUMERO CENTRALE di lettere, non a un riassunto brevissimo; la fascia ±5 punti e le righe massime sono entrambe necessarie. Nel 10% preserva circa il 90% delle lettere, nel 20% circa l 80%, nel 50% circa la metà, nel Riassunto applicativo circa il 40%.',
  'La stima di capienza dalla ricerca è circa 46,346 lettere e 7,844 spazi naturali per riga da 60 posizioni, più punteggiatura e cifre. Sono MEDIE di previsione, NON una richiesta di spazi vuoti. Mantieni parole intere, grammatica, fatti e condizioni.',
  'Per ogni gruppo le quote dei paragrafi sono una distribuzione proporzionale indicativa, non autorizzano a perdere un concetto. Il budget del gruppo di pagina ha precedenza.',
  'PROSPETTO CALCOLATO DAL TESTO ORIGINALE (riga per gruppo pagina):'
 ];
 for(const g of plan.groups){
  const part=g.ids.length>1?' ('+g.ids.length+' paragrafi indivisibili)':'';
  guidance.push('Pagina '+g.pageStart+(g.pageEnd>g.pageStart?'-'+g.pageEnd:'')+
   ': origine '+g.sourceLetters+' lettere, conserva circa '+g.targetLetters+
   ' (accettabili '+g.minLetters+'-'+g.maxLetters+'), max '+g.maxRows+
   ' righe di 60 posizioni'+part+'.');
 }
 return guidance.join('\n');
}
export function studyGeometryReviewV78(units,parts,level){
 const plan=studyGeometryPlanV78(units,level);
 const byId=new Map((parts||[]).filter(p=>typeof p?.id==='string')
  .map(p=>[p.id,p.text]));
 const groups=plan.groups.map(g=>{
  const originals=g.ids.map(id=>byId.get(id));
  const missing=originals.some(t=>typeof t!=='string'||!t.trim());
  const text=originals.filter(t=>typeof t==='string').join(' ');
  const outputLetters=studyLetters(text);
  const measured=wrapStudyWordsV78(text);
  const inBand=!missing&&outputLetters>=g.minLetters&&outputLetters<=g.maxLetters;
  const fitsRows=!missing&&measured.rows<=g.maxRows&&!measured.overlong;
  return {
   pageStart:g.pageStart,pageEnd:g.pageEnd,sourceLetters:g.sourceLetters,
   targetLetters:g.targetLetters,minLetters:g.minLetters,maxLetters:g.maxLetters,
   outputLetters,rows:measured.rows,maxRows:g.maxRows,overlong:measured.overlong,
   inBand,fitsRows,pass:inBand&&fitsRows,missing
  };
 });
 return{policy:STUDY_GEOMETRY_V78,groups,
  allNumeric:groups.every(g=>g.inBand),
  allRows:groups.every(g=>g.fitsRows),
  complete:groups.every(g=>g.pass)};
}
