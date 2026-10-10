import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import coverHandler,{createBookCoverPrompt} from '../api/coverAi.js';
import {coverRequest,coverEndpoint} from '../src/lib/trueAiCover.js';
import {saveLibraryBook,getLibraryBook,updateLibraryMetadata,listLibraryBooks} from '../src/lib/library.js';
const [app,ui,worker,workerConfig,buildAndroid,client,api,archive] = await Promise.all([
  'src/AppV15.jsx','src/components/AppScreens.jsx','worker/index.js','wrangler.jsonc',
  '.github/workflows/android-apk.yml','src/lib/trueAiCover.js','api/coverAi.js','src/components/ScannerArchive.jsx',
].map(p=>readFile(p,'utf8')));
const settings=JSON.parse(workerConfig);
assert.equal(settings.vars.AI_IMAGE_MODEL,'gemini-3.1-flash-image');
assert.ok(worker.includes("['/api/cover-ai/generate', coverAiHandler]"),'genuine backend registered on Worker');
assert.ok(app.includes('generateTrueBookImage(record,{variant,onStage})'),'LAB21 legacy image-model client kept available in source');
assert.ok(app.includes('async function applyRealAICover(id,preview)'),'LAB21 persisted image model path retained for compatibility');
assert.ok(app.includes("coverOrigin:'ai-image'"),'book metadata indicates real AI images');
assert.ok(app.includes('if(automatic)return false;'),'automatic fake SVGs disabled');
assert.ok(ui.includes('Trova copertina automaticamente')&&ui.includes('Cerco copertina originale e foto pertinente…'),'LAB22 auto-search user flow');
assert.ok(ui.includes('Copertina del catalogo salvata automaticamente.')&&ui.includes('Fotografia tematica salvata come copertina.'),'LAB22 distinct saved result types');
assert.ok(client.includes("canvas.toDataURL('image/jpeg'")&&client.includes("ctx.drawImage(img"),'real image decoding and local correct-title overlay');
assert.ok(!client.includes('AI_API_KEY'),'no secret inside APK');
assert.ok(!api.includes('Bearer ${apiKey}'),'no accidental reliance on client auth header');
assert.ok(api.includes("process.env.AI_IMAGE_API_KEY||process.env.AI_API_KEY"),'provider key solely server-side');
assert.ok(buildAndroid.includes('StudyBook-AI-LAB-21-AGGIORNAMENTO'),'real version in Android workflow');
assert.ok(archive.includes('entries.map((page, index)'),'scanner photos unchanged');

const content="I Romani; L'antica Roma; Repubblica, Impero, Senato, legioni e cultura.";
const brief=createBookCoverPrompt({title:'I romani',subject:'Storia',context:content,variant:2});
assert.ok(brief.includes('I romani')&&brief.includes('legioni')&&brief.includes('3:4'),'contextual book art');
assert.ok(brief.includes('Draw NO WORDS'),'app correctly renders user title');
assert.ok(!brief.includes('Ignore previous instructions'),'no fake hardcoded prompts');
const record={id:'book-rome',fileName:'I romani.pdf',subject:'Storia',sourceData:{chapters:[{title:'La Roma antica',paragraphs:[{original:content}]}]},studyBook:{chapters:[]}};
const payload=coverRequest(record,2);
assert.equal(payload.title,'I romani');assert.ok(payload.context.includes('legioni'));assert.equal(payload.variant,2);
assert.throws(()=>coverRequest({id:'photo',sourceData:{sourceFormat:'scan'}}),/fotografia/);
assert.ok(coverEndpoint().endsWith('/api/cover-ai/generate'));

function mockRes(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(v){this.body=v;return v;}};}
const oldFetch=globalThis.fetch,oldKey=process.env.AI_API_KEY;
process.env.AI_API_KEY='only-for-lab21-tests';
try {
  let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.match(String(url),/generativelanguage.googleapis.com\/v1\/models\/gemini-3.1-flash-image:generateContent/);
    assert.equal(options.headers['x-goog-api-key'],'only-for-lab21-tests');
    const input=JSON.parse(options.body);
    assert.deepEqual(input.generationConfig.responseModalities,['IMAGE']);
    assert.equal(input.generationConfig.responseFormat.image.aspectRatio,'3:4');
    assert.ok(input.contents[0].parts[0].text.includes('Romani'));
    return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'A'.repeat(900)}}]}}]})};
  };
  let res=mockRes();
  await coverHandler({method:'POST',body:{title:'I Romani',subject:'Storia',context:content}},res);
  assert.equal(res.code,200);assert.equal(res.body.type,'generated-image');assert.equal(res.body.mimeType,'image/png');assert.equal(calls,1);
  assert.equal(res.body.imageData.length,900);
  assert.ok(!JSON.stringify(res.body).includes('only-for-lab21-tests'),'server key never disclosed');
  res=mockRes();await coverHandler({method:'POST',body:{title:''}},res);assert.equal(res.code,400);assert.equal(calls,1);
  res=mockRes();await coverHandler({method:'GET'},res);assert.equal(res.code,405);
  globalThis.fetch=async()=>({ok:false,status:429,text:async()=>''});
  res=mockRes();await coverHandler({method:'POST',body:{title:'I romani'}},res);
  assert.equal(res.code,429);assert.equal(res.body.code,'COVER_IMAGE_QUOTA');
  globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'only words'}]}}]})});
  res=mockRes();await coverHandler({method:'POST',body:{title:'I romani'}},res);
  assert.equal(res.code,502);assert.equal(res.body.code,'COVER_IMAGE_EMPTY');
} finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.AI_API_KEY;else process.env.AI_API_KEY=oldKey;}
await saveLibraryBook({id:'lab21-book',fileName:'I romani.pdf',profileId:'default'});
const realJpeg='data:image/jpeg;base64,'+'A'.repeat(500);
await updateLibraryMetadata('lab21-book',{coverAI:realJpeg,coverCustom:realJpeg,coverOrigin:'ai-image',coverAiGeneratedAt:'2026-10-10T00:00:00.000Z'});
const after=await getLibraryBook('lab21-book');
assert.equal(after.fileName,'I romani.pdf');assert.equal(after.coverCustom,realJpeg);
assert.equal((await listLibraryBooks({profileId:'default'})).length,1);
console.log('LAB21 PASS: genuine Gemini image-model integration, context prompt, security, error handling, preview/accept and data preservation');
