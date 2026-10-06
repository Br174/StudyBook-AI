const COMMON_TERMS = new Set([
  'pagina','pagine','capitolo','capitoli','paragrafo','paragrafi','testo','libro','documento','documenti',
  'persona','persone','cosa','cose','parte','parti','modo','modi','caso','casi','esempio','esempi',
  'tempo','tempi','anno','anni','giorno','giorni','termine','termini','numero','numeri',
  'studio','studente','studenti','materia','materie','concetto','concetti','regola','regole',
  'diritto','diritti','legge','leggi','articolo','articoli','norma','norme',
  'manonna'
]);

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function vowelCount(value) {
  return (String(value || '').match(/[aeiouàèéìòóù]/gi) || []).length;
}

export function glossaryTermLooksUseful(value) {
  const term = clean(value);
  const lower = term.toLocaleLowerCase('it-IT');
  if (!term || term.length < 3 || term.length > 90) return false;
  if (COMMON_TERMS.has(lower)) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(term)) return false;
  if (/\d{4,}/.test(term) || /[_={}<>]/.test(term)) return false;
  if (/(.)\1\1/i.test(term)) return false;
  const words = term.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  if (words.length === 1 && term.length >= 6 && vowelCount(term) === 0) return false;
  if (/^(?:quest[oaie]|stess[oaie]|altr[oaie]|molto|molta|molti|molte|quindi|inoltre|tuttavia)$/i.test(term)) return false;
  return true;
}

export function filterGlossaryEntries(entries = [], {
  source = '',
  summary = '',
  limit = 6,
  minConfidence = 0,
  requireConfidence = false,
} = {}) {
  const sourceLower = clean(source).toLocaleLowerCase('it-IT');
  const summaryLower = clean(summary).toLocaleLowerCase('it-IT');
  const seen = new Set();
  const out = [];

  for (const entry of entries || []) {
    const term = clean(entry?.term).slice(0, 90);
    const definition = clean(entry?.definition).replace(/[.;:]$/, '').slice(0, 240);
    if (!glossaryTermLooksUseful(term) || !definition || definition.length < 3) continue;

    const lower = term.toLocaleLowerCase('it-IT');
    if (sourceLower && !sourceLower.includes(lower)) continue;
    if (summaryLower && !summaryLower.includes(lower)) continue;

    const rawConfidence = Number(entry?.confidence);
    if (requireConfidence && !Number.isFinite(rawConfidence)) continue;
    if (Number.isFinite(rawConfidence) && rawConfidence < minConfidence) continue;

    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({
      ...entry,
      term,
      definition,
      confidence: Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
