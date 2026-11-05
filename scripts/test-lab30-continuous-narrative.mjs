import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrecisionEdition } from '../src/lib/precisionCore.js';
import { auditNarrativeSource, buildMeaningUnits, checkReducedParagraph, countLetters } from '../src/lib/studyQualityGuard.js';

// Reproduce real user's damaged legal text. The app may NOT certify these OCR
// fragments as corrected or make up missing narrative.
const screenshot = "dell’efficacia (essere) delle norme. delle norme. muove nell’ambito dei fatti fenomenologici. fenomenologici. diritto, cioè la condizione del diritto.";
const sourceAudit = auditNarrativeSource(screenshot);
assert.equal(sourceAudit.ok,false,'Screenshots contain suspicious OCR/segmentation fragments');
assert.ok(sourceAudit.problems.includes('starts-mid-sentence'));
const broken = buildPrecisionEdition({chapters:[{title:'Il diritto naturale',paragraphs:[{original:screenshot}]}]},50);
const brokenPart = broken.chapters[0].paragraphs[0];
assert.equal(brokenPart.summary,screenshot,'Do not synthesize plausible-looking corrupt text from broken OCR');
assert.equal(brokenPart.precisionAudit.sourceNeedsReview,true);
assert.equal(broken.precisionEdition.qualityGuard.status,'needs-review');

const coherent = [
  'La norma giuridica disciplina i comportamenti e stabilisce conseguenze per determinati fatti.',
  'Il sistema delle fonti distingue le disposizioni secondo i diversi livelli di competenza.',
  'Il procedimento richiede la verifica dei presupposti stabiliti dalla norma applicabile.',
  'La decisione dipende dall’interpretazione della regola e dalla ricostruzione dei fatti.',
  'L’ordinamento utilizza differenti strumenti per garantire la coerenza delle decisioni.',
  'Il principio generale orienta le interpretazioni senza sostituire la disposizione speciale.'
].join(' ');
const fixture = {chapters:[{title:'Principi',paragraphs:[{original:coherent}]}]};
const edition = buildPrecisionEdition(fixture,50);
const paragraph = edition.chapters[0].paragraphs[0];
assert.ok(paragraph.summary.length && paragraph.original===coherent);
assert.ok(!paragraph.summary.includes('\n• '),'Never use bullet breaks between prose sentences at 50%');
const sourceUnits = buildMeaningUnits(coherent,50);
const selected = paragraph.summary.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ö])/);
for(let index=0; index<selected.length; index++) {
  assert.equal(selected[index],sourceUnits[index].value,
    'Narrative must be a continuous prefix, never selected fragments from remote places');
}
assert.ok(countLetters(paragraph.summary)<=countLetters(coherent));
const disjoint=checkReducedParagraph(coherent,
 sourceUnits[0].value+' '+sourceUnits[2].value,
 {selectedUnits:[sourceUnits[0],sourceUnits[2]]});
assert.ok(disjoint.issues.includes('non-contiguous-narrative'),
 'Quality Guard must reject a gap in argumentation');

const study = readFileSync(new URL('../src/components/StudyMode.jsx',import.meta.url),'utf8');
const css = readFileSync(new URL('../src/studyContinuous.css',import.meta.url),'utf8');
const pdf = readFileSync(new URL('../src/lib/exportersV12.js',import.meta.url),'utf8');
assert.ok(study.includes('study-flow-narrative')&&study.includes('study-flow-fragment'));
assert.ok(!study.includes('study-paragraph-letter-count'),'No artificial counter line after each OCR chunk');
assert.ok(study.includes('study-chapter-letter-count')&&study.includes('sourceWarnings'),
 'Only end-of-chapter counter and source warning');
assert.ok(css.includes('.study-mode .study-flow-fragment .study-interactive-text'));
assert.ok(pdf.includes('coalesceReadingBlocks(chapter.blocks)'), 'HTML and PDF must join synthetic chunks');
assert.ok(pdf.includes('pageLetterStats'), 'Printed page footer stats remain');
console.log('LAB30_CONTINUOUS_NARRATIVE_PASS', {sourceAudit,
 reductionLetters:Number((100*(1-countLetters(paragraph.summary)/countLetters(coherent))).toFixed(1))});
