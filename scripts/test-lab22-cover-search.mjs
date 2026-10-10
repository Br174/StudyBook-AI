import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {
  titleMatch,findTheme,isPublicDomain,searchAndFetchCover,fetchSafeImage
} from '../api/coverSearch.js';
import worker from '../worker/coverSearch.js';
import {coverLookupRequest,coverSearchEndpoint} from '../src/lib/bookCoverSearch.js';
import {saveLibraryBook,getLibraryBook,updateLibraryMetadata} from '../src/lib/library.js';

const [app,screen,client,workflow,conf] = await Promise.all([
  'src/AppV15.jsx','src/components/AppScreens.jsx','src/lib/bookCoverSearch.js',
  '.github/workflows/android-apk.yml','wrangler.lab22-cover.jsonc'
].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
assert.equal(JSON.parse(conf).name,'studybook-ai-coversearch-lab22');
assert.ok(app.includes('onGenerateCover={findAndApplyLibraryCover}'),'long-press invokes keyless search');
assert.ok(screen.includes('Aggiungi copertina'),'exact user-approved button wording');
assert.ok(!screen.includes('Aggiungi locandina'),'wrong wording removed');
assert.ok(screen.includes('onGenerateCover(id,{onStage:setCoverPhase})'),'single tap initiates web search');
assert.ok(app.includes('coverImageLicense:result.license') && app.includes('coverImageSource:result.source'),'licenses retained');
assert.ok(workflow.includes('StudyBook-AI-LAB-22-AGGIORNAMENTO'),'same LAB Android update family');
assert.ok(!/API_KEY|GEMINI|image generation/i.test(client),'new flow is free/keyless');
assert.ok(coverSearchEndpoint().endsWith('/api/book-cover/search'));
assert.equal(titleMatch('I Romani.pdf','I Romani'),1);
assert.equal(titleMatch('I romani','I romani del Medioevo'),0,'near-title false positive rejected');
assert.equal(titleMatch('I romani','Diritto penale'),0);
assert.match(findTheme('I romani','Storia',''),/Roman/);
assert.match(findTheme('Biologia cellulare','Scienza',''),/biology/);
assert.equal(isPublicDomain({LicenseShortName:{value:'CC0'}}),true);
assert.equal(isPublicDomain({LicenseShortName:{value:'PD-old-100'}}),true);
assert.equal(isPublicDomain({LicenseShortName:{value:'CC BY-SA 4.0'}}),false);
assert.equal(isPublicDomain({LicenseShortName:{value:'All rights reserved'}}),false);
assert.throws(()=>coverLookupRequest({id:'scan-photo',sourceData:{sourceFormat:'scan'}}),/fotografia/);
const request=coverLookupRequest({id:'roman-book',fileName:'I romani.pdf',subject:'Storia',
 sourceData:{chapters:[{title:'Il Senato',paragraphs:['Senatori e legioni romane']}]},studyBook:{chapters:[]}});
assert.equal(request.title,'I romani');assert.match(request.context,/Senat/i);

const jpeg=new Uint8Array(1200);jpeg.fill(32);jpeg.set([255,216,255,224],0);
const imgResp={ok:true,status:200,headers:{get:k=>k==='content-type'?'image/jpeg':k==='content-length'?'1200':null},
 arrayBuffer:async()=>jpeg.buffer};
const commonsResult={query:{pages:{'37':{
 title:'File:Ancient Roman architecture.jpg',
 imageinfo:[{mime:'image/jpeg',width:800,height:1060,
 thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/roman.jpg/660px-roman.jpg',
 descriptionurl:'https://commons.wikimedia.org/wiki/File:Ancient_Roman_architecture.jpg',
 extmetadata:{LicenseShortName:{value:'CC0'},
 ImageDescription:{value:'Ancient Roman ruins in Italy'}}}]
}}}};
let log=[];
function mockFetcher({book=true,commons=true,coverFails=false,license='CC0'}={}){
 return async(url,options)=>{
  const u=new URL(url); log.push({host:u.hostname,options});
  if(u.hostname==='openlibrary.org')return{ok:true,json:async()=>({
    docs:book?[{title:'I romani',cover_i:12345,author_name:['Mario Rossi']},
      {title:'I romani del Medioevo',cover_i:56789}]:[]
  })};
  if(u.hostname==='www.googleapis.com')return{ok:true,json:async()=>({items:[]})};
  if(u.hostname==='commons.wikimedia.org'){
    const copy=structuredClone(commonsResult);
    copy.query.pages['37'].imageinfo[0].extmetadata.LicenseShortName.value=license;
    return {ok:true,json:async()=>commons?copy:{query:{pages:{}}}};
  }
  if(u.hostname==='upload.wikimedia.org'||u.hostname==='covers.openlibrary.org'){
    if(coverFails&&u.hostname==='covers.openlibrary.org')return{ok:false,status:404};
    return imgResp;
  }
  throw Error('Unexpected URL '+u.href);
 };
}
log=[];const original=await searchAndFetchCover({title:'I romani',subject:'Storia'},mockFetcher());
assert.equal(original.status,200);assert.equal(original.kind,'original');
assert.equal(original.source,'Open Library');
assert.ok(original.imageData.length>=1500);
assert.ok(!log.some(x=>x.host==='upload.wikimedia.org'),'original wins over thematic fallback');
log=[];const thematic=await searchAndFetchCover({title:'I romani',subject:'Storia'},mockFetcher({book:false}));
assert.equal(thematic.status,200);assert.equal(thematic.kind,'thematic');
assert.equal(thematic.source,'Wikimedia Commons');
assert.equal(thematic.license,'CC0');
log=[];const fallback=await searchAndFetchCover({title:'I romani',subject:'Storia'},mockFetcher({coverFails:true}));
assert.equal(fallback.status,200);assert.equal(fallback.kind,'thematic');
const unmatched=await searchAndFetchCover({title:'I romani',subject:'Storia'},mockFetcher({book:false,commons:false}));
assert.equal(unmatched.status,404);assert.equal(unmatched.code,'COVER_NOT_FOUND');
const unlicensed=await searchAndFetchCover({title:'I romani',subject:'Storia'},mockFetcher({book:false,license:'CC BY-SA 4.0'}));
assert.equal(unlicensed.status,404,'restricted license must not be used as fallback');
await assert.rejects(fetchSafeImage({url:'https://example.com/evil.jpg'},mockFetcher()),/not allowed/);
const badMethod=await worker.fetch(new Request('https://example.test/api/book-cover/search'));
assert.equal(badMethod.status,405);
const options=await worker.fetch(new Request('https://example.test/api/book-cover/search',{
 method:'OPTIONS',headers:{Origin:'http://localhost'}
}));
assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'http://localhost');
await saveLibraryBook({id:'lab22-existing',fileName:'I romani.pdf',profileId:'default'});
await updateLibraryMetadata('lab22-existing',{
 coverCustom:'data:image/jpeg;base64,'+original.imageData,coverOrigin:'online-catalog',
 coverImageSource:'Open Library',coverImageLicense:original.license
});
const saved=await getLibraryBook('lab22-existing');
assert.equal(saved.fileName,'I romani.pdf');
assert.equal(saved.coverImageSource,'Open Library');
assert.ok(saved.coverCustom.startsWith('data:image/jpeg;base64,'));
console.log('LAB22 PASS: exact-title original first, CC0/PD photo fallback, source licensing, safe hosts, scanner protection, one-click Aggiungi copertina, original book intact.');
