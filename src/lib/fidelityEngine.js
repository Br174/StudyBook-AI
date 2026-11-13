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

// LAB56: narrow Italian deontic equivalence. "non permette" and "vieta"
// may express the SAME prohibition, but only in the SAME anchored proposition.
// "non è" in general, dates, articles and conditional exceptions are never
// silently treated as equivalents. This remains the ONE fidelity owner.
const NEGATED_PERMISSION_V56=/\bnon\s+(?:(?:è|sono|era|erano)\s+)?(?:permett(?:e|ono|eva|evano)|consent(?:e|ono|iva|ivano)|permess[oaie]|consentit[oaie]|ammess[oaie])\b/iu;
const EXPLICIT_PROHIBITION_V56=/\b(?:vieta|vietano|vietat[oaie]|proibisce|proibiscono|proibit[oaie])\b/iu;
const PERMISSION_VERBS_V56=/^(?:permett\w*|consent\w*|permess\w*|consentit\w*|ammess\w*|vieta\w*|vietat\w*|proibisc\w*|proibit\w*)$/iu;
function meaningAnchorsV56(value){
  return [...new Set(contentWords(value).filter(x=>!PERMISSION_VERBS_V56.test(x)))];
}
function sameProtectedScopeV56(sourceUnit,targetUnit){
  const sourceTerms=meaningAnchorsV56(sourceUnit),targetTerms=new Set(meaningAnchorsV56(targetUnit));
  const overlap=sourceTerms.filter(x=>targetTerms.has(x)).length;
  return overlap>=2 && overlap/Math.max(1,sourceTerms.length)>=0.58;
}
function matchedProhibitionV56(sourceUnit,targetUnits){
  if(!NEGATED_PERMISSION_V56.test(sourceUnit))return false;
  // A contradictory clause that fits the topic better wins, never fall back
  // to an unrelated clause with the word "vietato" elsewhere in the book.
  const ranked=targetUnits.map(text=>{
    const sourceTerms=meaningAnchorsV56(sourceUnit),targetTerms=new Set(meaningAnchorsV56(text));
    return {text,hits:sourceTerms.filter(x=>targetTerms.has(x)).length,
      coverage:sourceTerms.filter(x=>targetTerms.has(x)).length/Math.max(1,sourceTerms.length)};
  }).sort((a,b)=>b.hits-a.hits||b.coverage-a.coverage);
  const best=ranked[0];
  return Boolean(best && sameProtectedScopeV56(sourceUnit,best.text) &&
    (EXPLICIT_PROHIBITION_V56.test(best.text)||NEGATED_PERMISSION_V56.test(best.text)));
}
function scopedNegationCoveredV56(source,target){
  const units=splitSemanticUnits(source).filter(u=>/\bnon\b/iu.test(u));
  if(!units.length)return false;
  const targets=splitSemanticUnits(target);
  return units.every(u=>matchedProhibitionV56(u,targets));
}
function protectedCovered(item, target, source='') {
  const haystack = normalizeFidelityText(target).toLocaleLowerCase('it-IT');
  const needle = item.value.toLocaleLowerCase('it-IT');
  if(haystack.includes(needle))return true;
  // No global keyword whitelist. Only a narrowly scoped equivalent
  // prohibition allows the literal "non" to disappear in paraphrase.
  if(item.kind==='qualifier' && needle==='non')
    return scopedNegationCoveredV56(source,target);
  return false;
}


// Qualifiers are scoped to their factual assertion, not merely counted globally.
// "A non è B; C è D" and "A è B; C non è D" are NOT equivalent.
function qualifierSet(value) {
  const set=new Set((normalizeFidelityText(value).toLocaleLowerCase('it-IT')
    .match(/\b(?:non|salvo|eccetto|tranne|purché|purche|solo se|a condizione che|esclusivamente|di regola)\b/g) || []));
  if(NEGATED_PERMISSION_V56.test(value)){
    set.delete('non');
    set.add('scope-prohibition');
  }
  if(EXPLICIT_PROHIBITION_V56.test(value))set.add('scope-prohibition');
  return set;
}
function qualifierMismatches(source, target) {
  const outputs = splitSemanticUnits(target);
  return splitSemanticUnits(source).flatMap((unit) => {
    const sourceQualifiers = qualifierSet(unit);
    const sourceWords = [...new Set(contentWords(unit))];
    if (!sourceWords.length) return [];
    const best = outputs.map((text) => ({
      text, overlap: sourceWords.filter((word) => new Set(contentWords(text)).has(word)).length / sourceWords.length,
    })).sort((a, b) => b.overlap - a.overlap)[0];
    if (!best || best.overlap < .45) return [];
    const outputQualifiers = qualifierSet(best.text);
    const equal = sourceQualifiers.size === outputQualifiers.size &&
      [...sourceQualifiers].every((token) => outputQualifiers.has(token));
    return equal ? [] : [{ source: unit, generated: best.text }];
  });
}

export function auditFidelity(source, studyText) {
  const original = normalizeFidelityText(source);
  const generated = normalizeFidelityText(studyText);
  const inventory = buildConceptInventory(original);
  const protectedItems = extractProtectedItems(original);
  const missingConcepts = inventory.filter((unit) => !unitCovered(unit.text, generated));
  const missingHighValue = missingConcepts.filter((unit) => unit.protected);
  const missingProtected = protectedItems.filter((item) => !protectedCovered(item, generated, original));
  const bindingErrors = qualifierMismatches(original, generated);

  const covered = inventory.length - missingConcepts.length;
  const coveragePercent = inventory.length ? Math.round((covered / inventory.length) * 1000) / 10 : 100;
  const sourceChars = original.length;
  const outputChars = generated.length;
  const compressionPercent = sourceChars
    ? Math.max(0, Math.round((1 - (outputChars / sourceChars)) * 1000) / 10)
    : 0;

  const passed = missingProtected.length === 0
    && missingHighValue.length === 0
    && bindingErrors.length === 0
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
    qualifierMismatches: bindingErrors,
  };
}

function sourceSentenceForUnit(source, unitText) {
  const target = normalizeFidelityText(unitText).toLocaleLowerCase('it-IT');
  const fullSentences = (normalizeFidelityText(source).match(/[^.!?]+(?:[.!?]+|$)/g) || [source])
    .map(normalizeFidelityText)
    .filter(Boolean);
  const exactCarrier = fullSentences.find((sentence) => sentence.toLocaleLowerCase('it-IT').includes(target));
  if (exactCarrier) return exactCarrier;

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


// LAB43 progressive-study relevance guard. This is an EXPLAINABLE topic
// consistency check, not a claim of full semantic understanding. Source-word
// preservation percentages must NOT determine summary correctness: a correct
// paraphrase may use fewer or different words.
const PROGRESSIVE_TOPIC_FAMILIES = [
  ['norma','norme','normativo','normativa','regola','regole','precetto','precetti'],
  ['diritto','diritti','giuridico','giuridica','giuridici','giuridiche'],
  ['obbligo','obblighi','dovere','doveri','obbligazione','obbligazioni'],
  ['facolta','facoltà','potere','poteri','possibilita','possibilità'],
  ['giustizia','giusto','giusta','equita','equità'],
  ['liberta','libertà','autonomia'],
  ['responsabilita','responsabilità','responsabile'],
  ['sociale','sociali','societa','società','collettivita','collettività'],
  ['stabilisce','stabilire','prevede','prevedere','fissa','fissare','impone','imporre','prescrive'],
  ['disciplina','disciplinare','regolano','regolamenta'],
  ['contratto','contratti','accordo','accordi'],
  ['sanzione','sanzioni','pena','pene'],
  ['legge','leggi','legislazione','normativa'],
];
const PROGRESSIVE_TOPIC_MAP=new Map(PROGRESSIVE_TOPIC_FAMILIES.flatMap((group,index)=>
  group.map(word=>[word.toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,''),'t'+index])));
const PROGRESSIVE_NOISE = new Set(['quindi','infatti','tuttavia','inoltre','piuttosto','distinzione',
 'particolare','possibile','considerare','considerazione','elemento','elementi','parte','parti',
 'contenuto','contenuti','concetto','concetti','importante','aspetto','aspetti','esempio','esempi',
 'generale','generali','specifico','specifica','diverso','diversa']);
function progressiveKey(word){
  const token=String(word||'').toLocaleLowerCase('it-IT').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'');
  if(PROGRESSIVE_NOISE.has(token))return null;
  if(PROGRESSIVE_TOPIC_MAP.has(token))return PROGRESSIVE_TOPIC_MAP.get(token);
  // A light Italian morphological variant, never an arbitrary synonym guess.
  if(token.length>=6 && /[aeio]$/u.test(token))return token.slice(0,-1);
  return token.length>=4?token:null;
}
function progressiveTerms(text){
  return [...new Set(contentWords(text).map(progressiveKey).filter(Boolean))];
}
export function auditProgressiveConcepts(source,generated){
  const sourceTopics=progressiveTerms(source),generatedTopics=progressiveTerms(generated);
  const sourceSet=new Set(sourceTopics);
  const shared=generatedTopics.filter(key=>sourceSet.has(key));
  // Require actual source-topic support, including at least two independent
  // topics for a multi-concept source. No rigid "50% original vocabulary" gate.
  const minimum=sourceTopics.length>=3?2:sourceTopics.length>0?1:0;
  const issues=[];
  if(shared.length<minimum)issues.push('source-topic-support-insufficient');
  // Newly introduced legal citations, numeric/date claims or qualifiers must
  // not be approved just because they share the same broad subject.
  const protectedSource=new Set(extractProtectedItems(source).filter(x=>x.kind!=='qualifier')
    .map(x=>x.kind+':'+x.value.toLocaleLowerCase('it-IT')));
  const unsupported=extractProtectedItems(generated)
    .filter(x=>x.kind!=='qualifier' && !protectedSource.has(x.kind+':'+x.value.toLocaleLowerCase('it-IT')));
  if(unsupported.length)issues.push('new-protected-fact-not-in-source');
  return {supported:issues.length===0,issues,sharedTopicCount:shared.length,
    sourceTopicCount:sourceTopics.length,generatedTopicCount:generatedTopics.length};
}


// LAB125: source-grounded, deterministic checks for semantic relation reversals.
// This extends the existing fidelity owner. It is not a second reviewer, model,
// quota consumer or semantic-certification service.
export function auditCriticalRelationsV125(source, simplified, glossary = []) {
  const normalize = value => normalizeFidelityText(value)
    .normalize('NFC').toLocaleLowerCase('it-IT').replace(/[’]/gu, "'");
  const src = normalize(source), dst = normalize(simplified), issues = [];
  const add = code => { if (!issues.includes(code)) issues.push(code); };
  // Locate the relation after its subject, never steal a predicate from the
  // next contrasting subject or the next sentence.
  function relation(text, role, property, peers) {
    for (const match of text.matchAll(role)) {
      const start = match.index + match[0].length;
      let tail = text.slice(start, start + 130);
      const period = tail.search(/[.;!?]/u);
      if (period >= 0) tail = tail.slice(0, period);
      const exclusion = tail.search(/\b(?:e non|ma non|invece di)\b/iu);
      if (exclusion >= 0) tail = tail.slice(0, exclusion);
      for (const peer of peers) {
        const found = new RegExp(peer.source, 'iu').exec(tail);
        if (found) tail = tail.slice(0, found.index);
      }
      if (property.test(tail)) return true;
    }
    return false;
  }
  const roleTests = [
    {roles:[/\bprimari[ae]\b/giu, /\bsecondari[ae]\b/giu],
     values:[/\b(?:regol\w*.{0,36}condott\w*|impon\w*.{0,30}obbligh\w*)/iu,
             /\bconfer\w*.{0,40}poter\w*/iu],
     code:'V125_PRIMARY_SECONDARY_RELATION_REVERSED'},
    {roles:[/\bprimari[ae]\b/giu],
     values:[/\bsanzionator\w*/iu, /\bprecettiv\w*/iu],
     code:'V125_PRIMARY_SANCTION_RELATION_REVERSED'},
    {roles:[/\bvalidit[àa]\b/giu, /\befficaci[ae]\b/giu],
     values:[/\bdover essere\b/iu, /(?<!dover )\bessere\b/iu],
     code:'V125_VALIDITY_EFFICACY_REVERSED'},
    {roles:[/\bgerarchic[oa]\b/giu, /\bcronologic[oa]\b/giu],
     values:[/\bsuperior\w*/iu, /\bposterior\w*/iu],
     code:'V125_HIERARCHY_CHRONOLOGY_REVERSED'},
    {roles:[/\bistituzionalistic[oa]\b/giu, /\bnormativistic[oa]\b/giu],
     values:[/\borganizzazion\w*/iu, /\bnorm[ae]\b/iu],
     code:'V125_INSTITUTION_NORM_REVERSED'},
    {roles:[/\bkelsen\b/giu, /\bhart\b/giu],
     values:[/\bnorma fondamentale\b/iu, /\bnorma di riconoscimento\b/iu],
     code:'V125_AUTHOR_THEORY_REVERSED'}
  ];
  for (const rule of roleTests) {
    const [left, right] = rule.roles, [a,b] = rule.values;
    const peers = rule.roles;
    const leftA = relation(src,left,a,peers), leftB = relation(src,left,b,peers);
    const targetLeftA = relation(dst,left,a,peers), targetLeftB = relation(dst,left,b,peers);
    if ((leftA && !leftB && targetLeftB && !targetLeftA) ||
        (leftB && !leftA && targetLeftA && !targetLeftB)) add(rule.code);
    if (right) {
      const rightA=relation(src,right,a,peers),rightB=relation(src,right,b,peers);
      const targetRightA=relation(dst,right,a,peers),targetRightB=relation(dst,right,b,peers);
      if ((rightA&&!rightB&&targetRightB&&!targetRightA)||
          (rightB&&!rightA&&targetRightA&&!targetRightB)) add(rule.code);
    }
  }
  // A "may" -> "must" reversal in a substantially unchanged proposition
  // is not a lexical simplification; it changes the legal modality.
  const may=/(?<!\p{L})(?:può|possono)(?!\p{L})/iu,
    must=/(?<!\p{L})(?:deve|devono)(?!\p{L})/iu;
  const words=t=>new Set(t.match(/[\p{L}]{3,}/gu)||[]);
  const sourceWords=words(src),targetWords=words(dst);
  const overlap=[...sourceWords].filter(x=>targetWords.has(x)).length/
    Math.max(1,Math.min(sourceWords.size,targetWords.size));
  if (overlap>=0.6&&
      ((may.test(src)&&!must.test(src)&&must.test(dst)&&!may.test(dst))||
       (must.test(src)&&!may.test(src)&&may.test(dst)&&!must.test(dst))))
    add('V125_PERMISSION_OBLIGATION_CHANGED');

  // Legal article plural lists must not silently change their members.
  const articleLists=text=>[...text.matchAll(/\bartt\.?\s*\d{1,4}(?:\s*(?:,|e|ed|-)\s*\d{1,4})+/giu)]
    .map(hit=>(hit[0].match(/\d{1,4}/gu)||[]).join(',')).sort();
  const articleOriginal=articleLists(src),articleTarget=articleLists(dst);
  if (articleOriginal.length&&JSON.stringify(articleOriginal)!==JSON.stringify(articleTarget))
    add('V125_PLURAL_LEGAL_REFERENCE_CHANGED');

  // The glossary must not invent protected dates/articles, nor claim a
  // presupposed foundational norm is an ordinary parliamentary enactment.
  const protectedInSource=new Set(extractProtectedItems(source)
    .filter(item=>item.kind!=='qualifier').map(item=>item.kind+':'+normalize(item.value)));
  for (const entry of glossary||[]) {
    const definition=normalize(entry?.definition);
    if (!definition) continue;
    const addedFact=extractProtectedItems(definition)
      .filter(item=>item.kind!=='qualifier' &&
        !protectedInSource.has(item.kind+':'+normalize(item.value)));
    if (addedFact.length) add('V125_GLOSSARY_UNSUPPORTED_REFERENCE');
    if (/norma fondamentale/u.test(normalize(entry?.term))&&
        /presuppost/u.test(src)&&
        /(?:legge ordinaria|approvat.{0,35}parlament|approvat.{0,35}president)/u.test(definition)&&
        !/(?:legge ordinaria|approvat.{0,35}parlament|approvat.{0,35}president)/u.test(src))
      add('V125_GLOSSARY_FOUNDATIONAL_NORM_CONTRADICTION');
  }
  if (/[\uFFFD]|(?:Ã[¨©²¹])/u.test(String(simplified||'')))
    add('V125_BROKEN_ACCENTS_OR_ENCODING');
  return {issues, semanticCertified:false};
}


// LAB125 grammar: narrow high-confidence checks, with style-only advisories.
// A passing grammar check is not proof of perfect Italian.
export function auditItalianGrammarV125(text) {
  const input=String(text||'').normalize('NFC');
  const issues=[],advisories=[];
  const add=(arr,code)=>{if(!arr.includes(code))arr.push(code);};
  if (/[\uFFFD]|(?:Ã[¨©²¹])/u.test(input))add(issues,'V125_GRAMMAR_BROKEN_ENCODING');
  const stack=[],pairs={'(':')','«':'»','“':'”'};
  for(const char of input){
    if(Object.prototype.hasOwnProperty.call(pairs,char))stack.push(pairs[char]);
    else if([')', '»','”'].includes(char)){
      if(!stack.length||stack.pop()!==char){add(issues,'V125_GRAMMAR_UNBALANCED_PUNCTUATION');break;}
    }
  }
  if(stack.length)add(issues,'V125_GRAMMAR_UNBALANCED_PUNCTUATION');
  if(/[!?]{3,}|[,;:]{2,}/u.test(input))
    add(issues,'V125_GRAMMAR_INVALID_PUNCTUATION');
  if(/(?<!\p{L})(?:perche|poiche|benche|nonche|piu)(?!\p{L})/iu.test(input))
    add(issues,'V125_GRAMMAR_MISSING_ACCENT');
  if(/(?:^|[\s,;:.!?])(che|non|la|il|gli|una|uno|per|con|del|della)\s+\1(?=\s|[.,;:!?]|$)/iu.test(input))
    add(advisories,'V125_GRAMMAR_POSSIBLE_REPETITION');
  if(/\s+[,:;!?](?=\s|$)/u.test(input))
    add(advisories,'V125_GRAMMAR_SPACING_BEFORE_PUNCTUATION');
  return {issues,advisories};
}
