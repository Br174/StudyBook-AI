// LAB72 phase two: suggest SOURCE-GROUNDED corrections, never edit text locally.
// Detection is heuristic: "missing" snippets are candidates for Gemini to
// verify, not certified omissions. Original is the only trusted factual source.
import {splitSemanticUnits} from './fidelityEngine.js';
import {studyLetters} from './studyPillarV38.js';
import {STUDY_TARGET_V67} from './studyRebalancePolicyV67.js';

const trim=s=>String(s??'').replace(/\s+/gu,' ').trim();
const common=new Set(['questa','questo','quella','quello','della','delle','dello',
 'degli','nella','nelle','quindi','anche','inoltre','perché','mentre','dove',
 'quando','dopo','prima','sono','essere','hanno','aveva','hanno','come','della',
 'senza','dalla','conseguenza','alcuni','alcune','avere','viene','vengono']);
const words=s=>[...new Set((trim(s).toLocaleLowerCase('it-IT').match(/\p{L}{4,}/gu)||[])
 .filter(w=>!common.has(w)))];
const pieces=s=>splitSemanticUnits(s).map(trim).filter(x=>studyLetters(x)>=18);
function completenessHint(sentence,draftWords){
 const ws=words(sentence);
 if(!ws.length)return {overlap:1,missing:0};
 const shared=ws.filter(w=>draftWords.has(w)).length;
 return {overlap:shared/ws.length,missing:ws.length-shared};
}
function duplicates(draft,max=3){
 const seen=new Set(),repeated=[];
 for(const piece of pieces(draft)){
  const key=trim(piece).toLocaleLowerCase('it-IT');
  if(seen.has(key)&&!repeated.includes(piece))repeated.push(piece.slice(0,260));
  seen.add(key);
  if(repeated.length>=max)break;
 }
 return repeated;
}
export function planTargetedRepairV72(source,draft,level,{maxContexts=8}={}){
 const originalLetters=studyLetters(source),observedLetters=studyLetters(draft);
 const policy=STUDY_TARGET_V67[String(level)];
 if(!policy||originalLetters<=0||observedLetters<=0)
  throw Object.assign(new Error('Bozza o fonte non disponibile per la correzione mirata'),
   {code:'TARGETED_REPAIR_SOURCE_MISSING'});
 const desiredLetters=Math.round(originalLetters*(1-policy.target/100));
 const minLetters=Math.ceil(originalLetters*(1-policy.max/100));
 const maxLetters=Math.floor(originalLetters*(1-policy.min/100));
 const gapLetters=desiredLetters-observedLetters;
 const direction=observedLetters<minLetters?'expand':
  observedLetters>maxLetters?'condense':'review';
 const vocabulary=new Set(words(draft));
 const omitted=pieces(source)
  .map((sentence,index)=>({sentence,index,...completenessHint(sentence,vocabulary)}))
  // Do not falsely claim semantic omission. Offer likely unseen ORIGINAL passages.
  .filter(x=>x.overlap<0.52&&x.missing>=2)
  .sort((a,b)=>a.overlap-b.overlap||a.index-b.index)
  .slice(0,Math.max(0,Math.min(8,maxContexts)))
  .sort((a,b)=>a.index-b.index)
  .map(x=>x.sentence.slice(0,340));
 return {
  originalLetters,observedLetters,desiredLetters,minLetters,maxLetters,
  gapLetters,direction,
  sourceContexts:direction==='expand'?omitted:[],
  repeatedDraftContexts:direction==='condense'?duplicates(draft):[],
  // The model decides whether a hint is truly absent by comparing meanings.
  evidenceStatus:'lexical-clues-only-not-semantic-proof'
 };
}
export function targetedRepairSummaryV72(plan){
 if(plan.direction==='expand')return 'La bozza ha '+plan.observedLetters+
   ' lettere; occorrono circa '+plan.desiredLetters+' (mancano '+plan.gapLetters+
   '). Recupera SOLO spiegazioni e distinzioni effettivamente presenti nell’originale; '+
   'i passaggi indicati sono indizi da verificare semanticamente, non frasi da copiare automaticamente.';
 if(plan.direction==='condense')return 'La bozza ha '+plan.observedLetters+
   ' lettere; occorrono circa '+plan.desiredLetters+' (eccedenza '+(-plan.gapLetters)+
   '). Condensa ripetizioni reali, introduzioni superflue e passaggi ridondanti, '+
   'senza perdere definizioni, condizioni, esempi necessari o fatti protetti.';
 return 'La lunghezza è già nella fascia: preserva questa unità, a meno che '+
   'la fedeltà al testo originale richieda una correzione verificabile.';
}
