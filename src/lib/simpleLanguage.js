// LAB27: accessible Italian is a language view of the SELECTED edition.
// It must not select new facts, discard sentences or start another summary.
import { splitCompleteSentences } from './studyQualityGuard.js';

const TEXT_REPLACEMENTS = Object.freeze([
  [/\bqualora\b/gi,'se'],
  [/\bnondimeno\b/gi,'tuttavia'],
  [/\baltresì\b/gi,'anche'],
  [/\bpertanto\b/gi,'quindi'],
  [/\bconseguentemente\b/gi,'di conseguenza'],
  [/\bin virtù di\b/gi,'in base a'],
  [/\bin via preliminare\b/gi,'prima di tutto'],
  [/\bnell'ipotesi in cui\b/gi,'se'],
  [/\bnel caso in cui\b/gi,'se'],
  [/\bnel momento in cui\b/gi,'quando'],
  [/(?<![\p{L}])è necessario che\b/giu,'serve che'],
  [/(?<![\p{L}])è necessario\b/giu,'serve'],
  [/\bè opportuno\b/gi,'è utile'],
  [/\brappresenta\b/gi,'è'],
  [/\brappresentano\b/gi,'sono'],
  [/\bsi configura come\b/gi,'si presenta come'],
  [/\bè denominato\b/gi,'è chiamato'],
  [/\bviene denominato\b/gi,'è chiamato'],
  [/\bdenominata\b/gi,'chiamata'],
  [/\bdenominato\b/gi,'chiamato'],
  [/\bsi evince\b/gi,'si capisce'],
  [/\bsi desume\b/gi,'si ricava'],
  [/\bsi ravvisa\b/gi,'si riconosce'],
  [/\bsussiste\b/gi,'esiste'],
  [/\bsussistono\b/gi,'esistono'],
  [/\bè suscettibile di\b/gi,'può'],
  [/\bpuò essere desunto\b/gi,'si può ricavare'],
  [/\bpuò essere individuato\b/gi,'si può identificare'],
  [/\bè volto a\b/gi,'serve a'],
  [/\bè finalizzato a\b/gi,'serve a'],
  [/\bai sensi di\b/gi,'secondo'],
  [/\bcon riferimento a\b/gi,'riguardo a'],
  [/\bin relazione a\b/gi,'riguardo a'],
]);
const SIMPLE_GLOSSES = Object.freeze([
  [/\bordinamento giuridico\b/gi,'insieme organizzato delle norme giuridiche'],
  [/\bnorma giuridica\b/gi,'regola riconosciuta dal diritto'],
  [/\bnesso causale\b/gi,'legame tra un fatto e la sua conseguenza'],
  [/\bgiurisprudenza\b/gi,'insieme delle decisioni dei giudici'],
  [/\bfattispecie\b/gi,'situazione descritta dalla norma'],
  [/\btermine perentorio\b/gi,'scadenza che normalmente non può essere superata'],
  [/\bonere della prova\b/gi,'compito di dimostrare un fatto'],
  [/\bsoggetto giuridico\b/gi,'persona o ente che può avere diritti e doveri'],
  [/\bricorso giurisdizionale\b/gi,'richiesta rivolta a un giudice'],
  [/\bgerarchia delle fonti\b/gi,'ordine di importanza delle fonti del diritto'],
]);
const IMMUTABLE = /^(?:art(?:icolo)?\.?\s*\d+|legge\s+n?\.?\s*\d+)\b/i;
const FORMULA = /(?:^|\s)[\p{L}][\w²³]*(?:\s*[=≈≠≤≥]\s*)\S/u;
function caseAware(source, replacement) {
  return /^[A-ZÀ-Ö]/.test(source) ? replacement[0].toLocaleUpperCase('it-IT')+replacement.slice(1) : replacement;
}
function simplifySentence(sentence) {
  if (IMMUTABLE.test(sentence) || FORMULA.test(sentence)) return sentence;
  let result = sentence;
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    result = result.replace(pattern, (match) => caseAware(match, replacement));
  }
  // Technical terms remain verbatim with an accessible contextual explanation.
  let definitions = 0;
  for (const [pattern, explanation] of SIMPLE_GLOSSES) {
    if (definitions >= 1 || !pattern.test(result)) continue;
    pattern.lastIndex = 0;
    result = result.replace(pattern,(term)=>term+' ('+explanation+')');
    definitions++;
  }
  return result;
}
export function explainInSimpleWords(editionText) {
  const source = String(editionText || '');
  if (!source.trim()) return source;
  return source.split('\n').map((line) => {
    if (!line.trim()) return line;
    const bullet = line.match(/^(\s*•\s*)/);
    const start = bullet ? bullet[1] : '';
    const body = line.slice(start.length);
    if (IMMUTABLE.test(body.trim()) || FORMULA.test(body)) return line;
    const sentences = splitCompleteSentences(body);
    if (!sentences.length) return line;
    return start + sentences.map(simplifySentence).join(' ');
  }).join('\n');
}
