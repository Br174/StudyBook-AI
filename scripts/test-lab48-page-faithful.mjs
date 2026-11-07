import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anchorPageEntriesV48} from '../src/lib/pageAnchorsV48.js';
import {studyPageProgressV48} from '../src/lib/studyPageProgressV48.js';
import {buildCanonicalBookMap,composeMirrorPages,auditMirrorAgainstSource,continuationLabel}
  from '../src/lib/libroSpecchioV35.js';

const originalParagraph1='La prima legge definisce il principio originario.';
const originalParagraph2='La seconda legge disciplina il procedimento amministrativo.';
const originalParagraph3='La terza legge conferma il diritto di difesa.';
const manyLines=('Procedimento, responsabilita, garanzie e diritti restano collegati. ').repeat(70);
const sourcePages=[
  {pageNumber:1,status:'verified',text:'Capitolo primo\n'+originalParagraph1,
    widthPt:612,heightPt:792,textLineGeometry:[{topPt:77},{topPt:115}]},
  {pageNumber:2,status:'verified',text:'Capitolo secondo\nSezione B\n'+originalParagraph2,
    widthPt:595.28,heightPt:841.89,textLineGeometry:[{topPt:83},{topPt:114},{topPt:510}]},
  {pageNumber:3,status:'verified',text:'Appendice\n'+originalParagraph3,
    widthPt:612,heightPt:792,textLineGeometry:[{topPt:90},{topPt:130}]},
];
const chapters=[
  {title:'Capitolo primo',pageStart:1,pageEnd:1,sections:[],
    paragraphs:[originalParagraph1]},
  {title:'Capitolo secondo',pageStart:2,pageEnd:3,
    sections:[{title:'Sezione B',level:2,pageStart:2},
      {title:'Appendice',level:2,pageStart:3}],
    paragraphs:[originalParagraph2,originalParagraph3]},
];
const source=buildCanonicalBookMap({
  pages:sourcePages,chapters,pageLabels:['1','2','3'],
  pageDimensions:sourcePages.map(x=>({widthPt:x.widthPt,heightPt:x.heightPt})),
  originalFingerprint:'f'.repeat(64),pdfPageCount:3,
});
const book={chapters:[
  {...chapters[0],paragraphs:[{original:originalParagraph1,summary:'La prima legge vale.',
    sourcePageStart:1,sourcePageEnd:1}]},
  {...chapters[1],paragraphs:[
    {original:originalParagraph2,summary:manyLines,sourcePageStart:2,sourcePageEnd:2,
      sourceSection:'Sezione B'},
    {original:originalParagraph3,summary:originalParagraph3,
      sourcePageStart:3,sourcePageEnd:3,sourceSection:'Appendice'},
  ]},
],canonicalBookMap:source};
assert.equal(auditMirrorAgainstSource(source,book).valid,true);
const lines=(text)=>String(text).match(/.{1,48}/g)||[''];
const mirror=composeMirrorPages(source,book,{maxLines:9,wrapLines:lines});
assert.equal(mirror.audit.valid,true,JSON.stringify(mirror.audit.problems));
assert.equal(mirror.pages[0].label,'1');
assert.equal(mirror.pages[0].widthPt,612);
assert.equal(mirror.pages.filter(p=>p.sourcePage===1).length,1,
  'A shorter first page must leave whitespace instead of merging into page 2');
const second=mirror.pages.filter(p=>p.sourcePage===2);
assert.ok(second.length>=3,'A long paragraph should create bis and tris pages');
assert.deepEqual(second.slice(0,3).map(p=>p.label),['2','2 bis','2 tris']);
assert.ok(second.every(p=>p.sourcePage===2),'Bis/tris must keep their original page owner');
const third=mirror.pages.find(p=>p.sourcePage===3);
assert.equal(third.label,'3','Overflow of page 2 cannot move or rename page 3');
assert.equal(third.widthPt,612);
assert.equal(third.blocks.filter(b=>b.kind==='section-title').length,1,
  'Source section heading must be on page 3 only once');
assert.equal(second.reduce((n,p)=>n+p.blocks.filter(b=>b.kind==='chapter-title').length,0),1);
assert.equal(second.reduce((n,p)=>n+p.blocks.filter(b=>b.kind==='section-title').length,0),1);
assert.equal(second.slice(1).flatMap(p=>p.blocks).filter(b=>b.kind.endsWith('-title')).length,0,
  'No spurious repeated titles on continuation sheets');
assert.ok(second[0].blocks.some(b=>b.kind==='vertical-gap'),
  'Original page text top coordinates must leave deliberate blank area');
assert.equal(mirror.pages.filter(p=>p.kind==='image').length,0);
assert.equal(continuationLabel('12',2),'12 tris');

// A title-only source page has literal source text, not a duplicate generated heading.
const frontmatter={physicalPage:1,text:'Capitolo unico',textLineGeometry:[{topPt:82}]};
const progressBook={...book,editionsV36:{activeLevel:'summary',rows:[
  [{verified:{summary:true}}],
  [{verified:{summary:false}},{verified:{summary:true}}],
]}};
const progressPages=studyPageProgressV48(progressBook,'summary');
assert.equal(progressPages.originalPageCount,3);
assert.equal(progressPages.mappedPages,3);
assert.equal(progressPages.verifiedPages,2,'One failed paragraph must not certify its source page');
assert.equal(progressPages.percent,66.67);
assert.equal(studyPageProgressV48(progressBook,'50').verifiedPages,0,
  'A completed summary must never certify the 50 percent edition');

const noBody=anchorPageEntriesV48(frontmatter,{chapters:[{title:'Capitolo unico',pageStart:1,sections:[]}]},
  [{kind:'original-page',original:'Capitolo unico',text:'Capitolo unico'}]);
assert.equal(noBody.entries.filter(x=>x.kind==='chapter-title').length,0);
const duplicateMap=buildCanonicalBookMap({pages:[{pageNumber:1,status:'verified',text:'Capitolo unico'}],
  chapters:[{title:'Capitolo unico',pageStart:1,pageEnd:1,sections:[],paragraphs:[]}],
  pageLabels:['1'],originalFingerprint:'c'.repeat(64)});
const duplicateBook={chapters:[{title:'Capitolo unico',pageStart:1,pageEnd:1,sections:[],paragraphs:[]}]};
const duplicatePage=composeMirrorPages(duplicateMap,duplicateBook).pages[0];
assert.equal(duplicatePage.blocks.length,1,'Frontmatter must not repeat the printed title');
assert.equal(duplicatePage.blocks[0].kind,'original-page');

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('src/components/HomeDashboardV16.jsx');
const studio=read('src/components/AppScreens.jsx');
const app=read('src/AppV15.jsx');
const css=read('src/appShellV16.css');
const mirrorReader=read('src/components/MirrorReaderV35.jsx');
const pdf=read('src/lib/exportMirrorV35.js');
const scan=read('src/lib/readPdfMirrorV35.js');
assert.ok(home.includes('onManualRecovery')&&home.includes('sb-ia-inline-progress'));
assert.ok(studio.includes('sb-studio-inline-progress')&&studio.includes('onClick={onResumeGemini}'));
assert.ok(app.includes('geminiStalled ? requestActiveGeminiRecovery()'));
assert.ok(css.includes('.sb-home-v16 .sb-home-workspace {')&&css.includes('flex:0 0 auto'));
assert.ok(css.includes('padding-bottom:108px'));
assert.ok(mirrorReader.includes('vertical-gap'));
assert.ok(pdf.includes("block.kind==='vertical-gap'"));
assert.ok(scan.includes('textOnly:true'));
console.log('LAB48_PASS: exact immutable source page order, bis/tris, page dimensions,');
console.log('  title anchors, whitespace, no duplicate frontmatter, Home/Studio recovery, no pictures');
