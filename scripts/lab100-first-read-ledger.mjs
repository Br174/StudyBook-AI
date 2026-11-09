// MotorLab LAB100 / StudyBook: one immutable first-reading fact ledger per source page.
// The model may extract claims once. StudyBook validates evidence against ORIGINAL source,
// stores that inventory, and reuses it as a reference for all six reduction levels.
// Research prototype for five synthetic pages; NOT production PDF or semantic certification.
import {createHash} from 'node:crypto';
import {budget,letters} from './lab92-stop-complete-engine.mjs';
export const LEVELS=[10,20,30,40,50,65];
export const normalize=s=>String(s||'').normalize('NFC').replace(/\s+/gu,' ').trim();
export function splitSentences(text){
 const clean=normalize(text);
 const parts=clean.match(/[^.!?]+[.!?]?/gu)||[];
 return parts.map(v=>normalize(v)).filter(Boolean).map((text,i)=>({id:'S'+(i+1),text,length:letters(text)}));
}
export function splitClauses(sentence){
 return sentence.split(/[;:]/u).map(normalize).filter(Boolean);
}
export const sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const CLAIM_KINDS=new Set(['definizione','fatto','causa','condizione','negazione','eccezione','misura','relazione','contesto']);
const importanceFlag=txt=>/\b(?:non|senza|soltanto|solo|se|può|deve|perentorio|obbligat|anche se|nonostante)\b/iu.test(txt);
const digitTokens=s=>(normalize(s).match(/\d+(?:[.,]\d+)*/gu)||[]);
function criticalMarkers(text){
 const s=normalize(text),markers=[];
 for(const [id,regexp] of [
  ['negation',/\bnon\b|\bsenza\b/iu],
  ['possibility',/\bpuò\b|\bpotrebbe\b/iu],
  ['condition',/\bse\b|\bsoltanto\b|\bsolo\b/iu],
  ['exception',/\b(?:anche se|pur|nonostante)\b/iu],
  ['obligation',/\b(?:deve|devono|obbligato|perentorio)\b/iu]
 ])if(regexp.test(s))markers.push(id);
 for(const digit of digitTokens(s))markers.push('number:'+digit);
 return markers;
}
const safeEq=(x,y)=>normalize(x)===normalize(y);
export function validateLedger(source,raw){
 const text=normalize(source.concepts.join(' '));
 const sentences=splitSentences(text);
 const errors=[],warnings=[],facts=[],coveredSentences=new Set();
 const rows=raw?.facts;
 if(!Array.isArray(rows)){errors.push('FACTS_NOT_ARRAY');return{valid:false,errors,warnings,sentences:sentences.length,facts:[],coverage:null}}
 if(rows.length<sentences.length)warnings.push('FEWER_FACTS_THAN_SENTENCES');
 if(rows.length>90)errors.push('TOO_MANY_FACTS_FOR_PAGE');
 if(rows.length===0)errors.push('NO_FACTS');
 const codes=new Set();
 for(let i=0;i<rows.length;i++){
  const f=rows[i];
  if(!f||typeof f!=='object'){errors.push('INVALID_FACT_OBJECT_'+i);continue}
  const code=String(f.id||''),sid=String(f.sourceSentence||'');
  const evidence=normalize(f.evidence),claim=normalize(f.claim);
  const sentence=sentences.find(s=>s.id===sid);
  const kind=String(f.kind||''),critical=Boolean(f.essential);
  if(!/^F\d+$/u.test(code)||codes.has(code))errors.push('BAD_OR_DUPLICATE_FACT_ID_'+i);
  codes.add(code);
  if(!sentence){errors.push('SENTENCE_ID_NOT_FOUND_'+i);continue}
  if(evidence.length<7||evidence.length>sentence.text.length+2||!sentence.text.includes(evidence)){
   errors.push('EVIDENCE_NOT_VERBATIM_IN_SENTENCE_'+i);continue;
  }
  if(claim.length<8||claim.length>320)warnings.push('BAD_CLAIM_LENGTH_'+i);
  if(!CLAIM_KINDS.has(kind))warnings.push('NONSTANDARD_KIND_'+i);
  if(evidence.length>Math.ceil(sentence.text.length*.94)&&sentence.text.length>75)
   warnings.push('OVERBROAD_EVIDENCE_'+i);
  if(!critical&&importanceFlag(evidence))warnings.push('CRITICAL_EVIDENCE_NOT_MARKED_'+i);
  if(/\b(?:the|if only|must|should|increases when|does not)\b/iu.test(claim))
   warnings.push('POSSIBLE_ENGLISH_'+i);
  coveredSentences.add(sid);
  facts.push({id:code,sourceSentence:sid,evidence,claim,kind,essential:critical});
 }
 const missingSentences=sentences.filter(s=>!coveredSentences.has(s.id)).map(s=>s.id);
 for(const id of missingSentences)errors.push('SOURCE_SENTENCE_UNCOVERED_'+id);
 let missingClauses=0;
 for(const s of sentences){
  const clauses=splitClauses(s.text),related=facts.filter(f=>f.sourceSentence===s.id);
  for(const c of clauses){
   if(c.length<12)continue;
   const hit=related.some(f=>f.evidence.includes(c)||c.includes(f.evidence)&&f.evidence.length>=Math.floor(c.length*.5));
   if(!hit){missingClauses++;warnings.push('CLAUSE_UNCOVERED_'+s.id)}
  }
 }
 // Explicitly mark source critical syntax; the anchor is only a lexical warning,
 // NOT a proof that the claim preserves the causal / modal relation.
 let criticalSegments=0,unrepresentedMarkers=0;
 const markerWarnings=[];
 for(const s of sentences){
  const markers=criticalMarkers(s.text);
  if(!markers.length)continue;
  criticalSegments++;
  const set=facts.filter(f=>f.sourceSentence===s.id).map(f=>f.claim).join(' ');
  for(const marker of markers){
   let found=true;
   if(marker==='negation')found=/\bnon\b|\bsenza\b|\bnessun\b|\besclud/iu.test(set);
   if(marker==='possibility')found=/\bpuò\b|\bpotrebbe\b|\bpossibil/iu.test(set);
   if(marker==='condition')found=/\bse\b|\bsolo\b|\bsoltanto\b|\bcondizion/iu.test(set);
   if(marker==='exception')found=/\b(?:anche se|pur|nonostante|persino)\b/iu.test(set);
   if(marker==='obligation')found=/\b(?:deve|devono|obblig|perentor|necessari)\b/iu.test(set);
   if(marker.startsWith('number:'))found=set.includes(marker.slice(7))||/[a-zàèéìíòóùú]{3,}/iu.test(set)&&digitTokens(s.text).length>0&&false;
   if(!found){unrepresentedMarkers++;markerWarnings.push(s.id+':'+marker)}
  }
 }
 if(markerWarnings.length)warnings.push(...markerWarnings.map(x=>'CRITICAL_MARKER_NOT_VISIBLE_'+x));
 const completeness={
  sourceSentences:sentences.length,representedSentences:coveredSentences.size,missingSentences,
  sourceClauseAlerts:missingClauses,criticalSourceSentences:criticalSegments,unrepresentedCriticalMarkers:unrepresentedMarkers,
  anchoredFacts:facts.length,essentialFacts:facts.filter(f=>f.essential).length,
  claimLetters:letters(facts.map(f=>f.claim).join(' ')),sourceLetters:letters(text)
 };
 const payload={schema:'LAB100_FACT_LEDGER_V1',sourceId:source.id,sourceHash:sha256(text),sentences,
  facts,completeness,validation:{errors,warnings}};
 return{valid:errors.length===0,errors,warnings,facts,completeness,payload};
}
export function makeSixPlans(source,verifiedLedger){
 const text=normalize(source.concepts.join(' '));
 if(verifiedLedger?.sourceHash!==sha256(text)||verifiedLedger?.sourceId!==source.id)
   throw Error('LEDGER_SOURCE_HASH_MISMATCH');
 if(!Array.isArray(verifiedLedger.facts)||!verifiedLedger.facts.length)throw Error('EMPTY_LEDGER');
 const factHash=sha256(JSON.stringify(verifiedLedger.facts));
 const plans=LEVELS.map(level=>{
  const b=budget(source,level);
  // Facts are NOT sent in bulk as an extra verbose prompt: they stay in the private verifier.
  return{source:source.id,level,originalLetters:b.originalLetters,targetLetters:b.targetLetters,
    band:b.band,maxRows:b.targetCap,
    ledgerHash:factHash,ledgerSourceHash:verifiedLedger.sourceHash,
    protectedFactIds:verifiedLedger.facts.filter(f=>f.essential).map(f=>f.id),
    everyFactRetainedInVerifier:true,
    requiresPostGenerationVerification:true};
 });
 if(new Set(plans.map(x=>x.ledgerHash)).size!==1)throw Error('LEDGER_NOT_REUSED_IDENTICALLY');
 return{source:source.id,factHash,plans};
}
