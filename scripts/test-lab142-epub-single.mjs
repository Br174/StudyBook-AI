#!/usr/bin/env node
// StudyBook LAB142 — EPUB logical pages and one 50% edition.
// Fully offline; no Gemini credentials, service, Android build or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {buildEpubLogicalPagesV142,ensureEpubLogicalPagesV142,
 sha256EpubV142,EPUB_LOGICAL_CONTRACT_V142}
 from '../src/lib/epubLogicalPagesV142.js';
import {originalExplainedPagesV122,EXPLAINED_POLICY_V122}
 from '../src/lib/explainedPolicyV122.js';
import {studyUnitsV126,EXPLAINED_POLICY_V126}
 from '../src/lib/explainedStagesV126.js';
import {generateExplainedBookV126} from '../src/lib/explainedGeneratorV126.js';
import {buildEpubStudyShellV142} from '../src/lib/epubStudyShellV142.js';

globalThis.crypto??=webcrypto;
const sha='a'.repeat(64);
const paragraph=n=>
 'La norma medievale distingue le fonti del diritto e spiega la natura delle decisioni giuridiche. '
 .repeat(3)+' Paragrafo '+n+' concluso.';
const makeChap=(name,count,offset)=>({
 title:name,sections:[{title:'Sezione di '+name,level:2}],
 paragraphs:Array.from({length:count},(_,i)=>paragraph(i+offset)),
 paragraphMeta:Array.from({length:count},()=>({
  sectionTitle:'Sezione di '+name,sectionLevel:2
 }))
});
const chapters=[makeChap('Origini della giurisprudenza',150,0),
 makeChap('Scuole medievali',180,150),
 makeChap('Commentatori',110,330)];
const fullText=chapters.flatMap(c=>c.paragraphs).join('\n\n');
const source={sourceFormat:'epub',sourceTitle:'Libro EPUB',
 chapters,fullText,structure:{pageCount:0,chapterCount:3}};
const mapped=buildEpubLogicalPagesV142(source,{fingerprint:sha});
assert.ok(mapped.pages.length>=40,'The test should form many logical pages');
assert.ok(mapped.pages.length<=2000);
assert.equal(mapped.pages.map(p=>p.text).join(''),fullText,
 'Every original character must be covered exactly once, in reading order');
assert.equal(mapped.canonicalBookMap.paginationOwner,EPUB_LOGICAL_CONTRACT_V142);
assert.equal(mapped.canonicalBookMap.pageCount,mapped.pages.length);
assert.equal(mapped.structure.pageCount,mapped.pages.length);
assert.equal(mapped.structure.paginationKind,'logical-not-printed');
assert.equal(mapped.canonicalBookMap.originalFingerprint,sha);
assert.equal(mapped.canonicalBookMap.exactTextCoverage,true);
assert.ok(mapped.pages.every((p,i)=>p.pageNumber===i+1&&p.status==='verified'));
assert.ok(mapped.canonicalBookMap.pages.every((p,i)=>p.physicalPage===i+1&&
 p.sourceStatus==='verified'&&p.logicalPage===true&&p.text===mapped.pages[i].text));
assert.deepEqual(mapped.chapters.map(c=>c.title),chapters.map(c=>c.title));
assert.deepEqual(mapped.chapters.map(c=>c.paragraphs),chapters.map(c=>c.paragraphs));
assert.ok(mapped.chapters.every(c=>Number.isInteger(c.pageStart)&&
 c.pageEnd>=c.pageStart&&c.pageEnd<=mapped.pages.length));
assert.ok(mapped.chapters.every(c=>c.paragraphMeta.every(m=>
 m.pageStart>0&&m.pageEnd>=m.pageStart)));
const shell=buildEpubStudyShellV142(mapped);
assert.equal(shell.studyShellV142,'lab142-epub-fast-original-shell-v1');
assert.equal(shell.quality.mirrorStructureAudit.valid,true);
assert.equal(shell.quality.fidelityGate.paragraphsChecked,0,
 'EPUB must not run the old costly paragraph-by-paragraph fidelity prepass');
assert.deepEqual(shell.chapters.map(c=>c.title),chapters.map(c=>c.title));
assert.ok(shell.chapters.every(c=>c.paragraphs.every(p=>
 typeof p.original==='string'&&p.original===p.summary&&
 p.sourcePageStart>=1&&p.sourcePageEnd>=p.sourcePageStart)));
const originalPages=originalExplainedPagesV122({canonicalBookMap:mapped.canonicalBookMap});
assert.equal(originalPages.length,mapped.pages.length);
assert.equal(originalPages[0].sourceLineCount,mapped.pages[0].sourceLineCount);
assert.ok(originalPages[0].sourceLineCount>5,
 'A normal EPUB logical page must never be exempt as a five-line original');
assert.ok(originalPages.every((p,i)=>p.id==='p'+(i+1)));
const same=buildEpubLogicalPagesV142(source,{fingerprint:sha});
assert.deepEqual(mapped.pages.map(p=>p.text),same.pages.map(p=>p.text));
const again=await ensureEpubLogicalPagesV142(mapped);
assert.equal(again,mapped,'Never rehash, rebuild or repaginate a verified edition');
const legacy=await ensureEpubLogicalPagesV142(source);
assert.equal(legacy.canonicalBookMap.pageCount,mapped.pages.length);
assert.equal(legacy.canonicalBookMap.fingerprintBasis,'extracted-text',
 'Historical source without original file must be openly identified as text-derived');
assert.equal(legacy.pages.map(p=>p.text).join(''),fullText);
const hashed=await sha256EpubV142(new TextEncoder().encode('EPUB originale'));
assert.match(hashed,/^[a-f0-9]{64}$/u);
assert.throws(()=>buildEpubLogicalPagesV142({
 ...source,fullText:'uncorrelated text'},{fingerprint:sha}),/non coincidono/u);
assert.throws(()=>buildEpubLogicalPagesV142({
 ...source,sourceFormat:'pdf'},{fingerprint:sha}),/non può/u);
const giant='A'.repeat(4700000)+'🧪'+'Z'.repeat(700000);
const large=buildEpubLogicalPagesV142({
 sourceFormat:'epub',fullText:giant,
 chapters:[{title:'Grande EPUB',paragraphs:[giant],sections:[],paragraphMeta:[]}]
},{fingerprint:sha});
assert.ok(large.pages.length<=2000);
assert.equal(large.pages.map(p=>p.text).join(''),giant);
assert.ok(large.pages.every(p=>p.text.length<=120000));
assert.ok(!large.pages.some(p=>/[\uD800-\uDBFF]$/u.test(p.text)),
 'A surrogate pair must not be split between pages');

// The EPUB parser creates physical-ready source envelopes ONLY for the
// logical study engine. Legacy V09/V10 adapters preserve the OPF spine.
for(const path of ['src/lib/documentParserV09.js','src/lib/documentParserV10.js']){
 const c=readFileSync(path,'utf8');
 assert.ok(c.includes("epub-spine-logical-v142"));
}
const parser=readFileSync('src/lib/documentParserText.js','utf8');
assert.ok(parser.includes('buildEpubLogicalPagesV142('));
assert.ok(parser.includes('sha256EpubV142(epubBytes)'));
const app=readFileSync('src/AppV15.jsx','utf8');
assert.ok(app.includes("sourceData.sourceFormat==='epub'?"));
assert.ok(app.includes('buildEpubStudyShellV142(sourceData)'));
assert.throws(()=>buildEpubStudyShellV142(source),/non verificata/u);
assert.ok(app.includes('ensureEpubLogicalPagesV142(sourceData'));
assert.ok(app.includes("if(sourceData.sourceFormat==='epub'&&"));
assert.ok(app.includes("legacySixBackupV142"));
assert.ok(app.includes("targetSource?.sourceFormat==='epub'&&!isExplainedBookV122(current)"));
const studio=readFileSync('src/components/AppScreens.jsx','utf8');
assert.ok(studio.includes('legacyEpub'));
assert.ok(studio.includes('Pagine logiche EPUB'));
assert.ok(studio.includes('Riprendi EPUB · unica versione al 50%'));
const home=readFileSync('src/components/HomeDashboardV16.jsx','utf8');
assert.ok(home.includes('legacyEpub'));
assert.ok(home.includes('Riprendi con un’unica versione al 50%'));
assert.ok(!home.includes('LAB142 six editions'));

// Real V141 single-version generation over the mapped EPUB, offline mock
// backend. The existing one-pass, two-repair, glossary, 50% length contracts
// are reused unmodified. Pages can be produced across large 40k blocks.
const previous={version:EXPLAINED_POLICY_V126,sourceFingerprint:sha,
 onePassV135:true,complete:false,status:'partial',pages:[],
 originalPages:mapped.pages.length,totalChunkVariants:mapped.pages.length,
 verifiedChunkVariants:0};
const book={...shell,editionsV36:previous};
const originalFetch=globalThis.fetch,requests=[];
try{
 globalThis.fetch=async(url,options)=>{
  const request=JSON.parse(options.body),pages=request.pages||[];
  requests.push({url:String(url),ids:pages.map(p=>p.id)});
  assert.ok(pages.length>0);
  return {ok:true,status:200,headers:{get:()=>null},
   json:async()=>({engine:'ai',version:EXPLAINED_POLICY_V126,
    phase:'explain',repairContractV127:'lab127-automatic-recovery-v1',
    pages:pages.map(p=>({id:p.id,glossary:[],
     segments:p.segments.map(x=>({id:x.id,
      text:'z'.repeat(Math.max(1,Math.round(studyUnitsV126(x.source)/2)))
     }))}))})};
 };
 const result=await generateExplainedBookV126(book,{
  fastLengthV139:true,glossaryPrecisionV140:true,tailReliableV141:true});
 assert.equal(result.complete,true,'All EPUB logical pages complete');
 assert.equal(result.verifiedChunkVariants,mapped.pages.length);
 assert.equal(result.acceptedWithReserveV127,0);
 assert.ok(result.pages.every(p=>p.review?.ready===true));
 assert.ok(requests.length>=2,'Test must exercise multiple bounded batches');
 assert.equal(requests.reduce((n,r)=>n+r.ids.length,0),mapped.pages.length,
  'Exactly one network request PER PAGE within batches, never six editions');
 assert.ok(requests.every(r=>r.url.endsWith('/api/explained/v141')));
 console.log('LAB142 PASS: EPUB exact source coverage, chapter hierarchy, stable 2k pagination;');
 console.log('LAB142 PASS: old 0/0 source migration, 50% per page, single version, no six-pass fallthrough.');
}finally{globalThis.fetch=originalFetch;}
