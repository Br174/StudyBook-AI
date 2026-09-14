import { purgeExpiredStudyHelpCache, readStudyHelpCache, writeStudyHelpCache } from './studyHelpCache.js';

export const STUDY_ACTIONS = [
  { id: 'simple', label: 'Spiegami semplice' },
  { id: 'meaning', label: 'Che significa?' },
  { id: 'example', label: 'Fammi un esempio' },
  { id: 'importance', label: 'Perché è importante?' },
  { id: 'remember', label: 'Cosa devo ricordare?' },
  { id: 'exam', label: 'Domanda d’esame' },
];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitSentences(value) {
  const text = clean(value);
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text]).map(clean).filter(Boolean);
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(payload) {
  return `studybook:study-help:v3:${hashText([
    payload.action,
    payload.selection,
    payload.chapterTitle,
    payload.sectionTitle,
    payload.sourceText,
    payload.question,
  ].join('::'))}`;
}

function readSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.answer) return null;
    return { ...parsed, cached: true };
  } catch {
    return null;
  }
}

function writeSessionCache(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // La cache è un'ottimizzazione: un limite del browser non deve bloccare lo studio.
  }
}

function sourceContext(payload) {
  const selection = clean(payload.selection);
  const sourceSentences = splitSentences(payload.sourceText);
  const summarySentences = splitSentences(payload.summary);
  const needle = selection.toLocaleLowerCase('it-IT');
  const matchingSource = sourceSentences.find((sentence) => sentence.toLocaleLowerCase('it-IT').includes(needle));
  const matchingSummary = summarySentences.find((sentence) => sentence.toLocaleLowerCase('it-IT').includes(needle));
  return {
    selection,
    sourceSentences,
    summarySentences,
    focus: matchingSummary || matchingSource || summarySentences[0] || sourceSentences[0] || selection,
    matchingSource,
  };
}

function localFallback(payload) {
  const action = payload.action || 'simple';
  const ctx = sourceContext(payload);
  const focus = clean(ctx.focus);
  const firstTwo = [...ctx.summarySentences, ...ctx.sourceSentences]
    .map(clean)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 2)
    .join(' ');

  if (action === 'exam') {
    const prompt = ctx.selection
      ? `Spiega “${ctx.selection}” nel contesto del capitolo.`
      : `Spiega il concetto principale di questo passaggio.`;
    return {
      answer: `${prompt}\n\nRisposta modello: ${focus || firstTwo}`,
      basis: 'source',
      label: 'Domanda d’esame',
      fallback: true,
    };
  }

  if (action === 'example') {
    const explicitExample = ctx.sourceSentences.find((sentence) => /\b(ad esempio|per esempio|esempio|come nel caso|si pensi)\b/i.test(sentence));
    return {
      answer: explicitExample || `Nel brano non c’è un esempio esplicito separato. Il contesto utile è: ${focus || firstTwo}`,
      basis: 'source',
      label: explicitExample ? 'Esempio dal testo' : 'Contesto dal testo',
      fallback: true,
    };
  }

  if (action === 'remember') {
    return {
      answer: focus || firstTwo || ctx.selection,
      basis: 'source',
      label: 'Da ricordare',
      fallback: true,
    };
  }

  if (action === 'importance') {
    return {
      answer: firstTwo || focus || ctx.selection,
      basis: 'source',
      label: 'Perché conta nel capitolo',
      fallback: true,
    };
  }

  if (action === 'meaning') {
    return {
      answer: ctx.matchingSource || focus || firstTwo || ctx.selection,
      basis: 'source',
      label: 'Significato nel contesto',
      fallback: true,
    };
  }

  if (action === 'custom') {
    return {
      answer: `Dal contesto disponibile: ${firstTwo || focus || ctx.selection}`,
      basis: 'source',
      label: 'Risposta dal testo',
      fallback: true,
    };
  }

  return {
    answer: focus || firstTwo || ctx.selection,
    basis: 'source',
    label: 'Spiegazione dal testo',
    fallback: true,
  };
}

async function requestRemote(payload) {
  const response = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || `Assistente di studio non disponibile (${response.status}).`);
    error.code = data?.code || `HTTP_${response.status}`;
    throw error;
  }

  if (!data?.answer) throw new Error('L’assistente non ha restituito una spiegazione valida.');
  return {
    answer: String(data.answer).trim(),
    basis: data.basis === 'general' ? 'general' : 'source',
    label: String(data.label || '').trim(),
    cached: false,
  };
}

export async function askStudyAssistant(payload) {
  const key = cacheKey(payload);
  const sessionCached = readSessionCache(key);
  if (sessionCached) return sessionCached;

  const persisted = await readStudyHelpCache(key);
  if (persisted) {
    writeSessionCache(key, persisted);
    return persisted;
  }

  let result;
  try {
    result = await requestRemote(payload);
  } catch {
    // I sei pulsanti devono restare utilizzabili anche se il provider AI è lento,
    // fuori quota o temporaneamente non disponibile. Il fallback usa solo il testo del libro.
    result = localFallback(payload);
  }

  writeSessionCache(key, result);
  try {
    await writeStudyHelpCache(key, result);
    purgeExpiredStudyHelpCache();
  } catch {
    // Anche un problema di storage non deve bloccare lo strumento di studio.
  }
  return result;
}
