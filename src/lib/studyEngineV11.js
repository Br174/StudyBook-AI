import {
  buildStudyBook as buildBaseStudyBook,
  refineParagraphWithAi,
  summaryLevels,
} from './studyEngineV09.js';

const LONG_PARAGRAPH_LIMIT = 7000;
const CHUNK_TARGET = 4200;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  const clean = normalize(text);
  if (!clean) return [];
  return (clean.match(/[^.!?]+(?:[.!?]+|$)/g) || [clean]).map(normalize).filter(Boolean);
}

function unique(values, limit = Infinity) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const clean = normalize(value);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= limit) break;
  }
  return output;
}

function hardSplit(text, maxLength = CHUNK_TARGET) {
  const clean = normalize(text);
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];

  const output = [];
  let current = '';

  for (const rawToken of clean.split(/\s+/)) {
    let token = rawToken;
    if (!token) continue;

    if (token.length > maxLength) {
      if (current) {
        output.push(current);
        current = '';
      }
      while (token.length > maxLength) {
        output.push(token.slice(0, maxLength));
        token = token.slice(maxLength);
      }
      if (token) current = token;
      continue;
    }

    if (current && current.length + token.length + 1 > maxLength) {
      output.push(current);
      current = token;
    } else {
      current = current ? `${current} ${token}` : token;
    }
  }

  if (current) output.push(current);
  return output;
}

function splitLongParagraph(text) {
  const clean = normalize(text);
  if (!clean) return [''];
  if (clean.length <= LONG_PARAGRAPH_LIMIT) return [clean];

  const safeSegments = splitSentences(clean)
    .flatMap((sentence) => hardSplit(sentence, CHUNK_TARGET));
  const chunks = [];
  let current = '';

  for (const segment of safeSegments) {
    if (!segment) continue;
    if (current && current.length + segment.length + 1 > CHUNK_TARGET) {
      chunks.push(current);
      current = segment;
    } else {
      current = current ? `${current} ${segment}` : segment;
    }
  }
  if (current) chunks.push(current);

  const safeChunks = (chunks.length ? chunks : hardSplit(clean, CHUNK_TARGET))
    .flatMap((chunk) => (chunk.length > CHUNK_TARGET ? hardSplit(chunk, CHUNK_TARGET) : [chunk]));

  return safeChunks.length ? safeChunks : [clean.slice(0, CHUNK_TARGET)];
}

function normalizeGlossary(entries, limit = 8) {
  const seen = new Set();
  const output = [];
  for (const entry of entries || []) {
    const term = normalize(entry?.term);
    const definition = normalize(entry?.definition);
    if (!term || !definition) continue;
    const key = term.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ ...entry, term, definition });
    if (output.length >= limit) break;
  }
  return output;
}

function mergeChunkResults(original, pieces) {
  const valid = pieces.filter(Boolean);
  const engines = valid.map((item) => item?.engine || 'locale');
  const aiChunks = engines.filter((engine) => engine === 'ai').length;
  const localChunks = engines.filter((engine) => engine === 'locale').length;
  const mixedChunks = engines.filter((engine) => engine === 'misto').length;
  const engine = aiChunks === valid.length && valid.length
    ? 'ai'
    : localChunks === valid.length && valid.length
      ? 'locale'
      : 'misto';

  const first = valid[0] || {};
  return {
    ...first,
    original,
    summary: normalize(valid.map((item) => item?.summary).filter(Boolean).join(' ')),
    dsaSummary: valid.map((item) => item?.dsaSummary).filter(Boolean).join('\n\n'),
    keyPoints: unique(valid.flatMap((item) => item?.keyPoints || []), 10),
    remember: unique(valid.flatMap((item) => item?.remember || []), 6),
    keywords: unique(valid.flatMap((item) => item?.keywords || []), 14),
    glossary: normalizeGlossary(valid.flatMap((item) => item?.glossary || []), 8),
    fidelityRecovered: valid.reduce((sum, item) => sum + Number(item?.fidelityRecovered || 0), 0),
    engine,
    chunkStats: {
      totalChunks: valid.length,
      aiChunks,
      localChunks,
      mixedChunks,
    },
  };
}

function prepareDocument(documentData) {
  let totalOriginalParagraphs = 0;
  let totalChunks = 0;
  let longParagraphsSplit = 0;
  let maxChunkChars = 0;

  const mappings = [];
  const chapters = (documentData?.chapters || []).map((chapter, chapterIndex) => {
    const paragraphs = [];
    const paragraphMeta = [];
    const chapterMappings = [];

    (chapter.paragraphs || []).forEach((original, paragraphIndex) => {
      const chunks = splitLongParagraph(original);
      if (chunks.length > 1) longParagraphsSplit += 1;
      const start = paragraphs.length;
      const sourceMeta = chapter.paragraphMeta?.[paragraphIndex] || null;

      chunks.forEach((chunk) => {
        paragraphs.push(chunk);
        paragraphMeta.push(sourceMeta ? { ...sourceMeta } : null);
        maxChunkChars = Math.max(maxChunkChars, chunk.length);
      });

      chapterMappings.push({
        chapterIndex,
        paragraphIndex,
        original,
        start,
        count: chunks.length,
        sourceMeta,
      });
      totalOriginalParagraphs += 1;
      totalChunks += chunks.length;
    });

    mappings.push(chapterMappings);
    return {
      ...chapter,
      paragraphs,
      paragraphMeta,
    };
  });

  return {
    transformed: {
      ...documentData,
      chapters,
      structure: {
        ...(documentData?.structure || {}),
        originalParagraphCount: totalOriginalParagraphs,
        processingChunkCount: totalChunks,
      },
    },
    mappings,
    totalOriginalParagraphs,
    totalChunks,
    longParagraphsSplit,
    maxChunkChars,
  };
}

function progressFromChunks(doneChunks, totalChunks, totalOriginal) {
  if (!totalOriginal) return 0;
  if (!totalChunks) return totalOriginal;
  if (doneChunks >= totalChunks) return totalOriginal;
  return Math.min(totalOriginal, Math.floor((Math.max(0, doneChunks) / totalChunks) * totalOriginal));
}

function metricChunks(item, key) {
  const stats = item?.chunkStats;
  if (stats && Number.isFinite(stats[key])) return Number(stats[key]);
  if (key === 'totalChunks') return 1;
  if (key === 'aiChunks') return item?.engine === 'ai' ? 1 : 0;
  if (key === 'localChunks') return item?.engine === 'locale' ? 1 : 0;
  if (key === 'mixedChunks') return item?.engine === 'misto' ? 1 : 0;
  return 0;
}

export async function buildStudyBook(documentData, options = {}) {
  const prepared = prepareDocument(documentData);
  const originalOnProgress = options.onProgress;

  const baseBook = await buildBaseStudyBook(prepared.transformed, {
    ...options,
    onProgress(doneChunks, totalChunks, phase, meta = {}) {
      if (!originalOnProgress) return;
      const done = progressFromChunks(
        doneChunks,
        totalChunks || prepared.totalChunks,
        prepared.totalOriginalParagraphs,
      );
      originalOnProgress(done, prepared.totalOriginalParagraphs, phase, {
        ...meta,
        chunksDone: doneChunks,
        chunksTotal: totalChunks || prepared.totalChunks,
        resumedChunks: Number(meta?.resumedParagraphs || 0),
        resumedParagraphs: progressFromChunks(
          Number(meta?.resumedParagraphs || 0),
          totalChunks || prepared.totalChunks,
          prepared.totalOriginalParagraphs,
        ),
      });
    },
  });

  const chapters = (documentData?.chapters || []).map((sourceChapter, chapterIndex) => {
    const generatedChapter = baseBook?.chapters?.[chapterIndex] || { paragraphs: [] };
    const chapterMappings = prepared.mappings[chapterIndex] || [];
    const paragraphs = chapterMappings.map((mapping) => {
      const pieces = (generatedChapter.paragraphs || []).slice(
        mapping.start,
        mapping.start + mapping.count,
      );
      const merged = mergeChunkResults(mapping.original, pieces);
      return {
        ...merged,
        sourcePageStart: mapping.sourceMeta?.pageStart ?? sourceChapter.pageStart ?? merged.sourcePageStart ?? null,
        sourcePageEnd: mapping.sourceMeta?.pageEnd ?? mapping.sourceMeta?.pageStart ?? sourceChapter.pageEnd ?? merged.sourcePageEnd ?? null,
        sourceSection: mapping.sourceMeta?.sectionTitle ?? merged.sourceSection ?? null,
        sourceSectionLevel: mapping.sourceMeta?.sectionLevel ?? merged.sourceSectionLevel ?? null,
        sourcePart: mapping.sourceMeta?.sourcePart ?? merged.sourcePart ?? null,
      };
    });

    return {
      ...generatedChapter,
      title: sourceChapter.title || generatedChapter.title,
      pageStart: sourceChapter.pageStart ?? generatedChapter.pageStart ?? null,
      pageEnd: sourceChapter.pageEnd ?? generatedChapter.pageEnd ?? null,
      sections: Array.isArray(sourceChapter.sections)
        ? sourceChapter.sections.map((section) => ({ ...section }))
        : (generatedChapter.sections || []),
      paragraphs,
    };
  });

  const allParagraphs = chapters.flatMap((chapter) => chapter.paragraphs || []);
  const aiParagraphs = allParagraphs.filter((item) => item?.engine === 'ai').length;
  const mixedParagraphs = allParagraphs.filter((item) => item?.engine === 'misto').length;
  const localParagraphs = allParagraphs.length - aiParagraphs - mixedParagraphs;
  const aiChunks = allParagraphs.reduce((sum, item) => sum + metricChunks(item, 'aiChunks'), 0);
  const localChunks = allParagraphs.reduce((sum, item) => sum + metricChunks(item, 'localChunks'), 0);
  const mixedChunks = allParagraphs.reduce((sum, item) => sum + metricChunks(item, 'mixedChunks'), 0);
  const totalChunks = allParagraphs.reduce((sum, item) => sum + metricChunks(item, 'totalChunks'), 0);
  const resumedChunks = Number(baseBook?.quality?.resumedParagraphs || 0);
  const engine = aiParagraphs === allParagraphs.length && allParagraphs.length
    ? 'ai'
    : localParagraphs === allParagraphs.length && allParagraphs.length
      ? 'locale'
      : 'misto';

  return {
    ...baseBook,
    version: Math.max(Number(baseBook?.version || 0), 8),
    engine,
    sourceStructure: documentData?.structure || baseBook?.sourceStructure || null,
    chapters,
    quality: {
      ...(baseBook?.quality || {}),
      paragraphs: allParagraphs.length,
      aiParagraphs,
      mixedParagraphs,
      localParagraphs,
      resumedChunks,
      resumedParagraphs: progressFromChunks(
        resumedChunks,
        prepared.totalChunks,
        prepared.totalOriginalParagraphs,
      ),
      longParagraphsSplit: prepared.longParagraphsSplit,
      totalChunks,
      aiChunks,
      localChunks,
      mixedChunks,
      maxChunkChars: prepared.maxChunkChars,
      aiChunkCoveragePercent: totalChunks
        ? Math.round((aiChunks / totalChunks) * 1000) / 10
        : 0,
    },
  };
}

export { refineParagraphWithAi, summaryLevels };
