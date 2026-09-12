import assert from 'node:assert/strict';
import { buildStudyBook } from '../src/lib/studyEngineV11.js';

const originalFetch = globalThis.fetch;
const requests = [];
let call = 0;

function aiSummary(text, index) {
  const compact = String(text || '').slice(0, 180);
  return {
    summary: `AI ${index}: ${compact}`,
    dsaSummary: `AI ${index}: ${compact}`,
    keyPoints: [`Punto ${index}`],
    remember: [`Ricorda ${index}`],
    keywords: ['concetto'],
    glossary: [],
    engine: 'ai',
  };
}

globalThis.fetch = async (_url, options = {}) => {
  call += 1;
  const body = JSON.parse(options.body || '{}');
  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [];
  requests.push(paragraphs.map((text) => String(text).length));

  if (call === 2) {
    return {
      ok: false,
      status: 503,
      async json() {
        return { error: 'Provider temporaneamente non disponibile', code: 'UPSTREAM_FAILURE' };
      },
    };
  }

  return {
    ok: true,
    status: 200,
    async json() {
      return {
        summaries: paragraphs.map((text, index) => aiSummary(text, index)),
      };
    },
  };
};

try {
  const pathological = (`concetto scientifico specifico `).repeat(1150).trim();
  assert.ok(pathological.length > 25000, 'Il fixture deve superare 25.000 caratteri');
  assert.ok(!/[.!?]/.test(pathological), 'Il fixture deve simulare una frase senza punteggiatura');

  const documentData = {
    sourceFormat: 'txt',
    sourceTitle: 'Stress paragrafo patologico',
    fullText: pathological,
    structure: { test: 'long-paragraph' },
    chapters: [
      {
        title: 'Capitolo 1',
        pageStart: 1,
        pageEnd: 1,
        paragraphs: [pathological],
        paragraphMeta: [
          { pageStart: 1, pageEnd: 1, sectionTitle: 'Sezione 1', sectionLevel: 1 },
        ],
        sections: [],
      },
    ],
  };

  const book = await buildStudyBook(documentData, {
    level: 'studio',
    preferAi: true,
    maxConcurrency: 1,
  });

  assert.equal(book.chapters.length, 1);
  assert.equal(book.chapters[0].paragraphs.length, 1, 'Il paragrafo originale deve essere ricomposto');
  assert.equal(book.chapters[0].paragraphs[0].original, pathological, 'Il testo originale deve restare intatto');
  assert.equal(book.chapters[0].paragraphs[0].engine, 'misto', 'AI + fallback locale deve risultare misto');
  assert.equal(book.engine, 'misto');

  assert.equal(book.quality.paragraphs, 1);
  assert.equal(book.quality.longParagraphsSplit, 1);
  assert.equal(book.quality.mixedParagraphs, 1);
  assert.ok(book.quality.totalChunks > 1);
  assert.ok(book.quality.aiChunks > 0);
  assert.ok(book.quality.localChunks > 0);
  assert.ok(book.quality.maxChunkChars <= 4200, `Chunk troppo grande: ${book.quality.maxChunkChars}`);
  assert.ok(book.quality.aiChunkCoveragePercent > 0 && book.quality.aiChunkCoveragePercent < 100);

  const requestedSizes = requests.flat();
  assert.ok(requestedSizes.length > 1, 'Il paragrafo deve produrre più richieste/chunk');
  assert.ok(Math.max(...requestedSizes) <= 4200, `Richiesta AI troppo grande: ${Math.max(...requestedSizes)}`);
  assert.ok(call >= 2, 'Il test deve includere almeno una richiesta AI riuscita e una fallita');

  console.log(JSON.stringify({
    ok: true,
    originalChars: pathological.length,
    chunks: book.quality.totalChunks,
    maxChunkChars: book.quality.maxChunkChars,
    aiChunks: book.quality.aiChunks,
    localChunks: book.quality.localChunks,
    mixedParagraphs: book.quality.mixedParagraphs,
    aiChunkCoveragePercent: book.quality.aiChunkCoveragePercent,
    requests: call,
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
}
