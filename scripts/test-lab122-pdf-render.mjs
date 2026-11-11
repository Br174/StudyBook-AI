import assert from 'node:assert/strict';
import {originalExplainedPagesV122,EXPLAINED_POLICY_V122,
 auditExplainedPageV122} from '../src/lib/explainedPolicyV122.js';
import {composeExplainedSheetsV122} from '../src/lib/explainedLayoutV122.js';
import {exportExplainedPdfV122} from '../src/lib/exportExplainedPdfV122.js';
const sentence='La norma imperativa è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
const termSentence='La **(norma imperativa)** è una regola obbligatoria che non può essere eliminata da accordi tra privati.';
const pages=Array.from({length:30},(_,i)=>{
 const copies=i===4?64:2;
 return {physicalPage:i+1,label:String(i+1),sourceStatus:'verified',
  text:Array(copies).fill(sentence).join(' '),
  widthPt:595.28,heightPt:841.89};
});
const book={canonicalBookMap:{originalFingerprint:'b'.repeat(64),
 pageCount:30,pages,chapters:[{title:'Le norme',pageStart:1,pageEnd:30,
 sections:[{title:'La disciplina',pageStart:1}]}]},
 chapters:[{title:'Le norme',pageStart:1,pageEnd:30,
 paragraphs:pages.map((p,i)=>({original:p.text,sourcePageStart:i+1,
 sourcePageEnd:i+1}))}]};
const originals=originalExplainedPagesV122(book);
const results=originals.map((p,i)=>{
 const copies=i===4?32:1;
 const out={id:p.id,segments:p.segments.map(s=>({
  id:s.id,text:[termSentence,...Array(copies-1).fill(sentence)].join(' ')})),
  glossary:[{term:'norma imperativa',
   definition:'Una regola obbligatoria che non può essere eliminata da un accordo fra privati.'}]};
 const review=auditExplainedPageV122(p,out);
 assert.equal(review.ready,true,'page '+(i+1)+' issues '+review.issues.join(','));
 return {...out,sourcePage:i+1,review};
});
const full={...book,editionsV36:{
 version:EXPLAINED_POLICY_V122,sourceFingerprint:'b'.repeat(64),
 complete:true,pages:results}};
const layout=composeExplainedSheetsV122(full,{requireComplete:true});
assert.equal(layout.sourcePages,30);
assert.ok(layout.pages.length>30,'very long page must produce bis/ter continuation');
for(let i=1;i<=30;i++)assert.ok(layout.pages.some(p=>p.label===String(i)));
assert.ok(layout.pages.some(p=>p.label==='5 bis'));
assert.ok(layout.pages.some(p=>p.label==='5 tris'));
assert.ok(layout.pages.every(p=>p.rows.every(row=>
 (row.notes||[]).length===0 || row.notes.some(n=>row.text.includes('**('+n.term+')**')))),
 'Sidebar must accompany the phrase that contains the technical term');
assert.ok(layout.pages.every(p=>p.rows.some(r=>r.kind==='paragraph')||p.label==='1'));
const out=await exportExplainedPdfV122(full,'Diritto.pdf',{download:false});
const bytes=new Uint8Array(await out.blob.arrayBuffer());
assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'%PDF');
assert.ok(bytes.length>5000);
assert.equal(out.sourcePages,30);
assert.ok(out.additionalPages>=2);
console.log(JSON.stringify({test:'LAB122_PDF',passed:true,originalPages:30,
 printedSheets:out.outputPages,bis:layout.pages.filter(p=>p.label.includes('bis')).length,
 bytes:bytes.length}));
