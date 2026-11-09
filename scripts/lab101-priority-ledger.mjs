// MotorLab StudyBook LAB101: stable first-read priority ledger.
// All information is retained internally; "supporto" never means that a distinct
// essential concept may disappear from a study version. No model facts are sent
// twice during reduction. No final page is deemed semantically certified here.
import {sha256,makeSixPlans,validateLedger} from './lab100-first-read-ledger.mjs';
import {caseOnlyEvidenceFix} from './lab100-verify-evidence-case.mjs';

export const TIERS=Object.freeze(['fondamentale','supporto','contesto']);
export const TIERS_SET=new Set(TIERS);
const copy=x=>JSON.parse(JSON.stringify(x));
export function rankFirstRead(source,modelPayload){
 const input=modelPayload?.facts;
 if(!Array.isArray(input))return{valid:false,reason:'MISSING_FACTS',errors:['MISSING_FACTS'],warnings:[],ledger:null,plans:[]};
 const rankErrors=[],rankWarnings=[],ranked=[];
 const used=new Set();
 for(let i=0;i<input.length;i++){
  const f=input[i];
  const p=String(f?.priority||'').trim().toLocaleLowerCase('it');
  if(!TIERS_SET.has(p))rankErrors.push('INVALID_PRIORITY_'+i);
  if(used.has(String(f?.id||'')))rankErrors.push('DUPLICATE_FACT_'+i);
  used.add(String(f?.id||''));
  ranked.push({...f,priority:p,essential:p==='fondamentale'});
 }
 if(rankErrors.length)return{valid:false,reason:'BAD_PRIORITY_SCHEMA',errors:rankErrors,warnings:rankWarnings,ledger:null,plans:[]};
 // The only automatic change allowed to a quote is a source-supported case fix.
 const fixed=caseOnlyEvidenceFix(source,{facts:ranked});
 if(!fixed.valid)return{valid:false,reason:'SOURCE_EVIDENCE_INVALID',
   errors:[...fixed.validationErrors],warnings:fixed.validationWarnings,
   evidenceRepairs:fixed.changes,ledger:null,plans:[]};
 // Validation strips metadata, so we restore the priority tier on the verified
 // exact-source atom, without changing the model's claim text or source evidence.
 const verified=fixed.ledger.facts.map((f,i)=>({...f,priority:ranked[i].priority}));
 const core=verified.filter(f=>f.priority==='fondamentale').map(f=>f.id);
 const support=verified.filter(f=>f.priority==='supporto').map(f=>f.id);
 const context=verified.filter(f=>f.priority==='contesto').map(f=>f.id);
 if(!core.length)rankErrors.push('NO_FUNDAMENTAL_FACTS');
 if(source.concepts.join(' ').length>250&&verified.length>=7&&!support.length&&!context.length)
  rankWarnings.push('PRIORITY_FLAT_ALL_FUNDAMENTAL');
 if(core.length/verified.length<0.4)rankWarnings.push('LOW_CORE_SHARE_REVIEW');
 const inventory={schema:'LAB101_FIRST_READ_PRIORITY_V1',sourceId:source.id,
  sourceHash:fixed.ledger.sourceHash,
  facts:verified,
  hierarchy:{fundamental:core,support,context},
  quoteRepairs:fixed.changes,validation:fixed.ledger.validation};
 inventory.hash=sha256(JSON.stringify({sourceId:inventory.sourceId,
  sourceHash:inventory.sourceHash,facts:inventory.facts,hierarchy:inventory.hierarchy}));
 const basePlans=makeSixPlans(source,{...fixed.ledger,facts:verified});
 const plans=basePlans.plans.map(p=>({
  ...p,rankedInventoryHash:inventory.hash,
  fundamentalFactIds:[...core],supportFactIds:[...support],contextFactIds:[...context],
  fullSourceFactsAccessible:true,
  rules:{
   keepAllFundamentals:true,
   neverInventPadding:true,
   preservePolarityAndModality:true,
   supportTreatment:p.level<=10?'spiegazione_quasi_integrale':p.level<=20?'spiegazione_chiara':
    p.level<=40?'sintetica_ma_fedele':'molto_compatta',
   contextTreatment:p.level<=20?'se_utile_alla_comprensione':'non_obbligatorio',
   finalSemanticCertificationRequired:true
  }
 }));
 if(plans.length!==6||new Set(plans.map(p=>p.rankedInventoryHash)).size!==1)
   rankErrors.push('PRIORITY_CHANGED_ACROSS_LEVELS');
 return{
  valid:rankErrors.length===0,errors:rankErrors,warnings:[...fixed.validationWarnings,...rankWarnings],
  quoteRepairs:fixed.changes,ledger:inventory,plans,
  summary:{facts:verified.length,core:core.length,support:support.length,context:context.length,
   flatPriority:!support.length&&!context.length,quotedSourceSentences:fixed.detail?.representedSentences,
   sourceSentenceCount:fixed.detail?.sourceSentences,
   coreAllSixLevels:plans.every(p=>JSON.stringify(p.fundamentalFactIds)===JSON.stringify(core)),
   sourceEvidenceValid:true,semanticApproved:false}
 };
}
const tokens=s=>(String(s||'').toLocaleLowerCase('it').match(/\p{L}+/gu)||[]).filter(t=>t.length>2);
function similarity(a,b){
 const aa=new Set(tokens(a)),bb=new Set(tokens(b));if(!aa.size||!bb.size)return 0;
 let both=0;for(const t of aa)if(bb.has(t))both++;
 return both/Math.max(aa.size,bb.size);
}
export function compareCalibration(sourceId,newLedger,referenceFacts,referenceLabels){
 const ranks=newLedger?.facts||[];
 const reference=referenceFacts||[];
 const labels=referenceLabels||[];
 if(reference.length!==labels.length)throw Error('REFERENCE_LABEL_COUNT_MISMATCH');
 // Greedy 1:1 matching with source sentence and evidence word intersection.
 // Merged/split facts are flagged as unmapped rather than claimed accurate.
 const candidates=[];
 for(let i=0;i<ranks.length;i++)for(let j=0;j<reference.length;j++){
  if(ranks[i].sourceSentence!==reference[j].sourceSentence)continue;
  const score=similarity(ranks[i].evidence,reference[j].evidence);
  if(score>=0.36)candidates.push({i,j,score});
 }
 candidates.sort((a,b)=>b.score-a.score);
 const seenNew=new Set(),seenRef=new Set(),matched=[];
 for(const {i,j,score}of candidates){
  if(seenNew.has(i)||seenRef.has(j))continue;
  seenNew.add(i);seenRef.add(j);
  matched.push({newId:ranks[i].id,referenceId:reference[j].id,score:+score.toFixed(3),
   predicted:ranks[i].priority,manual:labels[j],equal:ranks[i].priority===labels[j]});
 }
 const unmatchedNew=ranks.filter((f,i)=>!seenNew.has(i)).map(f=>f.id);
 const unmatchedReference=reference.filter((f,i)=>!seenRef.has(i)).map(f=>f.id);
 const confusion={};for(const m of matched){
  const k=m.manual+'→'+m.predicted;confusion[k]=(confusion[k]||0)+1;
 }
 return{sourceId,modelAtoms:ranks.length,referenceAtoms:reference.length,
  matched:matched.length,agreed:matched.filter(m=>m.equal).length,
  mismatch:matched.filter(m=>!m.equal).length,
  unmatchedNew,unmatchedReference,confusion,matchedPairs:matched,
  limitations:'Editorial reference is subjective. Word-overlap matching is imperfect and a priority match does not prove the atom is true or that a complete book can be safely compressed.'};
}
