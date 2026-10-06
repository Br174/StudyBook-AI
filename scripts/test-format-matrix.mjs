import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('src/AppV15.jsx', 'utf8');
const parser = await readFile('src/lib/documentParserText.js', 'utf8');
const exporters = await readFile('src/lib/exporters.js', 'utf8');
const rich = await readFile('src/lib/exportersRich.js', 'utf8');
const delivery = await readFile('src/lib/fileDelivery.js', 'utf8');

for (const ext of ['.pdf','.docx','.epub','.txt','.html','.rtf','.odt','.md']) {
  assert.ok(app.includes(ext), `Formato import mancante: ${ext}`);
}
for (const parserName of ['parseDocx','parseEpub','parseHtmlFile','parseRtf','parseOdt','parseMarkdown']) {
  assert.ok(parser.includes(parserName), `Parser mancante: ${parserName}`);
}
for (const exportName of ['exportEpub','exportOdt','exportRtf','exportMarkdown']) {
  assert.ok(exporters.includes(exportName), `Export non esposto: ${exportName}`);
  assert.ok(rich.includes(`function ${exportName}`) || rich.includes(`function ${exportName.replace('export','export')}`) || rich.includes(`async function ${exportName}`) || rich.includes(`function ${exportName}`), `Implementazione export mancante: ${exportName}`);
}
assert.ok(delivery.includes('FileViewer.openDocumentFromLocalPath'));
assert.ok(delivery.includes('preferOpen'));
console.log(JSON.stringify({ ok:true, imports:8, richExports:4, pdfViewer:true }, null, 2));
