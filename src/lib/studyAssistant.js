import { purgeExpiredStudyHelpCache, readStudyHelpCache, writeStudyHelpCache } from './studyHelpCache.js';

export const STUDY_ACTIONS = [
  { id: 'simple', label: 'Spiegami semplice' },
  { id: 'meaning', label: 'Che significa?' },
  { id: 'example', label: 'Fammi un esempio' },
  { id: 'importance', label: 'Perché è importante?' },
  { id: 'remember', label: 'Cosa devo ricordare?' },
  { id: 'exam', label: 'Domanda d’esame' },
];

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
  return `studybook:study-help:v2:${hashText([
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

export async function askStudyAssistant(payload) {
  const key = cacheKey(payload);
  const sessionCached = readSessionCache(key);
  if (sessionCached) return sessionCached;

  const persisted = await readStudyHelpCache(key);
  if (persisted) {
    writeSessionCache(key, persisted);
    return persisted;
  }

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
  const result = {
    answer: String(data.answer).trim(),
    basis: data.basis === 'general' ? 'general' : 'source',
    label: String(data.label || '').trim(),
    cached: false,
  };

  writeSessionCache(key, result);
  await writeStudyHelpCache(key, result);
  purgeExpiredStudyHelpCache();
  return result;
}
