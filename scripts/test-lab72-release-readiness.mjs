// LAB72 release gate: independent configuration contract, no Gemini calls.
import assert from 'node:assert/strict';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';
import {planTargetedRepairV72} from '../src/lib/studyTargetedRepairV72.js';
const ranges={summary:[55,65],'50':[48,52],'40':[38,42],
 '30':[28,32],'20':[18,22],'10':[8,12]};
for(const [level,b] of Object.entries(ranges))
 assert.deepEqual([STUDY_TARGET_V67[level].min,STUDY_TARGET_V67[level].max],b);
assert.equal(STUDY_DRAFT_PROTOCOL_V72,'lab72-canonical-range-observability-v1');
const source=('Definizioni, condizioni, eccezioni e ragionamenti rimangono nella spiegazione. ').repeat(12);
const shortened=source.slice(0,Math.floor(source.length*.6));
const plan=planTargetedRepairV72(source,shortened,'10');
assert.ok(plan.localEdit&&plan.localEdit.originalSpan);
assert.equal(plan.aimedReduction,9);
console.log('LAB72_RELEASE_READINESS_OK six strict ranges, targeted source patch, original content remains authoritative; real-device and five other real model levels PENDING');
