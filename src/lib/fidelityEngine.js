const STOP_WORDS = new Set([
  'anche','che','chi','come','con','cosa','da','dal','dalla','dalle','dei','del','della','delle',
  'di','e','ed','era','essere','gli','ha','hanno','i','il','in','la','le','lo','ma','nel','nella',
  'nelle','non','o','per','piu','più','quale','quali','quando','questo','questa','questi','queste',
  'se','si','sia','sono','su','tra','un','una','uno','al','alla','alle','ai','agli','dai','dagli',
  'dopo','prima','poi','molto','molti','molte','ogni','solo','sua','suo','sue','suoi','loro'
]);

const HIGH_VALUE = [
  /\b(?:si definisce|è definito|e definito|si intende per|consiste in|costituisce|significa)\b/i,
  /\b(?:deve|devono|può|possono|non può|non possono|è tenuto|sono tenuti|vietato|obbligatorio)\b/i,
  /\b(?:salvo|eccetto|tranne|purché|purche|a condizione|solo se|qualora|tuttavia|invece)\b/i,
  /\b(?:requisit|presuppost|condizion|eccezion|limiti?|classific|categorie|tipi|elementi|effetti?)\b/i,
  /\b(?:causa|conseguenz|determina|comporta|deriva|dipende|pertanto|quindi)\b/i,
  /\b(?:diritto|obbligo|divieto|sanzion|rimedio|competenz|termine|scadenz|onere)\b/i,
  /\b(?:art\.?|articolo|comma|codice|legge|decreto|regolamento|sentenza|corte|cassazione)\b/i,
  /\b\d+(?:[.,]\d+)?%?\b/
];

const PROTECTED_PATTERNS = [
  ['legal-ref', /\b(?:art(?:icolo)?\.?\s*)\d+(?:[-\s]?(?:bis|ter|quater|quinquies))?(?:\s*,?\s*(?:co\.?|comma)\s*\d+)?(?:\s+(?:c\.?c\.?|c\.?p\.?c\.?|c\.?p\.?|cost\.?))?/gi],
  ['date-number', /\b(?:1[0-9]{3}|20[0-9]{2}|\d{1,3}(?:[.,]\d+)?%)\b/g],
  ['deadline', /\b\d+\s+(?:giorni?|mesi?|anni?|ore)\b/gi],
  ['qualifier', /\b(?:non|salvo|eccetto|tranne|purché|purche|solo se|a condizione che|qualora|di regola|esclusivamente|necessariamente)\b/gi],
];

export function normalizeFidelityText(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitSemanticUnits(value) {
  const text = normalizeFidelityText(value);
  if (!text) return [];
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text];
  const units = [];
  sentences.forEach((rawSentence) => {
    const sentence = normalizeFidelityText(rawSentence);
    if (!sentence) return;
    const parts = sentence
      .split(/(?<=\S)\s*;\s+|\s+(?=(?:salvo|eccetto|tranne|purché|purche|tuttavia|invece|mentre|a condizione che|solo se)\b)/i)
      .map(normalizeFidelityText)
      .filter(Boolean);
    if (parts.length > 1) units.push(...parts);
    else units.push(sentence);
  });
  return units;
}

function contentWords(value) {
  return normalizeFidelityText(value)
    .toLocaleLowerCase('it-IT')
    .replace(/[^a-zà-öø-ÿ0-9'-]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function coverageScore(source, target) {
  const words = [...new Set(contentWords(source))];
  if (!words.length) return 1;
  const targetWords = new Set(contentWords(target));
  return words.filter((word) => targetWords.has(word)).length / words.length;
}

function unitCovered(unit, target) {
  const source = normalizeFidelityText(unit).toLocaleLowerCase('it-IT');
  const dest = normalizeFidelityText(target).toLocaleLowerCase('it-IT');
  if (!source) return true;
  if (dest.includes(source)) return true;
  const words = [...new Set(contentWords(unit))];
  const score = coverageScore(unit, target);
  if (words.length <= 4) return score >= 0.75;
  if (words.length <= 8) return score >= 0.58;
  return score >= 0.44;
}

export function extractProtectedItems(source) {
  const text = normalizeFidelityText(source);
  const seen = new Set();
  const output = [];
  for (const [kind, pattern] of PROTECTED_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = normalizeFidelityText(match[0]);
      const key = `${kind}:${value.toLocaleLowerCase('it-IT')}`;
      if (!value || seen.has(key)) continue;
      seen.add(key);
      output.push({ kind, value });
    }
  }
  return output;
}

export function buildConceptInventory(source) {
  return splitSemanticUnits(source).map((text, index) => ({
    id: `C${index + 1}`,
    text,
    protected: HIGH_VALUE.some((pattern) => pattern.test(text)),
    keywords: [...new Set(contentWords(text))].slice(0, 14),
  }));
}

function protectedCovered(item, target) {
  const haystack = normalizeFidelityText(target).toLocaleLowerCase('it-IT');
  const needle = item.value.toLocaleLowerCase('it-IT');
  if (item.kind === 'qualifier') return haystack.includes(needle);
  return haystack.includes(needle);
}

export function auditFidelity(source, studyText) {
  const original = normalizeFidelityText(source);
  const generated = normalizeFidelityText(studyText);
  const inventory = buildConceptInventory(original);
  const protectedItems = extractProtectedItems(original);
  const missingConcepts = inventory.filter((unit) => !unitCovered(unit.text, generated));
  const missingHighValue = missingConcepts.filter((unit) => unit.protected);
  const missingProtected = protectedItems.filter((item) => !protectedCovered(item, generated));

  const covered = inventory.length - missingConcepts.length;
  const coveragePercent = inventory.length ? Math.round((covered / inventory.length) * 1000) / 10 : 100;
  const sourceChars = original.length;
  const outputChars = generated.length;
  const compressionPercent = sourceChars
    ? Math.max(0, Math.round((1 - (outputChars / sourceChars)) * 1000) / 10)
    : 0;

  const passed = missingProtected.length === 0
    && missingHighValue.length === 0
    && coveragePercent >= 82;

  return {
    passed,
    coveragePercent,
    compressionPercent,
    sourceChars,
    outputChars,
    conceptCount: inventory.length,
    protectedCount: protectedItems.length,
    missingConcepts,
    missingHighValue,
    missingProtected,
  };
}

function sourceSentenceForUnit(source, unitText) {
  const sentences = splitSemanticUnits(source);
  const targetWords = new Set(contentWords(unitText));
  let best = '';
  let bestScore = -1;
  for (const sentence of sentences) {
    const words = contentWords(sentence);
    if (!words.length) continue;
    const hits = words.filter((word) => targetWords.has(word)).length;
    const score = hits / Math.max(1, targetWords.size);
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  return best;
}

export function repairStudyText(source, generatedText, audit = auditFidelity(source, generatedText)) {
  if (audit.passed) return { text: normalizeFidelityText(generatedText), recovered: [] };

  const wanted = [];
  const seen = new Set();
  const candidates = [
    ...audit.missingHighValue.map((item) => item.text),
    ...audit.missingProtected.map((item) => sourceSentenceForUnit(source, item.value)),
  ].filter(Boolean);

  for (const sentence of candidates) {
    const clean = normalizeFidelityText(sentence);
    const key = clean.toLocaleLowerCase('it-IT');
    if (!clean || seen.has(key) || unitCovered(clean, generatedText)) continue;
    seen.add(key);
    wanted.push(clean);
  }

  return {
    text: normalizeFidelityText([generatedText, ...wanted].filter(Boolean).join(' ')),
    recovered: wanted,
  };
}

function fingerprintSentence(value) {
  return contentWords(value).join(' ');
}

export function removeExactCrossParagraphRedundancy(paragraphs = []) {
  const seen = new Set();
  return paragraphs.map((paragraph) => {
    const text = normalizeFidelityText(paragraph?.summary);
    const kept = [];
    for (const sentence of splitSemanticUnits(text)) {
      const key = fingerprintSentence(sentence);
      const duplicate = key.length >= 45 && seen.has(key);
      if (!duplicate) {
        kept.push(sentence);
        if (key.length >= 45) seen.add(key);
      }
    }
    const summary = normalizeFidelityText(kept.join(' ')) || text;
    return { ...paragraph, summary };
  });
}
