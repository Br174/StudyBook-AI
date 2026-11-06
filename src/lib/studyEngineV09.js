import { apiEndpoint } from './apiEndpoint.js';
import { filterGlossaryEntries } from './glossaryQuality.js';
import { refineParagraphWithAi, summarizeLocally, summaryLevels } from './studyEngine.js';
import {
  loadResumeState,
  loadRuntimeUnitResults,
  purgeOldResumeStates,
  purgeOldRuntimeUnitResults,
  saveResumeState,
  saveRuntimeUnitResults,
} from './resumeStore.js';
import {
  MOTORLAB_RUNTIME_VERSION,
  chooseRuntimeConcurrency,
  makeRuntimeUnitKey,
  runAdaptiveBatchQueue,
} from './motorLabRuntime.js';

const AI_BATCH_CHAR_LIMIT = 8500;
const AI_BATCH_ITEM_LIMIT = 2;
const LONG_PARAGRAPH_LIMIT = 7000;
const CHUNK_TARGET = 4200;
const CHECKPOINT_VERSION = 5;

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

function glossaryPlacement(definition) {
  const clean = normalize(definition);
  const words = clean.split(/\s+/).filter(Boolean).length;
  return words <= 6 && clean.length <= 72 ? 'inline' : 'side';
}

function normalizeGlossary(entries, source, limit = 6, summary = '') {
  return filterGlossaryEntries(entries, {
    source,
    summary,
    limit,
    minConfidence: 0.82,
    requireConfidence: false,
  }).map((entry) => ({
    ...entry,
    placement: 'side',
    basis: entry?.basis || 'source',
  }));
}

function extractLocalGlossary(source) {
  const found = [];
  const word = "[A-Za-zÀ-ÖØ-öø-ÿ'’\\-]+";
  const phrase = `${word}(?:\\s+${word}){0,3}`;
  const patterns = [
    new RegExp(`\\b(?:per|con)\\s+(${phrase})\\s+si\\s+intende\\s+(.{4,140})$`, 'i'),
    new RegExp(`\\bsi\\s+definisce\\s+(${phrase})\\s+(.{4,140})$`, 'i'),
  ];

  for (const sentence of splitSentences(source)) {
    const cleanSentence = sentence.replace(/[.!?]+$/, '').trim();
    for (const pattern of patterns) {
      const match = cleanSentence.match(pattern);
      if (!match) continue;
      const term = normalize(match[1]).replace(/^(?:il|la|lo|l'|l’|un|una)\s+/i, '');
      const definition = normalize(match[2]);
      if (!term || !definition) continue;
      found.push({ term, definition, placement: glossaryPlacement(definition), basis: 'source' });
      break;
    }
    if (found.length >= 6) break;
  }

  return normalizeGlossary(found, source, 6);
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
  const simpleSummary = normalize(generated?.simpleSummary || generated?.summary);
  const dsaSummary = String(generated?.dsaSummary || '').trim() || dsaVersion(summary);
  const glossary = normalizeGlossary([
    ...(generated?.glossary || []),
    ...extractLocalGlossary(source),
  ], source, 6, summary);
  const searchable = `${summary} ${dsaSummary}`.toLocaleLowerCase('it-IT');
  const missing = extractStudyAnchors(source).filter((anchor) => !searchable.includes(anchor.toLocaleLowerCase('it-IT')));
  if (!missing.length) return { ...generated, summary, simpleSummary, dsaSummary, glossary };

  const sourceSentences = splitSentences(source);
  const recovery = [];
  for (const anchor of missing) {
    const needle = anchor.toLocaleLowerCase('it-IT');
    const sentence = sourceSentences.find((item) => item.toLocaleLowerCase('it-IT').includes(needle));
    if (sentence && !recovery.includes(sentence)) recovery.push(sentence);
    if (recovery.length >= 5) break;
  }
  if (!recovery.length) return { ...generated, summary, dsaSummary, glossary };

  return {
    ...generated,
    summary: normalize([summary, ...recovery].filter(Boolean).join(' ')),
    simpleSummary,
    dsaSummary: [dsaSummary, ...recovery.map(dsaVersion)].filter(Boolean).join('\n\n'),
    keyPoints: unique([...(generated?.keyPoints || []), ...recovery], 8),
    remember: unique([...(generated?.remember || []), ...recovery], 5),
    glossary,
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
  // Never hold a 900-page study job indefinitely on one network request.
  // Bounded AI latency permits a reliable local fallback and a new checkpoint.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch(apiEndpoint('/api/summarize'), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paragraphs: units.map((item) => item.text),
        contexts: units.map((item) => ({
          chapterTitle: item.chapterTitle,
          sectionTitle: item.sourceMeta?.sourceSection,
          page: pageContext(item.sourceMeta),
          previousText: item.previousText,
          nextText: item.nextText,
          chapterMemory: item.chapterMemory,
          bookMemory: item.bookMemory,
        })),
        level,
      }),
    });
  } finally { clearTimeout(timeout); }

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
  const simple = ordered.map((item) => item?.simpleSummary).filter(Boolean);
  const dsa = ordered.map((item) => item?.dsaSummary).filter(Boolean);
  const engine = ordered.some((item) => item?.engine === 'ai') ? 'ai' : 'locale';
  return ensureSourceFidelity(source, {
    summary: normalize(summaries.join(' ')),
    simpleSummary: normalize(simple.join(' ')) || normalize(summaries.join(' ')),
    dsaSummary: dsa.join('\n\n'),
    keyPoints: unique(ordered.flatMap((item) => item?.keyPoints || []), 8),
    remember: unique(ordered.flatMap((item) => item?.remember || []), 5),
    keywords: unique(ordered.flatMap((item) => item?.keywords || []), 12),
    glossary: normalizeGlossary(ordered.flatMap((item) => item?.glossary || []), source, 6),
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
  // Content-address the WHOLE source, not merely first/last text;
  // a same-length correction in the middle must never replay stale summaries.
  const fullContentHash = hashText((documentData?.chapters || [])
    .map(chapter => (chapter.paragraphs || []).map(part => String(part || '')).join('\u241f')).join('\u241e'));
  const fingerprint = [
    CHECKPOINT_VERSION, 'crash-safe-v34',
    level, documentData?.originalFingerprint || '',
    documentData?.sourceFormat || '', documentData?.sourceTitle || '',
    full.length, fullContentHash, chapterShape,
  ].join('::');
  return `studybook-v09-${hashText(fingerprint)}`;
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
      const generated = results[cursor] || ensureSourceFidelity(original, summarizeLocally(original, 'studio'));
      const sourceMeta = paragraphSourceMeta(chapter, paragraphIndex);
      cursor += 1;
      return { original, ...generated, ...sourceMeta };
    }),
  }));
}

function compactMemory(value, limit) {
  const text = normalize(value);
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
}

function buildContextMemories(documentData) {
  const chapters = documentData?.chapters || [];
  const bookMemory = compactMemory([
    documentData?.sourceTitle || '',
    ...chapters.map((chapter, index) => `${index + 1}. ${chapter.title || `Capitolo ${index + 1}`}`),
  ].filter(Boolean).join(' | '), 1400);

  const chapterMemory = chapters.map((chapter) => compactMemory([
    chapter.title,
    ...(chapter.sections || []).map((section) => section.title),
    ...(chapter.paragraphs || []).slice(0, 8).map((paragraph) => splitSentences(paragraph)[0] || ''),
  ].filter(Boolean).join(' | '), 1800));

  return { bookMemory, chapterMemory };
}

export async function buildStudyBook(documentData, {
  level = 'studio',
  preferAi = true,
  onProgress,
  onCheckpoint,
  maxConcurrency,
  forceFresh = false,
} = {}) {
  const runtimeStartedAt = Date.now();
  const flat = [];
  const memories = buildContextMemories(documentData);
  documentData.chapters.forEach((chapter, chapterIndex) => {
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      const previous = chapter.paragraphs[paragraphIndex - 1] || '';
      const next = chapter.paragraphs[paragraphIndex + 1] || '';
      flat.push({
        chapterIndex,
        paragraphIndex,
        chapterTitle: chapter.title,
        text: normalize(paragraph),
        previousText: compactMemory(previous, 900),
        nextText: compactMemory(next, 900),
        chapterMemory: memories.chapterMemory[chapterIndex] || '',
        bookMemory: memories.bookMemory,
        sourceMeta: paragraphSourceMeta(chapter, paragraphIndex),
      });
    });
  });

  if (!flat.length) {
    return {
      version: 8,
      generatedAt: new Date().toISOString(),
      level,
      engine: 'locale',
      sourceStructure: documentData.structure || null,
      chapters: [],
      quality: {
        motorLabRuntime: {
          runtimeId: MOTORLAB_RUNTIME_VERSION,
          totalProcessingMs: Date.now() - runtimeStartedAt,
          timeToFirstReadyParagraphMs: 0,
          cachedChunks: 0,
          cacheMisses: 0,
          cacheHitPercent: 0,
          waves: 0,
          correctionRelays: 0,
        },
      },
    };
  }

  purgeOldResumeStates().catch(() => {});
  purgeOldRuntimeUnitResults().catch(() => {});
  const signature = buildResumeSignature(documentData, level);
  // Explicit reprocessing ignores a COMPLETE old run, but must reuse an
  // INCOMPLETE checkpoint after app crash. The new v5 signature prevents
  // LAB33/LAB32 cached data from contaminating the new source.
  const previous = await loadResumeState(signature);
  const saved = forceFresh && previous?.complete ? null : previous;
  const resumeInterrupted = Boolean(saved && !saved.complete);
  const finalResults = Array(flat.length).fill(null);
  let checkpointResumedParagraphs = 0;

  if (saved?.version === CHECKPOINT_VERSION && saved?.signature === signature && saved?.level === level) {
    (saved.results || []).forEach((item, index) => {
      if (index < finalResults.length && item?.summary && item?.dsaSummary) {
        finalResults[index] = item;
        checkpointResumedParagraphs += 1;
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
    chunks.forEach((chunk, chunkIndex) => {
      const unit = { ...item, text: chunk, parentIndex, chunkIndex };
      units.push({ ...unit, cacheKey: makeRuntimeUnitKey(unit, level) });
    });
  });

  const completedParents = new Set(finalResults.map((item, index) => item ? index : null).filter((value) => value !== null));
  // A fresh pass must also bypass the per-unit MotorLab cache.
  // In fresh mode per-unit caches from older runs are not reused;
  // only the exact incomplete v5 source checkpoint may be resumed.
  const cached = forceFresh ? new Map() : await loadRuntimeUnitResults(units.map((unit) => unit.cacheKey));
  let cachedChunks = 0;

  for (const unit of units) {
    const cachedPiece = cached.get(unit.cacheKey);
    if (!cachedPiece?.summary || !cachedPiece?.dsaSummary || cachedPiece?.engine !== 'ai') continue;
    const pieces = unitResults.get(unit.parentIndex) || [];
    pieces.push({ chunkIndex: unit.chunkIndex, ...cachedPiece });
    unitResults.set(unit.parentIndex, pieces);
    const nextDone = (unitDone.get(unit.parentIndex) || 0) + 1;
    unitDone.set(unit.parentIndex, nextDone);
    cachedChunks += 1;
    if (nextDone >= (unitTotals.get(unit.parentIndex) || 1) && !finalResults[unit.parentIndex]) {
      finalResults[unit.parentIndex] = combineUnitResults(flat[unit.parentIndex].text, pieces);
      completedParents.add(unit.parentIndex);
    }
  }

  const resumedParagraphs = completedParents.size;
  let firstReadyAtMs = resumedParagraphs ? 0 : null;
  // Initial durable checkpoint BEFORE the first AI batch, including the
  // finalResults that survived a prior interrupted run.
  if (!saved || !resumeInterrupted) {
    const initialSaved = await saveResumeState(signature, {
      version:CHECKPOINT_VERSION, signature, level, results:finalResults,
      completed:completedParents.size, total:flat.length, complete:false,
      startedAt:new Date().toISOString(), runtimeId:MOTORLAB_RUNTIME_VERSION,
    });
    if (!initialSaved) throw new Error('Impossibile salvare il progresso: controllare lo spazio disponibile sul dispositivo.');
  }
  onProgress?.(
    completedParents.size,
    flat.length,
    resumedParagraphs ? 'resume' : 'preparazione',
    {
      runtimeId: MOTORLAB_RUNTIME_VERSION,
      resumedParagraphs,
      cachedChunks,
      checkpointResumedParagraphs,
      concurrency: 0,
    },
  );

  const pendingUnits = units.filter((unit) => !cached.has(unit.cacheKey));
  const batches = makeChapterBatches(pendingUnits);
  const initialConcurrency = chooseRuntimeConcurrency(maxConcurrency);
  const ceiling = Number.isFinite(Number(maxConcurrency)) && Number(maxConcurrency) > 0
    ? Math.max(1, Math.min(2, Math.floor(Number(maxConcurrency))))
    : (typeof navigator !== 'undefined' && Number(navigator.deviceMemory || 4) < 4 ? 1 : 2);

  const runtimeQueue = await runAdaptiveBatchQueue({
    batches,
    preferAi,
    initialConcurrency,
    maxConcurrency: ceiling,
    worker(batch, { aiAllowed }) {
      return processBatch(batch, level, aiAllowed);
    },
    async onWave(meta) {
      const cacheWrites = [];

      for (const item of meta.results) {
        item.batch.forEach((unit, offset) => {
          const piece = ensureSourceFidelity(unit.text, item.summaries[offset]);
          const pieces = unitResults.get(unit.parentIndex) || [];
          pieces.push({ chunkIndex: unit.chunkIndex, ...piece });
          unitResults.set(unit.parentIndex, pieces);
          const nextDone = (unitDone.get(unit.parentIndex) || 0) + 1;
          unitDone.set(unit.parentIndex, nextDone);
          if (piece?.engine === 'ai') cacheWrites.push({ key: unit.cacheKey, result: piece });
          if (nextDone >= (unitTotals.get(unit.parentIndex) || 1) && !finalResults[unit.parentIndex]) {
            finalResults[unit.parentIndex] = combineUnitResults(flat[unit.parentIndex].text, pieces);
            completedParents.add(unit.parentIndex);
            if (firstReadyAtMs == null) firstReadyAtMs = Date.now() - runtimeStartedAt;
          }
        });
      }

      if (cacheWrites.length) await saveRuntimeUnitResults(cacheWrites);

      const checkpoint = {
        version: CHECKPOINT_VERSION,
        signature,
        level,
        results: finalResults,
        completed: completedParents.size,
        total: flat.length,
        aiEnabled: meta.aiEnabled,
        concurrency: meta.concurrency,
        runtimeId: MOTORLAB_RUNTIME_VERSION,
        cachedChunks,
        savedAt: new Date().toISOString(),
      };
      const persisted = await saveResumeState(signature, checkpoint);
      if (!persisted) {
        throw new Error('Salvataggio progressi fallito. La rielaborazione è stata sospesa per proteggere il lavoro già completato.');
      }
      if (onCheckpoint) await onCheckpoint(checkpoint);
      // Yield to Android WebView between waves so paint, cancellation,
      // memory reclamation and touch events do not starve for minutes.
      await new Promise(resolve => setTimeout(resolve, 0));

      const waveEngine = meta.results.some((item) => item.aiSuccess)
        ? (meta.results.some((item) => item.aiFailure) ? 'misto' : 'ai')
        : (preferAi ? 'misto' : 'locale');

      onProgress?.(completedParents.size, flat.length, waveEngine, {
        runtimeId: MOTORLAB_RUNTIME_VERSION,
        concurrency: meta.concurrency,
        maxConcurrencyUsed: meta.maxConcurrencyUsed,
        resumedParagraphs,
        cachedChunks,
        aiFailures: meta.aiFailures,
        correctionRelays: meta.correctionRelays,
        waveNumber: meta.waveNumber,
        totalWavesEstimate: Math.max(meta.waveNumber, Math.ceil((meta.totalBatches || 0) / Math.max(1, meta.maxConcurrencyUsed || 1))),
      });
    },
  });

  for (let index = 0; index < finalResults.length; index += 1) {
    if (!finalResults[index]) finalResults[index] = ensureSourceFidelity(flat[index].text, summarizeLocally(flat[index].text, level));
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
    runtimeId: MOTORLAB_RUNTIME_VERSION,
    cachedChunks,
    savedAt: new Date().toISOString(),
  };
  if (!await saveResumeState(signature, completedCheckpoint)) {
    throw new Error('Libro elaborato ma checkpoint finale non persistito: spazio insufficiente.');
  }

  const totalUnitCount = units.length;
  const cacheMisses = Math.max(0, totalUnitCount - cachedChunks);
  const cacheHitPercent = totalUnitCount
    ? Math.round((cachedChunks / totalUnitCount) * 1000) / 10
    : (checkpointResumedParagraphs ? 100 : 0);

  return {
    version: 8,
    generatedAt: new Date().toISOString(),
    level,
    engine,
    resumeSignature: signature,
    quality: {
      paragraphs: finalResults.length,
      aiParagraphs,
      localParagraphs: finalResults.length - aiParagraphs,
      resumedParagraphs,
      checkpointResumedParagraphs,
      aiFailures: runtimeQueue.aiFailures,
      maxConcurrencyUsed: runtimeQueue.maxConcurrencyUsed,
      longParagraphsSplit: [...unitTotals.values()].filter((value) => value > 1).length,
      fidelityRecovered: finalResults.reduce((sum, item) => sum + Number(item?.fidelityRecovered || 0), 0),
      glossaryEntries: finalResults.reduce((sum, item) => sum + (item?.glossary?.length || 0), 0),
      motorLabRuntime: {
        runtimeId: MOTORLAB_RUNTIME_VERSION,
        initialConcurrency: runtimeQueue.initialConcurrency,
        finalConcurrency: runtimeQueue.finalConcurrency,
        maxConcurrencyUsed: runtimeQueue.maxConcurrencyUsed,
        waves: runtimeQueue.waves,
        correctionRelays: runtimeQueue.correctionRelays,
        aiFailures: runtimeQueue.aiFailures,
        cachedChunks,
        cacheMisses,
        cacheHitPercent,
        timeToFirstReadyParagraphMs: firstReadyAtMs ?? (Date.now() - runtimeStartedAt),
        totalProcessingMs: Date.now() - runtimeStartedAt,
      },
    },
    sourceStructure: documentData.structure || null,
    chapters: buildChapters(documentData, finalResults),
  };
}

export { refineParagraphWithAi, summaryLevels };
