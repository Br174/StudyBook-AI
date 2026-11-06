import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPrecisionEdition } from '../src/lib/precisionCore.js';
import { countLetters } from '../src/lib/studyQualityGuard.js';
import {
  inspectChapterBoundaries, stripConfirmedNextHeading,
  auditChapterOutput, chapterMeasuredStats,
} from '../src/lib/chapterFidelityV33.js';

const intro = [
  'La teoria generale del diritto descrive i principi, le norme e i rapporti fra le istituzioni.',
  ...Array.from({length:14},(_,i)=>'La spiegazione '+(i+1)+' sviluppa la struttura del diritto, la gerarchia delle fonti e la necessità di analizzare le condizioni rilevanti prima di trarre una conclusione.'),
].join(' ');
const main = Array.from({length:80},(_,i)=>({
  original:[
    'Il diritto distingue la fonte primaria dalle fonti secondarie in base alla competenza del soggetto che emana la disposizione.',
    'La differenza fra le fonti riguarda la validità e il funzionamento dei criteri interpretativi nella pratica giuridica.',
    'Il principio della legalità interviene in situazioni specifiche e orienta l’interpretazione delle norme.',
    'Salvo le eccezioni previste dalla legge, la procedura conserva le garanzie e richiede una verifica dei requisiti.',
  ].join(' '),
}));
const book={chapters:[
  {title:'Introduzione',paragraphs:[{original:intro}]},
  {title:'Il diritto naturale',paragraphs:main},
]};
const byLevel=new Map([0,10,20,30,40,50].map(level=>[level,buildPrecisionEdition(book,level)]));
const short20=byLevel.get(20).chapters[0],short50=byLevel.get(50).chapters[0];
const long20=byLevel.get(20).chapters[1],long50=byLevel.get(50).chapters[1];
assert.ok(short20.precisionChapter.resultingLetters>countLetters(intro)*.70,
  '20% cannot destroy 94% of the introduction');
assert.ok(short50.precisionChapter.resultingLetters>countLetters(intro)*.46,
  '50% must retain at least ~47% of the introduction');
assert.ok(short50.precisionChapter.resultingLetters<short20.precisionChapter.resultingLetters,
  '20 and 50 must have distinct meaningful output on a reducible introduction');
assert.ok(long20.precisionChapter.resultingLetters>long50.precisionChapter.resultingLetters,
  'Long chapter cannot stay frozen at identical 20 and 50 text');
for(const [level,edition] of byLevel.entries()) {
  assert.equal(edition.precisionEdition.level,level);
  for(const chapter of edition.chapters) {
    const stats=chapter.precisionChapter;
    assert.equal(stats.originalLetters,(chapter.paragraphs||[]).reduce((n,p)=>n+countLetters(p.original),0));
    assert.equal(stats.resultingLetters,(chapter.paragraphs||[]).reduce((n,p)=>n+countLetters(p.summary),0));
    assert.ok(stats.achievedPercent<=level+3.1,
      'Never over-reduce chapter beyond its own requested budget');
    assert.ok(chapter.paragraphs.every(p=>p.original));
  }
}
assert.ok(byLevel.get(50).chapters[1].paragraphs.every(p=>p.summary.includes('Salvo le eccezioni previste dalla legge')),
  'Legal exceptions remain present across each paragraph');

const bad={chapters:[
  {title:'Introduzione',paragraphs:[{original:'La teoria generale costituisce una riflessione importante e mediante'}]},
  {title:'1. Noi parliamo di DIRITTO POSITIVO',paragraphs:[
    {original:', ossia il diritto posto in essere dai consociati validamente e descritto come tale.'},
  ]},
]};
const broken=buildPrecisionEdition(bad,50);
assert.equal(broken.chapters[0].precisionChapter.sourceReady,false);
assert.equal(broken.chapters[1].precisionChapter.sourceReady,false);
assert.equal(broken.chapters[0].precisionChapter.achievedPercent,0);
assert.equal(broken.chapters[1].precisionChapter.achievedPercent,0);
assert.equal(broken.chapters[0].paragraphs[0].summary,bad.chapters[0].paragraphs[0].original);
assert.equal(broken.chapters[1].paragraphs[0].summary,bad.chapters[1].paragraphs[0].original);
assert.ok(broken.precisionEdition.qualityGuard.sourceBlockedChapters>=2);
assert.ok(auditChapterOutput([{summary:'Testo completo che termina con mediante'}]).issues.includes('generated-dangling-end'));

const leaked='La validità deriva dall’interpretazione delle norme. Cap.3: L’ordinamento giuridico';
const recovered=stripConfirmedNextHeading(leaked,'3. L’ordinamento giuridico');
assert.equal(recovered.moved,true);
assert.equal(recovered.text,'La validità deriva dall’interpretazione delle norme.');
assert.equal(stripConfirmedNextHeading(leaked,'4. Diritto europeo').moved,false);
const chapters=[
  {title:'2. Il diritto naturale',paragraphs:[{original:leaked}]},
  {title:'3. L’ordinamento giuridico',paragraphs:[{original:'Il diritto comprende una pluralità di disposizioni e principi.'}]},
];
const audit=inspectChapterBoundaries(chapters);
assert.ok(audit.findings.some(f=>f.type==='next-chapter-heading-in-body'));
const fixed=buildPrecisionEdition({chapters},20);
assert.ok(!fixed.chapters[0].paragraphs[0].summary.includes('Cap.3: L’ordinamento giuridico'));
assert.equal(fixed.chapters[0].paragraphs[0].original,leaked);
assert.ok(!fixed.chapters[0].precisionChapter.outputAudit.issues.includes('next-heading-still-in-text'));

const quality=readFileSync(new URL('../src/components/StudyMode.jsx',import.meta.url),'utf8');
assert.ok(quality.includes('Riduzione reale di questo capitolo'));
assert.ok(quality.includes('Capitolo non pronto per lo studio'));
assert.ok(quality.includes('sourceReady === false'));
const precision=readFileSync(new URL('../src/lib/precisionCore.js',import.meta.url),'utf8');
assert.ok(precision.includes('chapterLevelTarget(level,chapterSourceLetters)'));
assert.ok(precision.includes('sourceBoundaryAudit'));
const reprocess=readFileSync(new URL('../src/lib/libraryReprocess.js',import.meta.url),'utf8');
assert.ok(reprocess.includes('recoverSavedPageStructure'));
const parser=readFileSync(new URL('../src/lib/documentParserV09.js',import.meta.url),'utf8');
assert.ok(parser.includes('expand') || parser.includes('flatMap(line =>'));

console.log('LAB33_CHAPTER_FIDELITY_PASS',JSON.stringify({
  short20:short20.precisionChapter.achievedPercent,
  short50:short50.precisionChapter.achievedPercent,
  long20:long20.precisionChapter.achievedPercent,
  long50:long50.precisionChapter.achievedPercent,
  blockedBroken:broken.precisionEdition.qualityGuard.sourceBlockedChapters,
  headingRecovered:recovered.moved,
}));
