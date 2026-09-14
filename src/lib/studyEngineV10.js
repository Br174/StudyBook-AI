import {
  buildStudyBook as buildBaseStudyBook,
  refineParagraphWithAi,
  summaryLevels as baseSummaryLevels,
} from './studyEngineV11.js';

export const summaryLevels = {
  approfondito: { ...baseSummaryLevels.approfondito, label: 'Approfondimento' },
  studio: { ...baseSummaryLevels.studio, label: 'Metodo di studio' },
  ripasso: { ...baseSummaryLevels.ripasso, label: 'Riassunto' },
};

const QA_STOP_WORDS = new Set([
  'anche','che','chi','come','con','cosa','da','dal','dalla','dalle','dei','del','della','delle','di','e','ed','era','essere','gli','ha','hanno','i','il','in','la','le','lo','ma','nel','nella','nelle','non','o','per','più','quale','quali','quando','questo','questa','questi','queste','se','si','sia','sono','su','tra','un','una','uno','al','alla','alle','ai','agli','dai','dagli','dopo','prima','poi','molto','molti','molte','ogni','solo','sua','suo','sue','suoi','loro','può','puo','viene','vengono','del','dello','degli','delle'
]);

const IMPORTANT_PATTERNS = [
  /\b(si definisce|è definito|e definito|si intende per|significa|consiste in|indica|corrisponde a)\b/i,
  /\b(causa|cause|provoca|determina|comporta|conseguenza|conseguenze|deriva|dipende|perché|perche|poiché|poiche|pertanto|quindi)\b/i,
  /\b(si divide|si distinguono|comprende|include|classifica|classificazione|tipi|categorie|fasi|elementi|caratteristiche)\b/i,
  /\b(eccezione|eccezioni|eccetto|tranne|salvo|tuttavia|a differenza|invece|diversamente)\b/i,
  /\b(principio|principi|legge|leggi|teorema|formula|regola|regole|definizione|fondamentale|essenziale|necessario|necessaria|obbligatorio|obbligatoria)\b/i,
  /\b(?:1[0-9]{3}|20[0-9]{2}|\d{1,3}(?:[.,]\d+)?%)\b/,
  /\b[A-Za-z]{1,4}\s*=\s*[^,.;]{1,40}/,
];

const MAX_RECOVERY_PER_CHAPTER = 8;
const MAX_RECOVERY_PER_PARAGRAPH = 2;

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(text) {
  const clean = normalize(text);
  if (!clean) return [];
  return (clean.match(/[^.!?]+(?:[.!?]+|$)/g) || [clean]).map(normalize).filter(Boolean);
}

function contentWords(text) {
  return normalize(text)
    .toLocaleLowerCase('it-IT')
    .replace(/[^a-zà-öø-ÿ0-9'-]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !QA_STOP_WORDS.has(word));
}

function importantSentence(sentence) {
  const clean = normalize(sentence);
  if (clean.length < 22 || clean.length > 420) return false;
  return IMPORTANT_PATTERNS.some((pattern) => pattern.test(clean));
}

function coverageScore(sourceSentence, generatedText) {
  const sourceWords = [...new Set(contentWords(sourceSentence))];
  if (!sourceWords.length) return 1;
  const generated = new Set(contentWords(generatedText));
  const matches = sourceWords.filter((word) => generated.has(word)).length;
  return matches / sourceWords.length;
}

function isCovered(sentence, generatedText) {
  const source = normalize(sentence).toLocaleLowerCase('it-IT');
  const target = normalize(generatedText).toLocaleLowerCase('it-IT');
  if (!source) return true;
  if (target.includes(source)) return true;
  const words = [...new Set(contentWords(sentence))];
  const score = coverageScore(sentence, generatedText);
  if (words.length <= 3) return score >= 0.67;
  if (words.length <= 6) return score >= 0.55;
  return score >= 0.48;
}

function paragraphSearchText(paragraph) {
  return [
    paragraph?.summary,
    paragraph?.dsaSummary,
    ...(paragraph?.keyPoints || []),
    ...(paragraph?.remember || []),
    ...(paragraph?.keywords || []),
  ].filter(Boolean).join(' ');
}

function appendRecovery(paragraph, sentence) {
  const clean = normalize(sentence);
  const summary = normalize(paragraph?.summary);
  const dsa = String(paragraph?.dsaSummary || '').trim();
  const keyPoints = Array.isArray(paragraph?.keyPoints) ? paragraph.keyPoints : [];
  const remember = Array.isArray(paragraph?.remember) ? paragraph.remember : [];

  return {
    ...paragraph,
    summary: normalize(`${summary} ${clean}`),
    dsaSummary: [dsa, clean].filter(Boolean).join('\n\n'),
    keyPoints: [...new Set([...keyPoints, clean])].slice(0, 10),
    remember: [...new Set([...remember, clean])].slice(0, 6),
    chapterQaRecovered: Number(paragraph?.chapterQaRecovered || 0) + 1,
  };
}

function auditChapter(sourceChapter, generatedChapter) {
  const paragraphs = (generatedChapter?.paragraphs || []).map((paragraph) => ({ ...paragraph }));
  let important = 0;
  let coveredBefore = 0;
  let recovered = 0;
  let capped = 0;

  (sourceChapter?.paragraphs || []).forEach((sourceParagraph, paragraphIndex) => {
    const generated = paragraphs[paragraphIndex];
    if (!generated) return;
    let recoveredHere = 0;

    for (const sentence of splitSentences(sourceParagraph).filter(importantSentence)) {
      important += 1;
      const searchText = paragraphSearchText(paragraphs[paragraphIndex]);
      if (isCovered(sentence, searchText)) {
        coveredBefore += 1;
        continue;
      }

      if (recovered >= MAX_RECOVERY_PER_CHAPTER || recoveredHere >= MAX_RECOVERY_PER_PARAGRAPH) {
        capped += 1;
        continue;
      }

      paragraphs[paragraphIndex] = appendRecovery(paragraphs[paragraphIndex], sentence);
      recovered += 1;
      recoveredHere += 1;
    }
  });

  const coveredAfter = Math.min(important, coveredBefore + recovered);
  const coverageBefore = important ? coveredBefore / important : 1;
  const coverageAfter = important ? coveredAfter / important : 1;

  return {
    chapter: {
      ...generatedChapter,
      paragraphs,
      qualityAudit: {
        importantSentences: important,
        coveredBefore,
        recovered,
        capped,
        coverageBefore,
        coverageAfter,
      },
    },
    stats: {
      important,
      coveredBefore,
      recovered,
      capped,
      coverageBefore,
      coverageAfter,
    },
  };
}

export async function buildStudyBook(documentData, options = {}) {
  const baseBook = await buildBaseStudyBook(documentData, options);
  const chapters = [];
  let importantSentences = 0;
  let recoveredSentences = 0;
  let cappedRecoveries = 0;
  let chaptersWithRecovery = 0;
  let coverageBeforeSum = 0;
  let coverageAfterSum = 0;

  const totalChapters = Math.max(
    documentData?.chapters?.length || 0,
    baseBook?.chapters?.length || 0,
  );

  for (let index = 0; index < totalChapters; index += 1) {
    const sourceChapter = documentData?.chapters?.[index] || { paragraphs: [] };
    const generatedChapter = baseBook?.chapters?.[index] || {
      title: sourceChapter.title || `Capitolo ${index + 1}`,
      paragraphs: [],
    };
    const audited = auditChapter(sourceChapter, generatedChapter);
    chapters.push(audited.chapter);

    importantSentences += audited.stats.important;
    recoveredSentences += audited.stats.recovered;
    cappedRecoveries += audited.stats.capped;
    coverageBeforeSum += audited.stats.coverageBefore;
    coverageAfterSum += audited.stats.coverageAfter;
    if (audited.stats.recovered > 0) chaptersWithRecovery += 1;

    options.onProgress?.(
      baseBook?.quality?.paragraphs || 0,
      baseBook?.quality?.paragraphs || 0,
      'controllo',
      {
        chaptersDone: index + 1,
        chaptersTotal: totalChapters,
        recoveredSentences,
      },
    );
  }

  const divisor = totalChapters || 1;
  return {
    ...baseBook,
    version: Math.max(Number(baseBook?.version || 0), 8),
    chapters,
    quality: {
      ...(baseBook?.quality || {}),
      chapterAudit: {
        chaptersAudited: totalChapters,
        chaptersWithRecovery,
        importantSentences,
        recoveredSentences,
        cappedRecoveries,
        averageCoverageBefore: coverageBeforeSum / divisor,
        averageCoverageAfter: coverageAfterSum / divisor,
      },
    },
  };
}

export { refineParagraphWithAi };
