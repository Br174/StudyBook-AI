/* StudyBook LAB22 — keyless original-cover-first search.
 * 1. Open Library/Google Books: strict title match, not a loosely related book.
 * 2. Wikimedia Commons: only public-domain/CC0 artwork on a relevant theme.
 * No Google Images scraping, no generated/fake AI images, no credential,
 * no server-side persistence, no arbitrary URL/image proxy.
 */
const STOP=new Set('il lo la i gli le un una uno di del della delle degli da in nel nei al alla per con che e ed a su sul sullo dei degli delle libro corso manuale appunti materiale testo volume parte lezioni introduzione guida nuovo nuova studio studi study book the and to of for a an volume vol notes introduction'.split(' '));
const BAD=/\b(logo|icon|poster|book cover|cover art|album|stamp|trademark|screenshot|wallpaper|meme|watermark)\b/i;
const norm=(v)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it-IT').replace(/[^a-z0-9]+/g,' ').trim();
const tidy=(v,max=120)=>String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const tokens=(v)=>[...new Set(norm(v).split(' ').filter(w=>w.length>=3&&!STOP.has(w)))];
export function titleMatch(a,b){
  const x=norm(a).replace(/\b(pdf|epub|docx|mobi|txt)\b$/,'').trim();
  const y=norm(b);
  if(x===y && x.length>=5)return 1;
  const ax=tokens(x),by=new Set(tokens(y));
  if(ax.length<2||by.size<2)return 0;
  const hits=ax.filter(k=>by.has(k)).length;
  const precision=hits/Math.max(ax.length,by.size);
  return hits>=2 && precision>=.85 ? precision : 0;
}
const hints=[
  [/roman[io]|roma|impero|latino|repubblica romana/i,'ancient Roman architecture ruins colosseum'],
  [/grec[io]|grecia|ellenic/i,'ancient Greece temple'],
  [/mediev|medioev/i,'medieval castle cathedral'],
  [/egitt|faraon/i,'ancient Egyptian pyramids'],
  [/biolog|cellul|genetic/i,'biology microscope cell'],
  [/anatom|medicin|sanit|salute/i,'human anatomy medical illustration'],
  [/fisic|scientific/i,'physics scientific laboratory'],
  [/chimic|molecol/i,'chemistry molecules scientific laboratory'],
  [/diritt|giurid|tribunal|legge|reato/i,'justice courthouse architecture'],
  [/storia|storico/i,'historical architecture monument'],
  [/arte|pittur|dipint/i,'classical fine art painting'],
  [/musica|music|canzon/i,'musical instruments'],
  [/geograf|viagg|turism/i,'nature landscape geography'],
  [/geometr|matematic|algebr/i,'mathematical geometry illustration'],
  [/informatic|programmaz|tecnolog|computer|software/i,'computer technology'],
  [/astronom|spazio|stell|pianet/i,'stars planets astronomy NASA'],
  [/botanic|flora|piant/i,'botany botanical illustration'],
  [/econom|finanz|mercat/i,'historical banking economy'],
  [/filosof|pensier|etica/i,'classical philosopher statue'],
  [/letteratur|poes|scritt|dante/i,'literary manuscript books'],
  [/animal|zoolog/i,'wildlife animal nature'],
];
export function findTheme(title,subject='',context=''){
  const joined=[title,subject,context.slice(0,550)].join(' ');
  const match=hints.find(([re])=>re.test(joined));
  if(match)return match[1];
  const key=tokens(title).filter(w=>w.length>3).slice(0,3);
  const extra=tokens(subject).filter(w=>w.length>3).slice(0,1);
  return [...key,...extra].join(' ').slice(0,105);
}
const defaultFetch=(...a)=>fetch(...a);
async function getJson(url,fetcher,timeout=7000){
  const signal=AbortSignal.timeout(timeout);
  const r=await fetcher(url,{signal,headers:{Accept:'application/json','User-Agent':'StudyBookAI/1.0 (public educational book cover lookup)'}});
  if(!r.ok)throw Error('Search provider '+r.status);
  return r.json();
}
function authorMatches(candidate,author){
  if(!author)return true;
  return (candidate||[]).some(a=>tokens(a).filter(w=>w.length>3).some(w=>tokens(author).includes(w)));
}
export async function searchCatalog({title,author='',isbn=''},fetcher=defaultFetch){
  const queryTitle=tidy(title.replace(/\.[a-z0-9]{2,6}$/i,''),130);
  const url='https://openlibrary.org/search.json?title='+encodeURIComponent(queryTitle)+'&limit=12&fields=title,cover_i,author_name,isbn';
  const google='https://www.googleapis.com/books/v1/volumes?q='+encodeURIComponent('intitle:'+queryTitle)+'&maxResults=10&printType=books';
  const work=await Promise.allSettled([getJson(url,fetcher),getJson(google,fetcher)]);
  const found=[];
  const open=work[0].status==='fulfilled'?work[0].value.docs||[]:[];
  for(const b of open){
    if(!Number.isSafeInteger(b.cover_i)||b.cover_i<=0)continue;
    const score=titleMatch(queryTitle,b.title);
    const isbnHit=isbn&&Array.isArray(b.isbn)&&b.isbn.some(x=>norm(x)===norm(isbn));
    if(!isbnHit && score<.95)continue;
    if(!authorMatches(b.author_name,author))continue;
    found.push({score:(isbnHit?3:score)+(author?.length?1:0),kind:'original',label:'Copertina dal catalogo Open Library',
      url:'https://covers.openlibrary.org/b/id/'+b.cover_i+'-L.jpg?default=false',
      source:'Open Library',sourceUrl:'https://openlibrary.org',license:'Catalog cover — bibliographic reference',
      matchedTitle:b.title});
  }
  const googleBooks=work[1].status==='fulfilled'?work[1].value.items||[]:[];
  for(const b of googleBooks){
    const v=b.volumeInfo||{};
    const score=titleMatch(queryTitle,v.title);
    const isbnHit=isbn&&Array.isArray(v.industryIdentifiers)&&v.industryIdentifiers.some(i=>norm(i.identifier)===norm(isbn));
    if(!isbnHit && score<.95)continue;
    if(!authorMatches(v.authors,author))continue;
    const images=v.imageLinks||{};
    const image=images.large||images.medium||images.thumbnail||images.smallThumbnail;
    if(!image)continue;
    let parsed;try{parsed=new URL(image.replace(/^http:\/\//,'https://'));}catch{continue;}
    if(!['books.google.com','books.googleusercontent.com','books.google.it'].includes(parsed.hostname))continue;
    found.push({score:(isbnHit?3:score)+(author?.length?.1:0),kind:'original',label:'Copertina dal catalogo Google Books',
      url:parsed.href,source:'Google Books',sourceUrl:b.volumeInfo?.infoLink||'https://books.google.com',
      license:'Catalog cover — bibliographic reference',matchedTitle:v.title});
  }
  return found.sort((a,b)=>b.score-a.score);
}
export function isPublicDomain(meta={}){
  const license=(meta.LicenseShortName?.value||'').trim();
  const licenseUrl=(meta.LicenseUrl?.value||'').trim();
  const conditions=meta.UsageTerms?.value||'';
  return /^(?:CC0(?:\s*1\.0)?|Public domain|PD-[a-z0-9_.-]+)$/i.test(license)
      || /creativecommons\.org\/publicdomain\/zero\//i.test(licenseUrl)
      || (/public domain/i.test(conditions)&&!/(?:CC BY|CC-BY|noncommercial)/i.test(conditions));
}
export async function searchCommons({title,subject='',context=''},fetcher=defaultFetch){
  const theme=findTheme(title,subject,context);
  if(theme.length<5)return[];
  const url=new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action','query');url.searchParams.set('format','json');url.searchParams.set('generator','search');
  url.searchParams.set('gsrsearch',theme);url.searchParams.set('gsrnamespace','6');url.searchParams.set('gsrlimit','24');
  url.searchParams.set('prop','imageinfo');url.searchParams.set('iiprop','url|size|mime|extmetadata');
  url.searchParams.set('iiurlwidth','660');
  const data=await getJson(url.href,fetcher,7500);
  const pages=Object.values(data?.query?.pages||{});
  const searchTokens=tokens(theme);
  const results=[];
  for(const page of pages){
    const img=page.imageinfo?.[0];
    if(!img||!['image/jpeg','image/png','image/webp'].includes(img.mime))continue;
    if((img.width||0)<420||(img.height||0)<300)continue;
    if(BAD.test(page.title||''))continue;
    if(!isPublicDomain(img.extmetadata||{}))continue;
    const filename=norm(page.title).replace(/^file /,'');
    const desc=norm(String(img.extmetadata?.ImageDescription?.value||'').replace(/<[^>]+>/g,' ').slice(0,700));
    const hits=searchTokens.filter(t=>(filename+' '+desc).includes(t)).length;
    if(hits<1)continue;
    const uri=img.thumburl||img.url;
    if(!uri)continue;
    try{if(new URL(uri).hostname!=='upload.wikimedia.org')continue;}catch{continue;}
    results.push({kind:'thematic',score:hits/(searchTokens.length||1),url:uri,
      label:'Immagine tematica da Wikimedia Commons',source:'Wikimedia Commons',
      sourceUrl:img.descriptionurl||'https://commons.wikimedia.org',
      license:tidy(img.extmetadata?.LicenseShortName?.value||'Public domain',50),
      attribution:tidy(String(img.extmetadata?.Artist?.value||'').replace(/<[^>]+>/g,' '),125)});
  }
  return results.sort((a,b)=>b.score-a.score);
}
const ALLOWED_ORIGINS=new Set([
 'https://covers.openlibrary.org','https://books.google.com',
 'https://books.googleusercontent.com','https://books.google.it',
 'https://upload.wikimedia.org','https://archive.org',
 'https://lh3.googleusercontent.com','https://lh4.googleusercontent.com'
]);
function safeImageHost(uri){
 let u;try{u=new URL(uri);}catch{return false;}
 if(u.protocol!=='https:'||u.username||u.password)return false;
 if(ALLOWED_ORIGINS.has(u.origin))return true;
 // Open Library covers are sent via HTTPS redirects to Archive.org image CDNs.
 // Never follow an arbitrary Location supplied by a remote service.
 if(/^(?:ia[0-9]{2,7}|dn[0-9]{2,7})\.[a-z0-9-]+\.archive\.org$/i.test(u.hostname))return true;
 return false;
}
export async function fetchSafeImage(candidate,fetcher=defaultFetch){
 let url=candidate.url;
 if(!safeImageHost(url))throw Error('Image host not allowed');
 let r;
 for(let hop=0;hop<=4;hop++){
   r=await fetcher(url,{signal:AbortSignal.timeout(9500),redirect:'manual',
     headers:{Accept:'image/jpeg,image/png,image/webp','User-Agent':'StudyBookAI/1.0 (educational cover lookup)'}});
   if([301,302,303,307,308].includes(r.status)){
     if(hop>=4)throw Error('Image redirects exceeded');
     const location=r.headers?.get('location')||'';
     const next=new URL(location,url).href;
     if(!safeImageHost(next))throw Error('Unsafe image redirect');
     url=next;continue;
   }
   break;
 }
 if(!r.ok)throw Error('Image is unavailable');
 const size=Number(r.headers?.get('content-length')||0);
 if(size>2800000)throw Error('Image exceeds size limit');
 const mime=(r.headers?.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['image/jpeg','image/png','image/webp'].includes(mime))throw Error('Not a safe image');
 const raw=await r.arrayBuffer();
 if(raw.byteLength<900||raw.byteLength>2800000)throw Error('Invalid image length');
 const bytes=new Uint8Array(raw);let encoded='';
 // Keep non-final chunks divisible by three or concatenated base64 corrupts.
 for(let i=0;i<bytes.length;i+=8190)encoded+=btoa(String.fromCharCode(...bytes.subarray(i,i+8190)));
 return {encoded,mime};
}
export async function searchAndFetchCover(body,fetcher=defaultFetch){
  const title=tidy(body?.title,140),subject=tidy(body?.subject,100);
  const context=tidy(body?.context,1150),author=tidy(body?.author,110);
  const isbn=tidy(body?.isbn,22);
  if(title.length<3)return {error:'Il titolo del libro è troppo breve.',status:400,code:'COVER_TITLE'};
  const [catalog,commons]=await Promise.allSettled([
    searchCatalog({title,author,isbn},fetcher),
    searchCommons({title,subject,context},fetcher)]);
  // A genuine original catalog match ALWAYS takes priority over themed pictures.
  for(const group of [catalog,commons]){
    if(group.status!=='fulfilled')continue;
    for(const candidate of group.value.slice(0,5)){
      try{
        const {encoded,mime}=await fetchSafeImage(candidate,fetcher);
        return {status:200,type:'web-cover',kind:candidate.kind,label:candidate.label,
          imageData:encoded,mimeType:mime,source:candidate.source,sourceUrl:candidate.sourceUrl,
          license:candidate.license,attribution:candidate.attribution||'',
          matchedTitle:candidate.matchedTitle||'',isOriginalCatalog:candidate.kind==='original'};
      }catch{/* try the next eligible image, not an unrelated false positive */ }
    }
  }
  if(catalog.status==='rejected'&&commons.status==='rejected')
    return {status:503,code:'COVER_SOURCES_UNAVAILABLE',error:'Fonti di ricerca temporaneamente non disponibili.'};
  return {status:404,code:'COVER_NOT_FOUND',error:'Nessuna copertina attendibile o fotografia libera e pertinente trovata. Il libro resta invariato.'};
}