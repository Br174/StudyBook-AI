// LAB67: protect canonical notations and verbatim law quotations.
// Exact source remains authoritative. This is a high-precision guard for
// literals, not a general claim that a paraphrase preserves all meaning.
import {extractProtectedItems,normalizeFidelityText} from './fidelityEngine.js';
const compact=s=>normalizeFidelityText(s).replace(/\s*([=+×÷≤≥≈<>])\s*/gu,'$1');
// Formula parsing must stop at the expression. In particular, never
// consume the explanatory sentence following an equation's final period.
const atom=String.raw`(?:[A-Za-zΑ-Ωα-ω][\p{L}\p{N}₀-₉⁰-⁹²³_]{0,16}|\d+(?:[.,]\d+)?)`;
const expression=atom+String.raw`(?:\s*[+−×÷*/^]\s*`+atom+')*';
const formulaPattern=new RegExp(String.raw`(?<!\p{L})`+
 expression+String.raw`\s*[=≈≤≥≠]\s*`+expression,'gu');
const formulas=s=>[...String(s||'').matchAll(formulaPattern)]
 .map(m=>m[0].trim()).filter(x=>x.length>=4);
const quotePattern=/[«“"]([^»”"\n]{8,400})[»”"]/gu;
const lawContext=/(?:\bart(?:icolo)?\.?\s*\d+|\blegge\b|\bdecreto\b|\bcodice\b|\bcostituzione\b|\bnorma\b|\bregolamento\b)/iu;
export function immutableFragmentsV67(source){
 const text=String(source||'');
 const pieces=[];
 for(const value of formulas(text))pieces.push({kind:'formula',value});
 for(const item of extractProtectedItems(text)){
  if(item.kind==='legal-ref')
   pieces.push({kind:'legal-reference',value:item.value});
 }
 for(const match of text.matchAll(quotePattern)){
  const near=text.slice(Math.max(0,match.index-115),match.index);
  if(lawContext.test(near)||lawContext.test(match[1]))
   pieces.push({kind:'normative-quotation',value:match[1]});
 }
 const seen=new Set();
 return pieces.filter(x=>{
  const key=x.kind+':'+compact(x.value);
  if(seen.has(key))return false;
  seen.add(key);
  return true;
 }).slice(0,80);
}
export function immutableViolationsV67(source,result,{
 requireNormativeQuotation=false,requireLegalReference=true
}={}){
 const out=String(result||'');
 const normalized=compact(out);
 const sourceFragments=immutableFragmentsV67(source);
 const violations=[];
 for(const frag of sourceFragments){
  if(frag.kind==='normative-quotation'&&!requireNormativeQuotation){
   // A concise version may omit a verbatim quotation entirely,
   // but may not fabricate or silently change its quoted wording.
   continue;
  }
  if(frag.kind==='legal-reference'&&!requireLegalReference)continue;
  if(!normalized.toLocaleLowerCase('it-IT').includes(
      compact(frag.value).toLocaleLowerCase('it-IT')))
   violations.push({kind:frag.kind,value:frag.value});
 }
 // Never allow the model to introduce an article number not in the source.
 const legalOriginal=new Set(sourceFragments.filter(x=>x.kind==='legal-reference')
   .map(x=>compact(x.value).toLocaleLowerCase('it-IT')));
 for(const x of immutableFragmentsV67(out).filter(x=>x.kind==='legal-reference')){
  if(!legalOriginal.has(compact(x.value).toLocaleLowerCase('it-IT')))
   violations.push({kind:'invented-legal-reference',value:x.value});
 }
 // Explicit quotations of a source law must remain exact. If the response
 // quotes a different normative passage not found in the original, flag it.
 const srcNorm=new Set(sourceFragments.filter(x=>x.kind==='normative-quotation')
  .map(x=>compact(x.value)));
 for(const x of immutableFragmentsV67(out).filter(x=>x.kind==='normative-quotation')){
  if(!srcNorm.has(compact(x.value)))
   violations.push({kind:'altered-normative-quotation',value:x.value});
 }
 return violations;
}
