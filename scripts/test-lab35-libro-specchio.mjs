import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as pdfjsLib from 'pdfjs-dist';
import {buildCanonicalBookMap,auditMirrorAgainstSource,composeMirrorPages,
  mirrorPageStatistics} from '../src/lib/libroSpecchioV35.js';
import {inspectPdfVisualOperators} from '../src/lib/visualMirrorV35.js';
import {choosePdfChapterAuthority} from '../src/lib/outlineAuthorityV35.js';

const samplePages=Array.from({length:29},(_,i)=>({
  pageNumber:i+1,status:'verified',text:
    ((i%4===0)?('Cap.'+(Math.floor(i/4)+1)+': Libro '+(Math.floor(i/4)+1)+'\\n'):'')
    +'Titolo '+(i+1)+' del testo originale. Contenuto del capitolo.',
}));
const old29=samplePages.map((p,i)=>({
  title:(i+1)+'. Sezione '+(i+1),pageStart:i+1,pageEnd:i+1,
  paragraphs:[p.text],paragraphMeta:[{pageStart:i+1,pageEnd:i+1}],sections:[],
}));
const sevenRoots=Array.from({length:7},(_,i)=>({
  title:'Cap.'+(i+1)+': Libro '+(i+1),pageNumber:i*4+1,depth:1,
}));
const validatedOutline=choosePdfChapterAuthority(samplePages,old29,sevenRoots);
assert.equal(validatedOutline.chapters.length,7);
assert.equal(validatedOutline.authority,'pdf-outline-verified');
assert.equal(validatedOutline.chapters.reduce((sum,c)=>sum+c.paragraphs.length,0),29);
const unverifiedOutline=choosePdfChapterAuthority(samplePages,old29,
  sevenRoots.map(row=>({...row,title:'Titolo inventato'})));
assert.equal(unverifiedOutline.chapters.length,29,
  'Never enforce unverified PDF bookmarks');

const paragraphs=Array.from({length:29},(_,i)=>
  'Principio '+(i+1)+': una regola importante deve restare completa e comprensibile nel libro di studio.');
const sourcePages=Array.from({length:8},(_,i)=>({
  pageNumber:i+1,status:'verified',text:'Capitolo '+(i+1)+'\n'+(paragraphs[i]||''),
}));
const chapters=Array.from({length:7},(_,i)=>({
  title:'Cap.'+(i+1)+': Titolo originale '+(i+1),
  pageStart:i+1,pageEnd:i+1,
  sections:Array.from({length:i===0?29:0},(_,j)=>({
    title:(j+1)+'. Sezione originale '+(j+1),level:2,pageStart:i+1,
  })),
  paragraphs:[paragraphs[i]],
}));
const outline=chapters.map(c=>({title:c.title,pageNumber:c.pageStart,depth:1}));
const map=buildCanonicalBookMap({
  pages:sourcePages,chapters,outline,pageLabels:sourcePages.map(p=>String(p.pageNumber)),
  pageDimensions:sourcePages.map((p,i)=>({widthPt:i%2?612:595.28,heightPt:i%2?792:841.89})),
  originalFingerprint:'a'.repeat(64),pdfPageCount:8,
});
assert.equal(map.chapters.length,7,'7 chapter roots stay 7, not 29');
assert.equal(map.pages[0].heightPt,841.89);
assert.equal(map.pages[1].widthPt,612,'Original paper dimensions are immutable');
assert.equal(map.chapters[0].sections.length,29,'29 section headers remain sections, not chapter roots');
assert.equal(map.structuralStatus,'source-mapped');
const book={
  chapters:chapters.map((c,i)=>({...c,paragraphs:[{
    original:paragraphs[i],summary:'Un principio importante resta valido.',
    simpleSummary:'Regola fondamentale.',
    sourcePageStart:i+1,sourcePageEnd:i+1,sourceSection:c.sections[0]?.title||null,
  }]})),canonicalBookMap:map,
};
assert.equal(auditMirrorAgainstSource(map,book).valid,true);
const standard=composeMirrorPages(map,book,{variant:'study',maxLines:43});
const shortened=composeMirrorPages(map,book,{variant:'simple',maxLines:43});
assert.deepEqual(standard.pages.filter(p=>p.kind==='text').map(p=>p.sourcePage),
  shortened.pages.filter(p=>p.kind==='text').map(p=>p.sourcePage));
assert.equal(standard.pages[0].label,'1');
assert.equal(standard.pages[1].widthPt,612,'Mirror page follows physical original paper');
assert.equal(standard.pages.filter(p=>p.kind==='image').length,0);
assert.equal(standard.pages.find(p=>p.sourcePage===4).label,'4');
assert.equal(standard.pages.length,8,'Short text must leave free space, not merge pages');

const altered={...book,chapters:book.chapters.map((c,i)=>i===2?{...c,title:'Titolo inventato'}:c)};
assert.equal(auditMirrorAgainstSource(map,altered).valid,false);
assert.ok(auditMirrorAgainstSource(map,altered).problems.some(x=>x.startsWith('chapter-title-changed')));

const longText='Argomento scientifico completo e non inventato. '.repeat(70);
const twoPages=[{pageNumber:3,status:'verified',text:longText},
  {pageNumber:4,status:'verified',text:'Testo originale della pagina 4.'}];
const twoCh=[{title:'Capitolo 3',pageStart:3,pageEnd:3,sections:[],paragraphs:[longText]},
  {title:'Capitolo 4',pageStart:4,pageEnd:4,sections:[],paragraphs:['Testo originale della pagina 4.']}];
const longMap=buildCanonicalBookMap({pages:[
  {pageNumber:1,status:'verified',text:'Copertina'},{pageNumber:2,status:'verified',text:'Indice'},
  ...twoPages],chapters:twoCh,originalFingerprint:'b'.repeat(64),pdfPageCount:4});
const longBook={chapters:twoCh.map((ch,i)=>({...ch,
  paragraphs:[{original:ch.paragraphs[0],summary:ch.paragraphs[0],sourcePageStart:i+3}]}))};
const longLayout=composeMirrorPages(longMap,longBook,{maxLines:12,wrapLines:text=>
  String(text).match(/.{1,55}/g)||['']});
const page3=longLayout.pages.filter(p=>p.kind==='text'&&p.sourcePage===3);
assert.ok(page3.length>=2,'Overflow must produce a bis leaf');
assert.equal(page3[0].label,'3');
assert.equal(page3[1].label,'3 bis');
assert.equal(longLayout.pages.find(p=>p.sourcePage===4).label,'4',
  'Source page 4 must never be shifted by overflow of page 3');

const figures=Array.from({length:100},(_,i)=>({
  id:'pdf:3:figure:'+(i+1),type:'image',kind:'raster',sourcePage:3,
  imageNumber:i+1,rect:[0.1,0.1,0.9,0.7],relativeTextPosition:0.5,
  positionConfidence:'approximate',
}));
const imageMap=buildCanonicalBookMap({pages:[
  {pageNumber:1,status:'verified',text:''},{pageNumber:2,status:'verified',text:''},
  {pageNumber:3,status:'verified',text:longText},{pageNumber:4,status:'verified',text:'pagina quattro'},
],chapters:twoCh,visualAnchors:figures,originalFingerprint:'b'.repeat(64),pdfPageCount:4});
const studyImageLayout=composeMirrorPages(imageMap,longBook,{variant:'study',maxLines:300});
assert.equal(studyImageLayout.pages.filter(x=>x.kind==='image').length,0,
  'LAB51: no photos in the processed study book');
const imageLayout=composeMirrorPages(imageMap,longBook,{variant:'reference',maxLines:300});
assert.equal(imageLayout.pages.filter(x=>x.kind==='image'&&x.sourcePage===3).length,100);
assert.equal(imageLayout.pages.find(x=>x.kind==='image').label,'3/1');
assert.equal(imageLayout.pages.filter(x=>x.kind==='image').at(-1).label,'3/100');
assert.equal(imageLayout.pages.find(x=>x.sourcePage===4).label,'4');
assert.ok(imageLayout.pages.find(x=>x.kind==='text'&&x.sourcePage===3)
  .blocks.some(x=>x.kind==='image-ref'&&x.text.includes('Immagine 1')));
assert.equal(imageMap.uncertain.includes('figure-position-requires-review'),true,
  'Exact visual positioning must not be certified from estimated text order');

const operators=inspectPdfVisualOperators({
  fnArray:[pdfjsLib.OPS.save,pdfjsLib.OPS.transform,pdfjsLib.OPS.paintImageXObject,pdfjsLib.OPS.restore],
  argsArray:[[],[40,0,0,40,10,100],['img-1'],[]],
},{pageNumber:3,viewport:{
  width:200,height:300,transform:[1,0,0,-1,0,300],
},textItems:[{str:'Parte introduttiva',transform:[1,0,0,1,0,250]}]});
assert.equal(operators.anchors.length,1);
assert.equal(operators.anchors[0].sourcePage,3);
const sample=mirrorPageStatistics({
  originalWords:2000,resultWords:1500,originalLetters:10000,resultLetters:7500,
  originalLines:125,resultLines:97,
});
assert.equal(sample.wordsSaved,500);
assert.equal(sample.linesSaved,28);
assert.equal(sample.achievedPercent,25);

for(const path of ['src/lib/readPdfMirrorV35.js','src/lib/exportMirrorV35.js',
  'src/components/MirrorReaderV35.jsx']){
  const code=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.ok(code.includes('canonicalBookMap')||code.includes('composeMirrorPages'));
}
const exportCode=readFileSync(new URL('../src/lib/exportMirrorV35.js',import.meta.url),'utf8');
assert.ok(exportCode.includes('withPdfMirrorRenderer'));
assert.ok(exportCode.includes("if(all[i].kind==='image')"));
console.log('LAB35_LIBRO_SPECCHIO_PASS',JSON.stringify({
  originalChapters:7,originalSections:29,
  standardSourcePages:standard.pages.length,
  imageSheets:100,overflowSheets:page3.length,unchangedPage4:true
}));
