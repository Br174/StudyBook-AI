/* LAB12 • Titoli intelligenti locali, senza servizi esterni.
   I titoli sono derivati dal testo OCR o dai titoli dei capitoli, mai inventati.
   È intenzionale non suggerire nulla quando la fonte è insufficiente. */
const GENERIC = /^(?:premessa|introduzione|indice|sommario|prefazione|bibliografia|appendice|capitolo\s*\d*|pagina\s*\d+|appunti fotografati|scansione libro|documento|conclusioni|esercizi|prologo|epilogo)$/i;
const NOISE = /\b(?:www\.|https?:|isbn|copyright|edizione|stampato|all rights reserved|pagine?\s+\d+)\b/i;
const SENTENCE = /[.!?;:]\s+\S/;
const STOP = new Set('il lo la le gli i un uno una e ed o oppure che di del della delle dei degli da dal dalla in nel nella nelle nei con per tra fra su al alla alle ai agli si non sono come della dove quando questo questa questi queste quella quello ma anche più molto tanto tutto tutti loro suo sua suoi sue sempre ogni può essere aveva avevano del nel alla della fra un altro poi era erano nella delle testo libro pagina capitolo'.split(' '));
const clean = x => String(x || '').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();
export function sanitizeTitle(value,max=90) {
  return clean(value).replace(/[\\/:*?"<>|]/g,' ').replace(/\s+/g,' ').replace(/^[—–\-_\s]+|[—–\-_\s.]+$/g,'').slice(0,max).trim();
}
export function isGenericTitle(name) {
  const value=sanitizeTitle(name).replace(/\s*\(?\d+\s*pagin[ae]\)?$/i,'').replace(/\.(?:pdf|docx?|txt|epub)$/i,'');
  return !value || GENERIC.test(value) || /^(?:appunti fotografati|scansione libro)(?:\s*[-–]?\s*\d+.*)?$/i.test(value);
}
function headingScore(value,position=0) {
  const name=sanitizeTitle(value,100);
  const words=name.split(/\s+/).filter(Boolean);
  if (words.length<2 || words.length>11 || name.length<12 || name.length>92) return -Infinity;
  if (GENERIC.test(name)||NOISE.test(name)||/[•=©@]/.test(name)||/\d{4,}/.test(name)) return -Infinity;
  if (/^[\d\s.,-]+$/.test(name)||SENTENCE.test(name) || /[,;:]$/.test(name)) return -Infinity;
  const alphabet=(name.match(/\p{L}/gu)||[]).length;
  if (alphabet/name.length < .69) return -Infinity;
  if (/^[a-zà-ÿ]/u.test(name)&&words.length>6) return -Infinity;
  const first=words[0].toLocaleLowerCase('it-IT');
  if (STOP.has(first)&&words.length>7) return -Infinity;
  let score=8-position*.8;
  if (name === name.toUpperCase()) score+=1;
  if (/^capitolo\s+\d+\s*[-–:.]/i.test(name)) score+=1;
  if (words.length>=3&&words.length<=7) score+=2;
  return score;
}
function linesFrom(text) {
  return String(text||'').split(/\r?\n/).map(clean).filter(Boolean);
}
/** Analisi incrementale: primi titoli OCR, quindi struttura globale del libro.
 *  Nessun suggerimento se il testo non contiene informazioni sufficienti. */
export function suggestDocumentTitle(pages=[],chapters=[]) {
  const sources=Array.isArray(pages)?pages:[{text:pages}];
  const candidates=[];
  for (let pi=0;pi<Math.min(sources.length,16);pi++) {
    const lines=linesFrom(sources[pi]?.text).slice(0,8);
    for (let li=0;li<lines.length;li++) {
      const name=sanitizeTitle(lines[li]);
      const score=headingScore(name,li)+(pi===0?2:0);
      if (score>5) candidates.push({title:name,score,source:'ocr'});
    }
  }
  for (let i=0;i<Math.min(chapters.length,12);i++) {
    const title=sanitizeTitle(chapters[i]?.title||chapters[i]);
    const normalized=title.replace(/^capitolo\s+\d+\s*[-–.:]\s*/i,'');
    const score=headingScore(normalized,0)+(i===0?2:0)+1;
    if (score>5) candidates.push({title:normalized,score,source:'chapter'});
  }
  const ranked=candidates.sort((a,b)=>b.score-a.score || a.title.length-b.title.length);
  const chosen=ranked[0];
  if (chosen) return {title:chosen.title,source:chosen.source,confidence:Math.min(.9,.55+chosen.score/40)};
  return null;
}
export function suggestPageTitle(text) {
  return suggestDocumentTitle([{text}]);
}
