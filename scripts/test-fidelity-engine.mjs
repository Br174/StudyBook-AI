import assert from 'node:assert/strict';
import {
  auditFidelity,
  buildConceptInventory,
  extractProtectedItems,
  removeExactCrossParagraphRedundancy,
  repairStudyText,
} from '../src/lib/fidelityEngine.js';

const source = [
  "L'obbligazione è il rapporto giuridico in cui il debitore è tenuto a eseguire una prestazione nei confronti del creditore.",
  "La prestazione deve essere possibile, lecita, determinata o determinabile.",
  "Ai sensi dell'art. 1173 c.c., le obbligazioni derivano da contratto, fatto illecito o da ogni altro atto o fatto idoneo a produrle.",
].join(' ');

const compact = [
  "L'obbligazione è il rapporto giuridico in cui il debitore deve eseguire una prestazione verso il creditore.",
  "La prestazione deve essere possibile, lecita, determinata o determinabile.",
  "L'art. 1173 c.c. indica come fonti il contratto, il fatto illecito e ogni altro atto o fatto idoneo.",
].join(' ');

const good = auditFidelity(source, compact);
assert.ok(good.conceptCount >= 3);
assert.ok(good.protectedCount >= 1);
assert.equal(good.missingProtected.length, 0);
assert.ok(good.coveragePercent >= 80, `Copertura inattesa: ${good.coveragePercent}`);

const riskySource = "La domanda deve essere proposta entro 30 giorni, salvo che la legge preveda un termine diverso.";
const riskyOutput = "La domanda deve essere proposta tempestivamente.";
const bad = auditFidelity(riskySource, riskyOutput);
assert.equal(bad.passed, false);
assert.ok(bad.missingProtected.length >= 1);

const repaired = repairStudyText(riskySource, riskyOutput, bad);
assert.ok(repaired.recovered.length >= 1);
const after = auditFidelity(riskySource, repaired.text);
assert.equal(after.missingProtected.length, 0);

const concepts = buildConceptInventory("La regola si applica ad A e B; salvo C. Il termine è di 10 giorni.");
assert.ok(concepts.length >= 2);
assert.ok(extractProtectedItems("Ai sensi dell'art. 2043 c.c. il termine è di 10 giorni.").length >= 2);

const duplicate = "La responsabilità richiede un fatto illecito e un danno ingiusto.";
const deduped = removeExactCrossParagraphRedundancy([
  { summary: duplicate },
  { summary: `${duplicate} Il danneggiato deve provare il danno.` },
]);
assert.ok(deduped[1].summary.includes('Il danneggiato'));
assert.ok(!deduped[1].summary.startsWith(duplicate));

console.log(JSON.stringify({
  ok: true,
  coveragePercent: good.coveragePercent,
  compressionPercent: good.compressionPercent,
  recovered: repaired.recovered.length,
}, null, 2));
