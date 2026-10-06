import assert from 'node:assert/strict';
import { filterGlossaryEntries, glossaryTermLooksUseful } from '../src/lib/glossaryQuality.js';

assert.equal(glossaryTermLooksUseful('manonna'), false);
assert.equal(glossaryTermLooksUseful('pagina'), false);
assert.equal(glossaryTermLooksUseful('usufrutto'), true);
assert.equal(glossaryTermLooksUseful('responsabilità extracontrattuale'), true);

const source = "L'usufrutto attribuisce al titolare il diritto di godere della cosa rispettandone la destinazione economica.";
const summary = "L'usufrutto attribuisce il diritto di godere della cosa nel rispetto della destinazione economica.";
const filtered = filterGlossaryEntries([
  { term:'manonna', definition:'parola senza senso', confidence:0.99 },
  { term:'pagina', definition:'facciata di un foglio', confidence:0.99 },
  { term:'usufrutto', definition:'diritto reale di godimento', confidence:0.96, basis:'general' },
  { term:'ipoteca', definition:'garanzia reale', confidence:0.99, basis:'general' },
], { source, summary, limit:3, minConfidence:.86, requireConfidence:true });

assert.deepEqual(filtered.map((item) => item.term), ['usufrutto']);
console.log(JSON.stringify({ ok:true, terms:filtered.map((item)=>item.term) }, null, 2));
