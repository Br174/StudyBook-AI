// LAB118 OFFLINE tests: deterministic trace IDs, exact repetition only,
// no false evidence or claim conflation, 0 Gemini calls.
import assert from 'node:assert/strict';
import {prepareSourceTiersV116} from '../src/lib/studySourceTiersV116.js';
import {buildClaimLedgerV118,inspectClaimMacrosV118,deriveClaimEvidenceLocallyV118,
 inspectPartialGeminiReplyV118,
 composeAndAuditClaimsV118,claimPromptV118,claimUserV118}
 from '../src/lib/studyClaimLedgerV118.js';
const sent='Il programma registra i libri e mostra il titolo richiesto.';
const source=Array(10).fill(sent).join(' ');
const units=Array.from({length:4},(_,i)=>({
 id:'unit:'+i,source,pageStart:i+1,pageEnd:i+1
}));
const plan=prepareSourceTiersV116(units);
const ledger=buildClaimLedgerV118(plan);
let checks=0;
const eq=(x,y,m)=>{assert.deepEqual(x,y,m);checks++};
const ok=(x,m)=>{assert.ok(x,m);checks++};
eq(ledger.totalClaims,40);eq(ledger.uniqueClaims,4);
eq(ledger.exactDuplicates,36);
eq(ledger.units[0].claims[0].duplicateOf,null);
eq(ledger.units[0].claims[5].duplicateOf,'unit:0:C1');
const prompt=claimPromptV118(plan,ledger);
ok(prompt.includes('quote=""'));
const user=claimUserV118(plan,ledger);
eq(user.units.length,4);
eq(user.units[0].sourceClaims.length,10);
const makeReply=(p,{missing=false,fakeQuote=false}={})=>({
 units:p.units.map((u,i)=>{
  const allClaims=ledger.units[i].claims;
  const quote=(c,k)=>missing&&k===0&&i===0?'':fakeQuote&&k===0&&i===0?
   'testo inesistente nella macro':sent;
  return{
   id:u.id,
   variants:u.segments.map(s=>({compact:s.original,brief:s.original,
    importance:5,essential:true})),
   macro50:Array(5).fill(sent).join(' '),
   macroSummary:Array(4).fill(sent).join(' '),
   claimEvidence50:allClaims.map((c,k)=>({id:c.id,quote:quote(c,k)})),
   claimEvidenceSummary:allClaims.map(c=>({id:c.id,quote:sent}))
  };
 })
});
const perfect=makeReply(plan);
const audit=inspectClaimMacrosV118(plan,perfect);
eq(audit.completePreliminaryUnits,4);
ok(audit.units.every(u=>u.levels['50'].preliminaryPass));
ok(audit.units.every(u=>u.levels.summary.preliminaryPass));
const composed=composeAndAuditClaimsV118(plan,perfect);
eq(composed.quality['50'].achievedReduction,50);
eq(composed.quality.summary.achievedReduction,60);
eq(composed.approvedForApp,false);
eq(composed.semanticCertified,false);
eq(composed.additionalGeminiCalls??0,0);
eq(composed.claimAudit.completePreliminaryUnits,4);
// Ignore model-provided evidence completely; extract quotes only from
// the text actually present in the reduced edition.
const wrongProof=makeReply(plan,{fakeQuote:true});
const derived=deriveClaimEvidenceLocallyV118(plan,wrongProof);
eq(derived.allPreliminaryPass,true);
eq(derived.units[0].levels['50'].claims[0].quoteIsSubstringOfActualOutput,true);
eq(derived.units[0].levels['50'].modelSuppliedEvidenceIgnored,true);
const truncated=makeReply(plan);
truncated.units[0].variants=truncated.units[0].variants.slice(0,2);
const partial=inspectPartialGeminiReplyV118(plan,truncated);
eq(partial.allEditCountsValid,false);
eq(partial.counts[0].sourceFallbackRequired,true);
eq(partial.counts[0].expectedSentenceEdits,10);
eq(partial.counts[0].suppliedSentenceEdits,2);
eq(partial.automaticGeminiCorrections,0);
eq(partial.approvedForApp,false);
const missing=inspectClaimMacrosV118(plan,makeReply(plan,{missing:true}));
eq(missing.units[0].levels['50'].preliminaryPass,false);
eq(missing.units[0].levels['50'].evidence.missingRequired,1);
const invented=inspectClaimMacrosV118(plan,makeReply(plan,{fakeQuote:true}));
eq(invented.units[0].levels['50'].preliminaryPass,false);
ok(invented.units[0].levels['50'].evidence.claimResults[0].state==='QUOTE_NOT_IN_MACRO');
const scopeSource='Il personale può prorogare il prestito solo se il libro non è prenotato. Il personale deve registrare il titolo prima del prestito.';
const riskPlan=prepareSourceTiersV116([{
 id:'scope',source:scopeSource,pageStart:1,pageEnd:1
}]);
const riskLedger=buildClaimLedgerV118(riskPlan);
eq(riskLedger.uniqueClaims,3); // 'solo se' is correctly split into its own protected claim.
eq(riskLedger.exactDuplicates,0);
ok(riskLedger.units[0].claims.some(c=>c.protectedFacts.some(x=>x.kind==='qualifier')));
const bad={units:[{
 id:'scope',variants:riskPlan.units[0].segments.map(s=>({
 compact:s.original,brief:s.original,importance:5,essential:true})),
 macro50:'Il personale può prorogare il prestito. Il personale registra il titolo.',
 macroSummary:'Il personale proroga il prestito quando vuole.',
 claimEvidence50:riskLedger.units[0].claims.map(c=>({id:c.id,quote:'Il personale'})),
 claimEvidenceSummary:riskLedger.units[0].claims.map(c=>({id:c.id,quote:'Il personale'}))
}]};
const unsafe=inspectClaimMacrosV118(riskPlan,bad);
eq(unsafe.units[0].levels['50'].preliminaryPass,false);
eq(unsafe.units[0].levels.summary.preliminaryPass,false);
ok(unsafe.units[0].levels['50'].globalSafety.bad);
ok(unsafe.units[0].levels.summary.globalSafety.bad);
const extra=structuredClone(perfect);
extra.units[0].claimEvidence50.push({id:'fake-id',quote:sent});
eq(inspectClaimMacrosV118(plan,extra).units[0].levels['50'].preliminaryPass,false);
const duplicate=structuredClone(perfect);
duplicate.units[0].claimEvidence50.push({...duplicate.units[0].claimEvidence50[0]});
eq(inspectClaimMacrosV118(plan,duplicate).units[0].levels['50'].preliminaryPass,false);
console.log(JSON.stringify({lab:'LAB118',checks,units:4,totalClaims:40,
 exactDuplicates:36,unsupportedClaimRejected:true,
 inventedEvidenceRejected:true,qualifierLossRejected:true,
 extraIdsRejected:true,duplicateIdsRejected:true,
 sourceBoundedOneReply:true,geminiCalls:0,approvedForApp:false},null,2));
