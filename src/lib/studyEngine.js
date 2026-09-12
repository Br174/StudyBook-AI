const LEVELS = {
  approfondito: { label: 'Approfondito', ratio: 0.72, minSentences: 3, maxSentences: 8 },
  studio: { label: 'Studio', ratio: 0.5, minSentences: 2, maxSentences: 6 },
  ripasso: { label: 'Ripasso', ratio: 0.3, minSentences: 1, maxSentences: 4 },
};

const STOP_WORDS = new Set([
  'anche','che','chi','come','con','cosa','da','dal','dalla','dalle','dei','del','della','delle','di','e','ed','era','essere','gli','ha','hai','hanno','i','il','in','io','la','le','lo','ma','nel','nella','nelle','non','o','per','più','quale','quali','quando','questo','questa','questi','queste','se','si','sia','sono','su','tra','un','una','uno','al','alla','alle','ai','agli','dai','dagli','dopo','prima','poi','molto','molti','molte','ogni','solo','sua','suo','sue','suoi','loro','può','puo','viene','vengono'
]);

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
  const definitionBonus = /\b(è|sono|significa|definisce|consiste|si intende|indica|chiamato|chiamata)\b/i.test(sentence) ? 1.6 : 0;
  const dataBonus = /\b\d{2,4}\b|\b(secolo|anno|anni|formula|teorema|legge|causa|conseguenza)\b/i.test(sentence) ? 1.2 : 0;
  const positionBonus = index === 0 ? 1.1 : (index < Math.ceil(total * 0.25) ? 0.45 : 0);
  return contentScore + definitionBonus + dataBonus + positionBonus;
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
  const important = sentences.filter((sentence) => /\b\d{2,4}\b|\b(definisce|significa|causa|conseguenza|legge|formula|teorema|principale|fondamentale)\b/i.test(sentence));
  if (important.length) return important.slice(0, 3);
  return keywords.slice(0, 4).map((keyword) => `Concetto chiave: ${keyword}`);
}

export function summarizeLocally(paragraph, level = 'studio') {
  const source = normalize(paragraph);
  const summary = extractSummary(source, level);
  const keywords = topKeywords(source);
  return {
    summary,
    dsaSummary: dsaVersion(summary),
    keyPoints: keyPointsFromSummary(summary),
    remember: rememberItems(source, keywords),
    keywords,
    engine: 'locale',
  };
}

async function summarizeWithEndpoint(paragraphs, level) {
  const response = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paragraphs, level }),
  });
  if (!response.ok) throw new Error(`Endpoint AI non disponibile (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload?.summaries) || payload.summaries.length !== paragraphs.length) {
    throw new Error('Risposta AI non valida');
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

  return { ...payload.result, engine: 'ai-refine' };
}

function paragraphSourceMeta(chapter, paragraphIndex) {
  const meta = chapter.paragraphMeta?.[paragraphIndex] || null;
  return {
    sourcePageStart: meta?.pageStart ?? chapter.pageStart ?? null,
    sourcePageEnd: meta?.pageEnd ?? meta?.pageStart ?? chapter.pageEnd ?? chapter.pageStart ?? null,
    sourceSection: meta?.sectionTitle || null,
    sourceSectionLevel: meta?.sectionLevel || null,
  };
}

export async function buildStudyBook(documentData, { level = 'studio', preferAi = true, onProgress } = {}) {
  const flat = [];
  documentData.chapters.forEach((chapter, chapterIndex) => {
    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      flat.push({
        chapterIndex,
        paragraphIndex,
        text: paragraph,
        sourceMeta: paragraphSourceMeta(chapter, paragraphIndex),
      });
    });
  });

  const results = new Array(flat.length);
  let aiAvailable = preferAi;
  const batchSize = 5;

  for (let start = 0; start < flat.length; start += batchSize) {
    const batch = flat.slice(start, start + batchSize);
    let summaries;

    if (aiAvailable) {
      try {
        summaries = await summarizeWithEndpoint(batch.map((item) => item.text), level);
      } catch {
        aiAvailable = false;
      }
    }

    if (!summaries) summaries = batch.map((item) => summarizeLocally(item.text, level));
    summaries.forEach((summary, offset) => { results[start + offset] = summary; });
    onProgress?.(Math.min(flat.length, start + batch.length), flat.length, aiAvailable ? 'ai' : 'locale');
  }

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

  const engine = results.some((item) => item?.engine === 'ai') ? 'ai' : 'locale';
  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    level,
    engine,
    sourceStructure: documentData.structure || null,
    chapters,
  };
}

export const summaryLevels = LEVELS;
