import { refineParagraphWithAi, summarizeLocally, summaryLevels } from './studyEngine.js';
import { loadResumeState, purgeOldResumeStates, saveResumeState } from './resumeStore.js';

const AI_BATCH_CHAR_LIMIT = 18000;
const AI_BATCH_ITEM_LIMIT = 5;
const LONG_PARAGRAPH_LIMIT = 7000;
const CHUNK_TARGET = 4200;
const CHECKPOINT_VERSION = 2;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  const cleaned = normalize(text);
  if (!cleaned) return [];
  return (cleaned.match(/[^.!?]+(?:[.!?]+|$)/g) || [cleaned]).map(normalize).filter(Boolean);
}

function unique(values, limit = Infinity) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const clean = normalize(value);
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function dsaVersion(summary) {
  return splitSentences(summary)
    .map((sentence) => sentence.replace(/\s*;\s*/g, '. ').replace(/\s*,\s*(mentre|poiché|perché|quindi|tuttavia|inoltre)\s+/gi, '. $1 '))
    .map(normalize)
    .filter(Boolean)
    .join('\n\n');
}

function extractStudyAnchors(text) {
  const source = String(text || '');
  const anchors = new Set();
  const patterns = [
    /\b(?:1[0-9]{3}|20[0-9]{2}|[0-9]{1,3}(?:[.,][0-9]+)?%?)\b/g,
    /\b[A-ZÀ-ÖØ-Ý]{2,8}\b/g,
    /\b(?:[IVXLCDM]{2,8})\b/g,
    /\b[A-Za-z]{1,4}\s*=\s*[^,.;]{1,32}/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      const value = normalize(match[0]);
      if (value.length > 1) anchors.add(value);
    }
  });
  return [...anchors].slice(0, 32);
}

function ensureSourceFidelity(source, generated) {
  const summary = normalize(generated?.summary);
  const dsaSummary = String(generated?.dsaSummary || '').trim() || dsaVersion(summary);
  const searchable = `${summary} ${dsaSummary}`.toLocaleLowerCase('it-IT');
  const missing = extractStudyAnchors(source).filter((anchor) => !searchable.includes(anchor.toLocaleLowerCase('it-IT')));
  if (!missing.length) return { ...generated, summary, dsaSummary };

  const sourceSentences = splitSentences(source);
  const recovery = [];
  for (const anchor of missing) {
    const needle = anchor.toLocaleLowerCase('it-IT');
    const sentence = sourceSentences.find((item) => item.toLocaleLowerCase('it-IT').includes(needle));
    if (sentence && !recovery.includes(sentence)) recovery.push(sentence);
    if (recovery.length >= 5) break;
  }
  if (!recovery.length) return { ...generated, summary, dsaSummary };

  return {
    ...generated,
    summary: normalize([summary, ...recovery].filter(Boolean).join(' ')),
    dsaSummary: [dsaSummary, ...recovery.map(dsaVersion)].filter(Boolean).join('\n\n'),
    keyPoints: unique([...(generated?.keyPoints || []), ...recovery], 8),
    remember: unique([...(generated?.remember || []), ...recovery], 5),
    fidelityRecovered: Number(generated?.fidelityRecovered || 0) + recovery.length,
  };
}

function splitLongParagraph(text) {
  const clean = normalize(text);
  if (clean.length <= LONG_PARAGRAPH_LIMIT) return [clean];
  const chunks = [];
  let current = '';
  for (const sentence of splitSentences(clean)) {
    if (current && current.length + sentence.length + 1 > CHUNK_TARGET) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  if (!chunks.length) {
    for (let start = 0; start < clean.length; start += CHUNK_TARGET) chunks.push(clean.slice(start, start + CHUNK_TARGET));
  }
  return chunks;
}

function paragraphSourceMeta(chapter, paragraphIndex) {
  const meta = chapter.paragraphMeta?.[paragraphIndex] || null;
  return {
    sourcePageStart: meta?.pageStart ?? chapter.pageStart ?? null,
    sourcePageEnd: meta?.pageEnd ?? meta?.pageStart ?? chapter.pageEnd ?? chapter.pageStart ?? null,
    sourceSection: meta?.sectionTitle || null,
    sourceSectionLevel: meta?.sectionLevel || null,
    sourcePart: meta?.sourcePart || null,
  };
}

function pageContext(meta) {
  if (!Number.isFinite(meta?.sourcePageStart)) return '';
  if (!Number.isFinite(meta?.sourcePageEnd) || meta.sourcePageEnd === meta.sourcePageStart) return `p. ${meta.sourcePageStart}`;
  return `pp. ${meta.sourcePageStart}-${meta.sourcePageEnd}`;
}

async function summarizeWithEndpoint(units, level) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paragraphs: units.map((item) => item.text),
      contexts: units.map((item) => ({
        chapterTitle: item.chapterTitle,
        sectionTitle: item.sourceMeta?.sourceSection,
        page: pageContext(item.sourceMeta),
      })),
      level,
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `Endpoint AI non disponibile (${response.status})`);
    error.code = payload?.code || `HTTP_${response.status}`;
    throw error;
  }
  if (!Array.isArray(payload?.summaries) || payload.summaries.length !== units.length) {
    const error = new Error('Risposta AI non valida');
    error.code = 'INVALID_AI_RESPONSE';
    throw error;
  }
  return payload.summaries.map((item) => ({ ...item, engine: item.engine || 'ai' }));
}

function makeChapterBatches(units) {
  const batches = [];
  let current = [];
  let chars = 0;
  let currentChapter = null;

  const flush = () => {
    if (current.length) batches.push(current);
    current = [];
    chars = 0;
  };

  for (const unit of units) {
    if (current.length && unit.chapterIndex !== currentChapter) flush();
    const size = unit.text.length;
    if (current.length && (current.length >= AI_BATCH_ITEM_LIMIT || chars + size > AI_BATCH_CHAR_LIMIT)) flush();
    if (!current.length) currentChapter = unit.chapterIndex;
    current.push(unit);
    chars += size;
  }
  flush();
  return batches;
}

function combineUnitResults(source, pieces) {
  const ordered = [...pieces].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const summaries = ordered.map((item) => item?.summary).filter(Boolean);
  const dsa = ordered.map((item) => item?.dsaSummary).filter(Boolean);
  const engine = ordered.some((item) => item?.engine === 'ai') ? 'ai' : 'locale';
  return ensureSourceFidelity(source, {
    summary: normalize(summaries.join(' ')),
    dsaSummary: dsa.join('\n\n'),
    keyPoints: unique(ordered.flatMap((item) => item?.keyPoints || []), 8),
    remember: unique(ordered.flatMap((item) => item?.remember || []), 5),
    keywords: unique(ordered.flatMap((item) => item?.keywords || []), 12),
    engine,
  });
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildResumeSignature(documentData, level) {
  const full = String(documentData?.fullText || '');
  const chapterShape = (documentData?.chapters || []).map((chapter) => (
    `${chapter.title}|${(chapter.paragraphs || []).map((p) => String(p || '').length).join(',')}`
  )).join('||');
  const fingerprint = [
    CHECKPOINT_VERSION,
    level,
    documentData?.sourceFormat || '',
    documentData?.sourceTitle || '',
    full.length,
    full.slice(0, 3500),
    full.slice(-3500),
    chapterShape,
  ].join('::');
  return `studybook-v09-${hashText(fingerprint)}`;
}

function defaultConcurrency() {
  if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return 2;
  return 3;
}

async function processBatch(batch, level, aiAllowed) {
  if (aiAllowed) {
    try {
      const summaries = await summarizeWithEndpoint(batch, level);
      return { batch, summaries, aiSuccess: true, aiFailure: null };
    } catch (error) {
      return {
        batch,
        summaries: batch.map((item) => summarizeLocally(item.text, level)),
        aiSuccess: false,
        aiFailure: error?.code || 'AI_FAILURE',
      };
    }
  }
  return {
    batch,
    summaries: batch.map((item) => summarizeLocally(item.text, level)),
    aiSuccess: false,
    aiFailure: null,
  };
}

function buildChapters(documentData, results) {
  let cursor = 0;
  return documentData.chapters.map((chapter) => ({
    title: chapter.title,
    pageStart: chapter.pageStart ?? null,
    pageEnd: chapter.pageEnd ?? chapter.pageStart ?? null,
    sections: Array.isArray(chapter.sections) ? chapter.sections.map((section) => ({ ...section })) : [],
    paragraphs: chapter.paragraphs.map((original, paragraphIndex) => {
      const generated = results[cursor] || summarizeLocally(original, 'studio');
      const sourceMeta = paragraphSourceMeta(chapter, paragraphIndex);
      cursor += 1;
      return { original, ...generated, ...sourceMeta };
    }),
  }));
}

export async function buildStudyBook(documentData, {
  level = 'studio',
  preferAi = true,
  onProgress,
  onCheckpoint,
  maxConcurrency,
} = {}) {
  const flat = [];
  documentData.chapters.forEach((chapter, chapterIndex) => {
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      flat.push({
        chapterIndex,
        paragraphIndex,
        chapterTitle: chapter.title,
        text: normalize(paragraph),
        sourceMeta: paragraphSourceMeta(chapter, paragraphIndex),
      });
    });
  });

  if (!flat.length) {
    return {
      version: 6,
      generatedAt: new Date().toISOString(),
      level,
      engine: 'locale',
      sourceStructure: documentData.structure || null,
      chapters: [],
    };
  }

  purgeOldResumeStates().catch(() => {});
  const signature = buildResumeSignature(documentData, level);
  const saved = await loadResumeState(signature);
  const finalResults = Array(flat.length).fill(null);
  let resumedParagraphs = 0;

  if (saved?.version === CHECKPOINT_VERSION && saved?.signature === signature && saved?.level === level) {
    (saved.results || []).forEach((item, index) => {
      if (index < finalResults.length && item?.summary && item?.dsaSummary) {
        finalResults[index] = item;
        resumedParagraphs += 1;
      }
    });
  }

  const unitTotals = new Map();
  const unitResults = new Map();
  const unitDone = new Map();
  const units = [];

  flat.forEach((item, parentIndex) => {
    const chunks = splitLongParagraph(item.text);
    unitTotals.set(parentIndex, chunks.length);
    if (finalResults[parentIndex]) return;
    unitResults.set(parentIndex, []);
    unitDone.set(parentIndex, 0);
    chunks.forEach((chunk, chunkIndex) => units.push({ ...item, text: chunk, parentIndex, chunkIndex }));
  });

  const completedParents = new Set(finalResults.map((item, index) => item ? index : null).filter((value) => value !== null));
  onProgress?.(completedParents.size, flat.length, resumedParagraphs ? 'resume' : 'preparazione');

  const batches = makeChapterBatches(units);
  let aiEnabled = Boolean(preferAi);
  let concurrency = Math.max(1, Math.min(4, Number(maxConcurrency || defaultConcurrency())));
  let maxConcurrencyUsed = concurrency;
  let cleanWaves = 0;
  let batchCursor = 0;
  let aiFailures = 0;

  while (batchCursor < batches.length) {
    const waveSize = Math.min(concurrency, batches.length - batchCursor);
    const waveBatches = batches.slice(batchCursor, batchCursor + waveSize);
    const aiAllowedForWave = aiEnabled;
    const wave = await Promise.all(waveBatches.map((batch) => processBatch(batch, level, aiAllowedForWave)));
    batchCursor += waveSize;

    let waveFailures = 0;
    let waveAiSuccesses = 0;
    let aiNotConfigured = false;

    for (const item of wave) {
      if (item.aiSuccess) waveAiSuccesses += 1;
      if (item.aiFailure) {
        aiFailures += 1;
        waveFailures += 1;
        if (item.aiFailure === 'AI_NOT_CONFIGURED') aiNotConfigured = true;
      }

      item.batch.forEach((unit, offset) => {
        const piece = ensureSourceFidelity(unit.text, item.summaries[offset]);
        const pieces = unitResults.get(unit.parentIndex) || [];
        pieces.push({ chunkIndex: unit.chunkIndex, ...piece });
        unitResults.set(unit.parentIndex, pieces);
        const nextDone = (unitDone.get(unit.parentIndex) || 0) + 1;
        unitDone.set(unit.parentIndex, nextDone);
        if (nextDone >= (unitTotals.get(unit.parentIndex) || 1) && !finalResults[unit.parentIndex]) {
          finalResults[unit.parentIndex] = combineUnitResults(flat[unit.parentIndex].text, pieces);
          completedParents.add(unit.parentIndex);
        }
      });
    }

    if (aiNotConfigured) {
      aiEnabled = false;
      concurrency = 1;
      cleanWaves = 0;
    } else if (waveFailures > 0) {
      concurrency = Math.max(1, concurrency - 1);
      cleanWaves = 0;
    } else if (aiAllowedForWave && waveAiSuccesses === wave.length) {
      cleanWaves += 1;
      if (cleanWaves >= 3 && concurrency < 4) {
        concurrency += 1;
        maxConcurrencyUsed = Math.max(maxConcurrencyUsed, concurrency);
        cleanWaves = 0;
      }
    }

    const checkpoint = {
      version: CHECKPOINT_VERSION,
      signature,
      level,
      results: finalResults,
      completed: completedParents.size,
      total: flat.length,
      aiEnabled,
      concurrency,
      savedAt: new Date().toISOString(),
    };
    await saveResumeState(signature, checkpoint);
    if (onCheckpoint) await onCheckpoint(checkpoint);

    const waveEngine = wave.some((item) => item.aiSuccess)
      ? (wave.some((item) => item.aiFailure) ? 'misto' : 'ai')
      : (aiAllowedForWave ? 'misto' : 'locale');
    onProgress?.(completedParents.size, flat.length, waveEngine, {
      concurrency,
      resumedParagraphs,
      aiFailures,
    });
  }

  for (let index = 0; index < finalResults.length; index += 1) {
    if (!finalResults[index]) finalResults[index] = summarizeLocally(flat[index].text, level);
  }

  const aiParagraphs = finalResults.filter((item) => item?.engine === 'ai').length;
  const engine = aiParagraphs === finalResults.length ? 'ai' : aiParagraphs > 0 ? 'misto' : 'locale';
  const completedCheckpoint = {
    version: CHECKPOINT_VERSION,
    signature,
    level,
    results: finalResults,
    completed: finalResults.length,
    total: flat.length,
    complete: true,
    savedAt: new Date().toISOString(),
  };
  await saveResumeState(signature, completedCheckpoint);

  return {
    version: 6,
    generatedAt: new Date().toISOString(),
    level,
    engine,
    resumeSignature: signature,
    quality: {
      paragraphs: finalResults.length,
      aiParagraphs,
      localParagraphs: finalResults.length - aiParagraphs,
      resumedParagraphs,
      aiFailures,
      maxConcurrencyUsed,
      longParagraphsSplit: [...unitTotals.values()].filter((value) => value > 1).length,
      fidelityRecovered: finalResults.reduce((sum, item) => sum + Number(item?.fidelityRecovered || 0), 0),
    },
    sourceStructure: documentData.structure || null,
    chapters: buildChapters(documentData, finalResults),
  };
}

export { refineParagraphWithAi, summaryLevels };
