import assert from 'node:assert/strict';
import {buildGeminiEditionViewV36,mayPublishGeminiEdition} from '../src/lib/editionViewV36.js';
import {buildPrecisionEdition} from '../src/lib/precisionCore.js';
const src='Articolo 7: il termine non cambia, salvo eccezione.';
const base={chapters:[{title:'Titolo esatto',pageStart:4,pageEnd:4,sections:[],
  paragraphs:[{original:src,sourcePageStart:4,sourcePageEnd:4}]}],
  editionsV36:{complete:false,rows:[[{verified:{10:true},editions:{10:src},issues:{20:['not-verified']}}]]}};
const untouched=buildPrecisionEdition(base,0);
assert.equal(untouched.precisionEdition.level,0);
assert.equal(mayPublishGeminiEdition(untouched),true,'Original 0% always available');
const p10=buildPrecisionEdition(base,10);
assert.equal(p10.chapters[0].paragraphs[0].summary,src);
assert.equal(p10.editionReadiness.complete,true,'The independently verified 10% edition can be studied while other levels continue');
assert.equal(mayPublishGeminiEdition(p10),true,'Independently complete level may be published');
const p20=buildPrecisionEdition(base,20);
assert.equal(p20.chapters[0].paragraphs[0].editionPending,true);
assert.equal(p20.editionReadiness.complete,false);
assert.equal(mayPublishGeminiEdition(p20),false,'Pending level must remain unavailable for export');
assert.doesNotMatch(p20.chapters[0].paragraphs[0].summary,/Articolo 7/);
assert.equal(p20.chapters[0].pageStart,4);
assert.equal(base.chapters[0].paragraphs[0].original,src);
const done={...base,editionsV36:{complete:true,rows:[[{verified:{
  10:true,20:true,30:true,40:true,50:true,summary:true},editions:{
  10:src,20:src,30:src,40:src,50:src,summary:src}}]]}};
const complete=buildPrecisionEdition(done,'summary');
assert.equal(complete.editionReadiness.complete,true);
assert.equal(mayPublishGeminiEdition(complete),true);
assert.equal(complete.precisionEdition.achievedLettersPercent,0);
const old=buildPrecisionEdition({chapters:base.chapters},10);
assert.equal(old.editionReadiness,undefined);
assert.equal(mayPublishGeminiEdition(old),true);
console.log('LAB36 six edition views: verified-only preview, source immutable, publication gate, legacy safe: OK');
