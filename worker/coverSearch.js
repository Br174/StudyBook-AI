/* StudyBook LAB22: standalone keyless cover search Worker.
 * Does not handle uploaded book bytes. Original StudyBook and Gemini Workers stay unchanged.
 */
import {searchAndFetchCover} from '../api/coverSearch.js';
const ORIGINS=new Set(['http://localhost','https://localhost','capacitor://localhost']);
function cors(request,headers=new Headers()){
 const origin=request.headers.get('Origin')||'';
 if(ORIGINS.has(origin)){
   headers.set('Access-Control-Allow-Origin',origin);
   headers.set('Vary','Origin');
   headers.set('Access-Control-Allow-Methods','POST,GET,OPTIONS');
   headers.set('Access-Control-Allow-Headers','Content-Type');
   headers.set('Access-Control-Max-Age','7200');
 }
 return headers;
}
export default {
 async fetch(request){
   const url=new URL(request.url);
   const hdr=cors(request,new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}));
   if(url.pathname!=='/api/book-cover/search')return new Response(JSON.stringify({error:'Endpoint non trovato.'}),{status:404,headers:hdr});
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:hdr});
   if(request.method!=='POST'){
     hdr.set('Allow','POST');
     return new Response(JSON.stringify({error:'Metodo non consentito.'}),{status:405,headers:hdr});
   }
   if(Number(request.headers.get('Content-Length')||0)>4096)
     return new Response(JSON.stringify({error:'Richiesta troppo grande.'}),{status:413,headers:hdr});
   let body={};
   try{
     const text=await request.text();
     if(text.length>4096)throw Error('too long');
     body=JSON.parse(text);
   }catch{
     return new Response(JSON.stringify({error:'Richiesta non valida.'}),{status:400,headers:hdr});
   }
   try{
     const result=await searchAndFetchCover(body);
     const {status=500,...safe}=result;
     return new Response(JSON.stringify(safe),{status,headers:hdr});
   }catch(error){
     console.error('Cover search unavailable:',error?.message||'unknown');
     return new Response(JSON.stringify({error:'Ricerca copertine temporaneamente non disponibile.',code:'COVER_SEARCH_ERROR'}),{status:503,headers:hdr});
   }
 }
};
