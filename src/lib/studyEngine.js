const LEVELS = {
  approfondito: { label: 'Approfondito', ratio: 0.76, minSentences: 3, maxSentences: 10 },
  studio: { label: 'Studio', ratio: 0.55, minSentences: 2, maxSentences: 7 },
  ripasso: { label: 'Ripasso', ratio: 0.34, minSentences: 1, maxSentences: 5 },
};

const STOP_WORDS = new Set([
  'anche','che','chi','come','con','cosa','da','dal','dalla','dalle','dei','del','della','delle','di','e','ed','era','essere','gli','ha','hai','hanno','i','il','in','io','la','le','lo','ma','nel','nella','nelle','non','o','per','più','quale','quali','quando','questo','questa','questi','queste','se','si','sia','sono','su','tra','un','una','uno','al','alla','alle','ai','agli','dai','dagli','dopo','prima','poi','molto','molti','molte','ogni','solo','sua','suo','sue','suoi','loro','può','puo','viene','vengono'
]);

const AI_BATCH_CHAR_LIMIT = 18000;
const AI_BATCH_ITEM_LIMIT = 5;
const LONG_PARAGRAPH_LIMIT = 7000;
const CHUNK_TARGET = 4200;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  const cleaned = normalize(text);
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+(?:[.!?]+|$)/g) || [cleaned];
  return matches.map((s) => normalize(s)).filter(Boolean);
}

function words(text) {
  return normalize(text)
    .toLocaleLowerCase('it-IT')
    .replace(/[^a-zà-öø-ÿ0-9'-]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function frequencyMap(text) {
  const map = new Map();
  for (const word of words(text)) map.set(word, (map.get(word) || 0) + 1);
  return map;
}

function scoreSentence(sentence, frequencies, index, total) {
  const sentenceWords = words(sentence);
  if (!sentenceWords.length) return 0;
  const contentScore = sentenceWords.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / sentenceWords.length;
  const definitionBonus = /\b(è|sono|significa|definisce|consiste|si intende|indica|chiamato|chiamata)\b/i.test(sentence) ? 1.8 : 0;
  const dataBonus = /\b\d{2,4}\b|\b(secolo|anno|anni|formula|teorema|legge|causa|conseguenza|eccezione|classificazione)\b/i.test(sentence) ? 1.4 : 0;
  const listBonus = /(?:^|\s)(?:1[.)]|2[.)]|a[.)]|b[.)]|primo|secondo|terzo)\b/i.test(sentence) ? 0.8 : 0;
  const positionBonus = index === 0 ? 1.1 : (index < Math.ceil(total * 0.25) ? 0.45 : 0);
  return contentScore + definitionBonus + dataBonus + listBonus + positionBonus;
}

function extractSummary(text, level = 'studio') {
  const settings = LEVELS[level] || LEVELS.studio;
  const sentences = splitSentences(text);
  if (sentences.length <= settings.minSentences) return sentences.join(' ');

  const frequencies = frequencyMap(text);
  const wanted = Math.min(
    settings.maxSentences,
    Math.max(settings.minSentences, Math.ceil(sentences.length * settings.ratio)),
  );

  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, frequencies, index, sentences.length) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, wanted)
    .sort((a, b) => a.index - b.index);

  return ranked.map((item) => item.sentence).join(' ');
}

function topKeywords(text, limit = 8) {
  const frequencies = frequencyMap(text);
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function keyPointsFromSummary(summary, limit = 5) {
  return splitSentences(summary).slice(0, limit);
}

function dsaVersion(summary) {
  const sentences = splitSentences(summary);
  if (!sentences.length) return '';
  return sentences
    .map((sentence) => sentence
      .replace(/\s*;\s*/g, '. ')
      .replace(/\s*:\s*/g, ': ')
      .replace(/\s*,\s*(mentre|poiché|perché|quindi|tuttavia|inoltre)\s+/gi, '. $1 '))
    .map((sentence) => normalize(sentence))
    .filter(Boolean)
    .join('\n\n');
}

function rememberItems(source, keywords) {
  const sentences = splitSentences(source);
  const important = sentences.filter((sentence) => /\b\d{2,4}\b|\b(definisce|significa|causa|conseguenza|legge|formula|teorema|principale|fondamentale|eccezione)\b/i.test(sentence));
  if (important.length) return important.slice(0, 4);
  return keywords.slice(0, 4).map((keyword) => `Concetto chiave: ${keyword}`);
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
  return [...anchors].slice(0, 24);
}

function ensureSourceFidelity(source, generated) {
  const summary = normalize(generated?.summary);
  const dsaSummary = String(generated?.dsaSummary || '').trim() || dsaVersion(summary);
  const searchable = `${summary} ${dsaSummary}`.toLocaleLowerCase('it-IT');
  const missing = extractStudyAnchors(source).filter((anchor) => !searchable.includes(anchor.toLocaleLowerCase('it-IT')));
  if (!missing.length) return generated;

  const sourceSentences = splitSentences(source);
  const recovery = [];
  for (const anchor of missing) {
    const sentence = sourceSentences.find((item) => item.toLocaleLowerCase('it-IT').includes(anchor.toLocaleLowerCase('it-IT')));
    if (sentence && !recovery.includes(sentence)) recovery.push(sentence);
    if (recovery.length >= 4) break;
  }
  if (!recovery.length) return generated;

  const repairedSummary = normalize([summary, ...recovery].filter(Boolean).join(' '));
  const repairedDsa = [dsaSummary, ...recovery.map((item) => dsaVersion(item))].filter(Boolean).join('\n\n');
  return {
    ...generated,
    summary: repairedSummary,
    dsaSummary: repairedDsa,
    keyPoints: unique([...(generated?.keyPoints || []), ...recovery], 8),
    remember: unique([...(generated?.remember || []), ...recovery], 5),
    fidelityRecovered: recovery.length,
  };
}

export function summarizeLocally(paragraph, level = 'studio') {
  const source = normalize(paragraph);
  const summary = extractSummary(source, level);
  const keywords = topKeywords(source);
  return ensureSourceFidelity(source, {
    summary,
    dsaSummary: dsaVersion(summary),
    keyPoints: keyPointsFromSummary(summary),
    remember: rememberItems(source, keywords),
    keywords,
    engine: 'locale',
  });
}

function splitLongParagraph(text) {
  const clean = normalize(text);
  if (clean.length <= LONG_PARAGRAPH_LIMIT) return [clean];
  const sentences = splitSentences(clean);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
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

export async function refineParagraphWithAi({ original, summary, dsaSummary, level = 'studio' }) {
  const response = await fetch('/api/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original, summary, dsaSummary, level }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || `Correzione AI non disponibile (${response.status})`;
    throw new Error(message);
  }

  if (!payload?.result || typeof payload.result.summary !== 'string' || typeof payload.result.dsaSummary !== 'string') {
    throw new Error('Risposta AI di correzione non valida.');
  }

  return ensureSourceFidelity(original, { ...payload.result, engine: 'ai-refine' });
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

function makeBatches(units) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const unit of units) {
    const size = unit.text.length;
    if (current.length && (current.length >= AI_BATCH_ITEM_LIMIT || chars + size > AI_BATCH_CHAR_LIMIT)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(unit);
    chars += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function combineUnitResults(source, pieces) {
  const summaries = pieces.map((item) => item?.summary).filter(Boolean);
  const dsa = pieces.map((item) => item?.dsaSummary).filter(Boolean);
  const engine = pieces.some((item) => item?.engine === 'ai') ? 'ai' : 'locale';
  return ensureSourceFidelity(source, {
    summary: normalize(summaries.join(' ')),
    dsaSummary: dsa.join('\n\n'),
    keyPoints: unique(pieces.flatMap((item) => item?.keyPoints || []), 8),
    remember: unique(pieces.flatMap((item) => item?.remember || []), 5),
    keywords: unique(pieces.flatMap((item) => item?.keywords || []), 12),
    engine,
  });
}

export async function buildStudyBook(documentData, { level = 'studio', preferAi = true, onProgress } = {}) {
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
      version: 5,
      generatedAt: new Date().toISOString(),
      level,
      engine: 'locale',
      sourceStructure: documentData.structure || null,
      chapters: [],
    };
  }

  const units = [];
  const unitTotals = new Map();
  flat.forEach((item, parentIndex) => {
    const chunks = splitLongParagraph(item.text);
    unitTotals.set(parentIndex, chunks.length);
    chunks.forEach((chunk, chunkIndex) => units.push({ ...item, text: chunk, parentIndex, chunkIndex }));
  });

  const unitResults = new Map(flat.map((_, index) => [index, []]));
  const unitDone = new Map(flat.map((_, index) => [index, 0]));
  const completedParents = new Set();
  const batches = makeBatches(units);
  let aiEnabled = Boolean(preferAi);
  let transientAiFailures = 0;

  for (const batch of batches) {
    let summaries = null;
    if (aiEnabled) {
      try {
        summaries = await summarizeWithEndpoint(batch, level);
        transientAiFailures = 0;
      } catch (error) {
        if (error?.code === 'AI_NOT_CONFIGURED') {
          aiEnabled = false;
        } else {
          transientAiFailures += 1;
          if (transientAiFailures >= 2) aiEnabled = false;
        }
      }
    }

    if (!summaries) summaries = batch.map((item) => summarizeLocally(item.text, level));

    batch.forEach((item, offset) => {
      const piece = ensureSourceFidelity(item.text, summaries[offset]);
      unitResults.get(item.parentIndex).push({ chunkIndex: item.chunkIndex, ...piece });
      const nextDone = (unitDone.get(item.parentIndex) || 0) + 1;
      unitDone.set(item.parentIndex, nextDone);
      if (nextDone >= (unitTotals.get(item.parentIndex) || 1)) completedParents.add(item.parentIndex);
    });

    onProgress?.(completedParents.size, flat.length, summaries.some((item) => item?.engine === 'ai') ? 'ai' : 'locale');
  }

  const results = flat.map((item, parentIndex) => {
    const pieces = (unitResults.get(parentIndex) || []).sort((a, b) => a.chunkIndex - b.chunkIndex);
    return combineUnitResults(item.text, pieces);
  });

  let cursor = 0;
  const chapters = documentData.chapters.map((chapter) => ({
    title: chapter.title,
    pageStart: chapter.pageStart ?? null,
    pageEnd: chapter.pageEnd ?? chapter.pageStart ?? null,
    sections: Array.isArray(chapter.sections) ? chapter.sections.map((section) => ({ ...section })) : [],
    paragraphs: chapter.paragraphs.map((original, paragraphIndex) => {
      const generated = results[cursor];
      const sourceMeta = paragraphSourceMeta(chapter, paragraphIndex);
      cursor += 1;
      return {
        original,
        ...generated,
        ...sourceMeta,
      };
    }),
  }));

  const aiParagraphs = results.filter((item) => item?.engine === 'ai').length;
  const engine = aiParagraphs === results.length ? 'ai' : aiParagraphs > 0 ? 'misto' : 'locale';
  return {
    version: 5,
    generatedAt: new Date().toISOString(),
    level,
    engine,
    quality: {
      paragraphs: results.length,
      aiParagraphs,
      localParagraphs: results.length - aiParagraphs,
      fidelityRecovered: results.reduce((sum, item) => sum + Number(item?.fidelityRecovered || 0), 0),
      longParagraphsSplit: [...unitTotals.values()].filter((value) => value > 1).length,
    },
    sourceStructure: documentData.structure || null,
    chapters,
  };
}

export const summaryLevels = LEVELS;