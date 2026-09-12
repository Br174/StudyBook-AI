import { performance } from 'node:perf_hooks';
import { detectChaptersFromPages } from '../src/lib/documentParserV09.js';
import { buildStudyBook } from '../src/lib/studyEngineV09.js';

const TOTAL_PAGES = 600;
const INDEX_PAGES = 6;
const CHAPTERS = 80;
const CONTENT_START = INDEX_PAGES + 1;
const CONTENT_PAGES = TOTAL_PAGES - INDEX_PAGES;
const MAX_PARSE_MS = 8000;
const MAX_BUILD_MS = 30000;
const MAX_HEAP_GROWTH_MB = 256;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function chapterForPage(pageNumber) {
  const offset = pageNumber - CONTENT_START;
  return Math.min(CHAPTERS - 1, Math.floor((offset * CHAPTERS) / CONTENT_PAGES));
}

function firstPageForChapter(chapterIndex) {
  return CONTENT_START + Math.ceil((chapterIndex * CONTENT_PAGES) / CHAPTERS);
}

function indexPage(pageNumber) {
  const firstChapter = (pageNumber - 1) * 14 + 1;
  const lines = ['INDICE GENERALE'];
  for (let n = firstChapter; n < Math.min(firstChapter + 14, CHAPTERS + 1); n += 1) {
    lines.push(`Capitolo ${n} ................................ ${firstPageForChapter(n - 1)}`);
  }
  while (lines.length < 8) lines.push(`Appendice ................................ ${pageNumber + 20}`);
  return { pageNumber, text: lines.join('\n'), source: 'synthetic-index' };
}

function bodyForPage(pageNumber, chapterNumber, relativePage) {
  const lines = [];
  if (pageNumber === firstPageForChapter(chapterNumber - 1)) {
    lines.push(`CAPITOLO ${chapterNumber} — AREA DI STUDIO ${chapterNumber}`, '');
    lines.push(`${chapterNumber}.1 Concetti fondamentali`, '');
  } else if (relativePage === 2) {
    lines.push(`${chapterNumber}.1.1 Approfondimento operativo`, '');
  } else if (relativePage === 4) {
    lines.push(`${chapterNumber}.2 Regole ed eccezioni`, '');
  }

  lines.push(
    `Nella pagina ${pageNumber} viene presentato il nucleo informativo del capitolo ${chapterNumber}. `
      + `Il valore di controllo ${pageNumber} deve restare disponibile nello StudyBook perché rappresenta un dato utile alla verifica. `
      + `Si definisce principio operativo la regola che collega una condizione alla conseguenza prevista nel testo. `
      + `Nel 2026 la formulazione di esempio mantiene espliciti causa, effetto, eccezione e terminologia tecnica senza aggiungere conoscenze esterne.`,
  );

  if (pageNumber % 97 === 0) {
    const longTail = Array.from({ length: 95 }, (_, index) => (
      `La proposizione estesa ${index + 1} della pagina ${pageNumber} conserva il dato ${pageNumber}, la definizione e il collegamento logico tra premessa e conseguenza`
    )).join(' ');
    lines.push('', longTail);
  }

  return { pageNumber, text: lines.join('\n'), source: 'synthetic-content' };
}

function makePages() {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= TOTAL_PAGES; pageNumber += 1) {
    if (pageNumber <= INDEX_PAGES) {
      pages.push(indexPage(pageNumber));
      continue;
    }
    const chapterIndex = chapterForPage(pageNumber);
    const chapterNumber = chapterIndex + 1;
    const relativePage = pageNumber - firstPageForChapter(chapterIndex);
    pages.push(bodyForPage(pageNumber, chapterNumber, relativePage));
  }
  return pages;
}

function countParagraphs(chapters) {
  return chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0);
}

function allText(chapters) {
  return chapters.flatMap((chapter) => chapter.paragraphs || []).join('\n');
}

function megabytes(bytes) {
  return Math.round((bytes / 1024 / 1024) * 10) / 10;
}

const pages = makePages();
const heapBefore = process.memoryUsage().heapUsed;
const parseStarted = performance.now();
const chapters = detectChaptersFromPages(pages);
const parseMs = performance.now() - parseStarted;
const parsedParagraphs = countParagraphs(chapters);
const parsedText = allText(chapters);

assert(pages.length === TOTAL_PAGES, `Fixture non valida: attese ${TOTAL_PAGES} pagine, trovate ${pages.length}.`);
assert(chapters.length === CHAPTERS, `Gerarchia errata: attesi ${CHAPTERS} capitoli, trovati ${chapters.length}.`);
assert(chapters.every((chapter, index) => chapter.title.includes(`CAPITOLO ${index + 1}`)), 'Ordine o titolo dei capitoli non stabile.');
assert(chapters.every((chapter, index) => chapter.pageStart === firstPageForChapter(index)), 'Pagina iniziale di almeno un capitolo non corretta.');
assert(chapters.every((chapter, index) => index === chapters.length - 1 || chapter.pageEnd < chapters[index + 1].pageStart), 'Intervalli pagina dei capitoli sovrapposti.');
assert(chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0) >= CHAPTERS * 2, 'Sono state perse troppe sezioni numerate.');

for (let pageNumber = CONTENT_START; pageNumber <= TOTAL_PAGES; pageNumber += 1) {
  assert(parsedText.includes(`valore di controllo ${pageNumber}`), `Contenuto perso durante il parsing alla pagina ${pageNumber}.`);
}

assert(parseMs < MAX_PARSE_MS, `Parsing troppo lento: ${Math.round(parseMs)} ms > ${MAX_PARSE_MS} ms.`);

const documentData = {
  sourceTitle: 'Stress test sintetico 600 pagine',
  sourceFormat: 'synthetic',
  pages,
  chapters,
  fullText: pages.map((page) => page.text).join('\n\n'),
  structure: {
    pageCount: TOTAL_PAGES,
    chapterCount: chapters.length,
    sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
    paragraphCount: parsedParagraphs,
    textFirst: true,
    stressFixture: true,
  },
};

let lastProgress = 0;
let lastTotal = 0;
const buildStarted = performance.now();
const book = await buildStudyBook(documentData, {
  level: 'studio',
  preferAi: false,
  maxConcurrency: 4,
  onProgress(done, total) {
    assert(done >= lastProgress, 'Il progresso è arretrato durante l’elaborazione.');
    lastProgress = done;
    lastTotal = total;
  },
});
const buildMs = performance.now() - buildStarted;
const heapAfter = process.memoryUsage().heapUsed;
const heapGrowth = Math.max(0, heapAfter - heapBefore);
const outputParagraphs = countParagraphs(book.chapters);

assert(book.chapters.length === CHAPTERS, `Ricostruzione errata: attesi ${CHAPTERS} capitoli, trovati ${book.chapters.length}.`);
assert(outputParagraphs === parsedParagraphs, `Paragrafi persi: ingresso ${parsedParagraphs}, uscita ${outputParagraphs}.`);
assert(lastTotal === parsedParagraphs && lastProgress === parsedParagraphs, `Progresso finale incoerente: ${lastProgress}/${lastTotal}, atteso ${parsedParagraphs}/${parsedParagraphs}.`);
assert(book.quality?.paragraphs === parsedParagraphs, 'Metriche qualità non coerenti con i paragrafi elaborati.');
assert(book.quality?.localParagraphs === parsedParagraphs, 'Lo stress test locale non deve riportare paragrafi AI.');
assert((book.quality?.glossaryEntries || 0) >= Math.floor(parsedParagraphs * 0.8), 'Il glossario contestuale è stato perso su troppi paragrafi.');

for (const chapter of book.chapters) {
  for (const paragraph of chapter.paragraphs) {
    const page = paragraph.sourcePageStart;
    if (!Number.isFinite(page) || page < CONTENT_START) continue;
    const numberPattern = new RegExp(`\\b${page}\\b`);
    assert(numberPattern.test(paragraph.summary || ''), `Dato numerico della pagina ${page} non preservato nel riassunto.`);
  }
}

assert(buildMs < MAX_BUILD_MS, `Ricostruzione locale troppo lenta: ${Math.round(buildMs)} ms > ${MAX_BUILD_MS} ms.`);
assert(megabytes(heapGrowth) < MAX_HEAP_GROWTH_MB, `Crescita heap eccessiva: ${megabytes(heapGrowth)} MB > ${MAX_HEAP_GROWTH_MB} MB.`);

console.log(JSON.stringify({
  ok: true,
  pages: TOTAL_PAGES,
  chapters: book.chapters.length,
  sections: documentData.structure.sectionCount,
  paragraphs: parsedParagraphs,
  glossaryEntries: book.quality?.glossaryEntries || 0,
  parseMs: Math.round(parseMs),
  buildMs: Math.round(buildMs),
  heapGrowthMb: megabytes(heapGrowth),
  engine: book.engine,
  checkpointSignature: Boolean(book.resumeSignature),
}, null, 2));
