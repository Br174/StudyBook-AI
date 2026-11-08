import assert from 'node:assert/strict';
import {alphabeticalLettersV77,stripNumberMarkersV77,markerAuditV77,
 markInstructionV77,EXPERIMENT_MODES_V77} from '../src/lib/studyNumberingExperimentV77.js';

assert.equal(alphabeticalLettersV77('Auto 2024, è!'),5);
assert.equal(alphabeticalLettersV77('e\u0301'),1);
assert.equal(alphabeticalLettersV77('é'),1);
assert.equal(alphabeticalLettersV77('📖🔬'),0);
assert.equal(stripNumberMarkersV77('Art. 12: A⟦1⟧u⟦2⟧t⟦3⟧o⟦4⟧, 2024.'),'Art. 12: Auto, 2024.');
const sentence='La Terra gira.';
assert.equal(alphabeticalLettersV77(sentence),11);
const pass=[
 [sentence+'⟦11⟧','sentence-up',11],
 [sentence+'⟦0⟧','sentence-down',11],
 ['Auto⟦2⟧ va⟦0⟧','word-down',6],
 ['A⟦1⟧u⟦2⟧t⟦3⟧o⟦4⟧','letter-up',4]
];
for(const [annotated,mode,target] of pass){
 const audit=markerAuditV77(annotated,mode,target);
 assert.equal(audit.markersValid,true,mode+JSON.stringify(audit));
 assert.ok(markInstructionV77(mode,target,target-1,target+1,target*2).includes('⟦'));
}
assert.equal(markerAuditV77('A⟦1⟧u⟦3⟧t⟦4⟧o⟦5⟧','letter-up',4).sequenceErrors,3);
assert.ok(!markerAuditV77('A⟦1⟧uto','letter-up',4).markersValid);
assert.ok(!markerAuditV77('Auto⟦4⟧ 2024 ⟦x⟧','sentence-up',4).markersValid);
assert.deepEqual(EXPERIMENT_MODES_V77,
 ['sentence-up','sentence-down','word-down','letter-up']);
console.log('LAB77_NUMBERING_OFFLINE_PASS',
 JSON.stringify({methods:EXPERIMENT_MODES_V77.length,
 letterUnicode:'NFC',sourceDigitsSafe:true,
 markerSequenceAudited:true,noGeminiCalls:true}));
