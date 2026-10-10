/* LAB10 - Glossario intelligente universale, locale e senza dipendenza da materia. */
const DEFINITIONS = Object.freeze({
  CGIL: 'Confederazione Generale Italiana del Lavoro, organizzazione sindacale italiana.',
  INPS: 'Istituto Nazionale della Previdenza Sociale.',
  INAIL: 'Istituto Nazionale per l’Assicurazione contro gli Infortuni sul Lavoro.',
  MEF: 'Ministero dell’Economia e delle Finanze italiano.',
  TFR: 'Trattamento di Fine Rapporto: somma maturata durante il rapporto di lavoro e normalmente corrisposta alla sua cessazione.',
  CCNL: 'Contratto Collettivo Nazionale di Lavoro.',
  IRPEF: 'Imposta sul Reddito delle Persone Fisiche.',
  IVA: 'Imposta sul Valore Aggiunto.',
  PIL: 'Prodotto Interno Lordo.',
  BCE: 'Banca Centrale Europea.',
  UE: 'Unione europea.',
  ONU: 'Organizzazione delle Nazioni Unite.',
  SSN: 'Servizio Sanitario Nazionale italiano.',
  DNA: 'Acido desossiribonucleico, molecola che conserva l’informazione genetica.',
  RNA: 'Acido ribonucleico, famiglia di molecole coinvolte in molte funzioni cellulari.',
  ICT: 'Information and Communication Technology, tecnologie dell’informazione e della comunicazione.',
  PMI: 'Piccole e Medie Imprese, nel contesto economico e aziendale.',
  CPU: 'Central Processing Unit, unità centrale di elaborazione di un computer.',
  RAM: 'Random Access Memory, memoria ad accesso casuale.',
  API: 'Application Programming Interface, interfaccia che permette a programmi diversi di comunicare.',
  URL: 'Uniform Resource Locator, indirizzo di una risorsa in rete.',
  HTML: 'HyperText Markup Language, linguaggio di marcatura delle pagine web.',
  HTTP: 'Hypertext Transfer Protocol, protocollo di comunicazione web.',
  HTTPS: 'Versione di HTTP protetta tramite TLS.',
  PDF: 'Portable Document Format, formato di documento a impaginazione fissa.',
  OCR: 'Optical Character Recognition, riconoscimento ottico dei caratteri.',
  SQL: 'Structured Query Language, linguaggio per interrogare e gestire basi di dati relazionali.',
  JSON: 'JavaScript Object Notation, formato testuale strutturato per lo scambio di dati.',
  GDPR: 'General Data Protection Regulation, regolamento generale dell’Unione europea sulla protezione dei dati personali.',
});
const STOP_ACRONYMS = new Set([
  'CAPITOLO','INTRODUZIONE','INDICE','CONCLUSIONI','STUDYBOOK','ALL','NEL','PER','TRA',
  'UNO','UNA','CHE','NON','CON','SONO','DEL','DEI','DELLA','NELLA','II','III','IV','VI','VII','VIII','IX','XI'
]);

function sanitize(value) { return String(value ?? '').replace(/\s+/g,' ').trim(); }
function escapeRegex(value) { return String(value).replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&'); }
function letterOrNumber(char) { return Boolean(char && /[\p{L}\p{N}_]/u.test(char)); }
function wholeOccurrence(text, term) {
  const search = new RegExp(escapeRegex(term),'giu');
  for (const m of text.matchAll(search)) {
    if (!letterOrNumber(text[m.index-1]) && !letterOrNumber(text[m.index+m[0].length])) return true;
  }
  return false;
}
/** Solo voci realmente presenti nel paragrafo, senza inventare definizioni. */
export function buildUniversalGlossary(text, paragraphEntries = [], chapterEntries = []) {
  const value = String(text ?? '');
  const result = [], seen = new Set();
  function add(term, definition, basis, kind) {
    const name = sanitize(term), key = name.toLocaleLowerCase('it-IT');
    if (!name || !wholeOccurrence(value,name) || seen.has(key) || result.length >= 64) return;
    seen.add(key);
    result.push({term:name,definition:sanitize(definition)||null,basis,kind});
  }
  // La fonte del libro è sempre prioritaria rispetto ai dizionari generici.
  for (const item of [...paragraphEntries,...chapterEntries]) {
    if (item?.term && item?.definition) add(item.term,item.definition,item.basis||'source','book');
  }
  for (const [key,definition] of Object.entries(DEFINITIONS)) add(key,definition,'general','acronym');
  // Le sigle sconosciute restano interrogabili, ma senza espansioni inventate.
  for (const acronym of value.match(/\b[A-ZÀ-ÖØ-Þ]{2,10}(?:[/-][A-Z0-9]{2,8})?\b/gu)||[]) {
    if (!STOP_ACRONYMS.has(acronym)) add(acronym,null,'unverified','acronym');
  }
  const patterns = [
    /\b(?:art\.|artt\.)\s*\d+(?:[-–]\d+)?(?:\s*(?:bis|ter|quater))?(?:\s*(?:del|della)\s*[\p{L}. ]{2,24})?/giu,
    /\b(?:D\.?\s*Lgs\.?|D\.?\s*P\.?\s*R\.?|Legge|L\.)\s*(?:n\.?\s*)?\d+\s*\/\s*\d{4}\b/giu,
    /\b(?:ISO|IEC|UNI)\s*\d{3,7}(?:[-:]\d{1,5})?\b/giu,
  ];
  for (const regex of patterns) for (const match of value.matchAll(regex)) add(match[0],null,'unverified','reference');
  return result;
}
/** Suddivisione sicura: una sigla non va evidenziata come sottostringa di altre parole. */
export function splitUniversalText(text, entries = []) {
  const source = String(text ?? ''), valid = entries.filter(e=>e?.term).sort((a,b)=>b.term.length-a.term.length);
  if (!valid.length) return [{text:source,entry:null}];
  const regex = new RegExp(valid.map(e=>escapeRegex(e.term)).join('|'),'giu');
  const lookup = new Map(valid.map(e=>[e.term.toLocaleLowerCase('it-IT'),e]));
  const pieces=[];let offset=0;
  for (const found of source.matchAll(regex)) {
    const i=found.index,end=i+found[0].length;
    if (letterOrNumber(source[i-1])||letterOrNumber(source[end])) continue;
    if (i>offset) pieces.push({text:source.slice(offset,i),entry:null});
    pieces.push({text:found[0],entry:lookup.get(found[0].toLocaleLowerCase('it-IT'))||null});
    offset=end;
  }
  if (offset<source.length||!pieces.length) pieces.push({text:source.slice(offset),entry:null});
  return pieces;
}
