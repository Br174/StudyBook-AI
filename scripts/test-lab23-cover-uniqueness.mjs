import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findTheme,searchAndFetchCover} from '../api/coverSearch.js';
import {usedCoverAssets,findDuplicateWebCovers} from '../src/lib/coverUniqueness.js';

const [app,search,client,screens,workflow]=await Promise.all([
 'src/AppV15.jsx','api/coverSearch.js','src/lib/bookCoverSearch.js',
 'src/components/AppScreens.jsx','.github/workflows/android-apk.yml'
].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')));
assert.match(findTheme('I romani','Altro',''),/Roman/);
assert.match(findTheme('Tutti santi me compreso Luciano D','Altro','Roma antica Impero'),/Christian religious/);
assert.match(findTheme('Appunti fotografati - 1 pagine','Altro','Roma antica e senato'),/Roman/);
assert.doesNotMatch(findTheme('Tutti santi me compreso Luciano D','Altro','Roma antica Impero'),/Roman/);
assert.doesNotMatch(findTheme('Tutti santi me compreso','Altro','Roma antica'),/Rome|Roman|colosseum/);
assert.ok(search.includes('if(excluded.has(candidate.assetId)'),'duplicate avoidance in server');
assert.ok(client.includes('excludeAssets'),'client forwards used covers');
assert.ok(app.includes('findDuplicateWebCovers(libraryItems)'),'app heals old repeated pictures');
assert.ok(app.includes("coverOrigin:'online-duplicate-repair'"),'only known web theme covers reconciled');
assert.ok(screens.includes('Aggiungi copertina'));
assert.ok(workflow.includes('StudyBook-AI-LAB-23-AGGIORNAMENTO'));

const commons='https://commons.wikimedia.org/wiki/File:Ancient_Roman_architecture.jpg';
const cover={
 id:'rome',fileName:'I romani.pdf',subject:'Altro',
 coverOrigin:'online-thematic',coverCustom:'data:image/jpeg;base64,rome',
 coverImageSourceUrl:commons,createdAt:'2026-10-10T09:00:00Z'
};
const other={
 id:'notes',fileName:'Appunti fotografati - 1 pagine.pdf',subject:'Altro',
 coverOrigin:'online-thematic',coverCustom:'data:image/jpeg;base64,notes',
 coverImageSourceUrl:commons,createdAt:'2026-10-10T09:04:00Z'
};
const unrelated={
 id:'saints',fileName:'Tutti santi me compreso.pdf',subject:'Altro',
 coverOrigin:'online-thematic',coverCustom:'data:image/jpeg;base64,saints',
 coverImageSourceUrl:commons,createdAt:'2026-10-10T09:06:00Z'
};
let duplicates=findDuplicateWebCovers([unrelated,other,cover]);
assert.equal(duplicates.length,2);
assert.ok(duplicates.map(x=>x.id).includes('saints'));
assert.ok(duplicates.map(x=>x.id).includes('notes'));
assert.ok(!duplicates.some(x=>x.id==='rome'),'only title-appropriate Roman book may retain Roman cover');
const personal={...unrelated,id:'personal',coverOrigin:'custom',coverImageSourceUrl:commons};
const scan={...unrelated,id:'scan',coverOrigin:'scan',coverImageSourceUrl:commons};
assert.equal(findDuplicateWebCovers([cover,personal,scan]).length,0,'never delete personal or scanned photo');
assert.ok(usedCoverAssets([other,unrelated],other.id).includes(commons));

const bytes=new Uint8Array(1450).fill(91);bytes.set([0xff,0xd8,0xff,0xe0],0);
const imageResp={ok:true,status:200,headers:{get:k=>k==='content-type'?'image/jpeg':'1450'},
 arrayBuffer:async()=>bytes.buffer};
const pages=[
 {pageid:100,title:'File:Ancient Roman architecture 1.jpg',
  imageinfo:[{mime:'image/jpeg',width:900,height:1000,
   thumburl:'https://upload.wikimedia.org/wikipedia/commons/a/photo1.jpg',
   descriptionurl:'https://commons.wikimedia.org/wiki/File:Ancient_Roman_architecture_1.jpg',
   extmetadata:{LicenseShortName:{value:'CC0'},ImageDescription:{value:'Ancient Roman architecture and ruins'}}}]},
 {pageid:200,title:'File:Ancient Roman architecture 2.jpg',
  imageinfo:[{mime:'image/jpeg',width:900,height:1000,
   thumburl:'https://upload.wikimedia.org/wikipedia/commons/a/photo2.jpg',
   descriptionurl:'https://commons.wikimedia.org/wiki/File:Ancient_Roman_architecture_2.jpg',
   extmetadata:{LicenseShortName:{value:'CC0'},ImageDescription:{value:'Ancient Roman architecture and ruins'}}}]}
];
const fetcher=async url=>{
 const host=new URL(url).hostname;
 if(host==='openlibrary.org')return {ok:true,json:async()=>({docs:[]})};
 if(host==='www.googleapis.com')return {ok:true,json:async()=>({items:[]})};
 if(host==='commons.wikimedia.org')return {ok:true,json:async()=>({query:{pages:Object.fromEntries(pages.map(x=>[x.pageid,x]))}})};
 if(host==='upload.wikimedia.org')return imageResp;
 throw Error('Unexpected host '+host);
};
const result=await searchAndFetchCover({title:'I romani',subject:'Altro',excludeAssets:['commons:100']},fetcher);
assert.equal(result.status,200);
assert.equal(result.kind,'thematic');
assert.equal(result.assetId,'commons:200','second Wikimedia photo selected when first image is already used');
const blocked=await searchAndFetchCover({title:'I romani',subject:'Altro',
 excludeAssets:['commons:100','commons:200']},fetcher);
assert.equal(blocked.status,404,'do not reuse another book image if all suitable images are used');
console.log('LAB23 PASS: title first, saints no Roman picture, old duplicated cover repair, genuine unique Commons photo, scan/custom protected');
