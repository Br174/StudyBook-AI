import assert from 'node:assert/strict';
import {
  scannerMetaRecord,
  scannerPageFromRecord,
  scannerPageToRecord,
} from '../src/lib/scannerSessionStore.js';

const blob = new Blob(['pagina scanner'], { type: 'image/jpeg' });
const page = {
  id: 'page-1',
  blob,
  fileName: 'pagina-1.jpg',
  fileType: 'image/jpeg',
  lastModified: 1234,
  text: 'Testo OCR importante.',
  status: 'ready',
  error: '',
  previewUrl: 'blob:transient-preview',
  parsed: { huge: 'transient-data' },
};

const record = scannerPageToRecord(page);
assert.equal(record.id, 'page-1');
assert.equal(record.text, 'Testo OCR importante.');
assert.equal(record.status, 'ready');
assert.equal(record.blob, blob);
assert.equal(record.fileName, 'pagina-1.jpg');
assert.equal('previewUrl' in record, false);
assert.equal('parsed' in record, false);

const restored = scannerPageFromRecord(record);
assert.equal(restored.id, 'page-1');
assert.equal(restored.text, 'Testo OCR importante.');
assert.equal(restored.status, 'ready');
assert.ok(restored.file instanceof Blob);

const interrupted = scannerPageFromRecord({
  ...record,
  id: 'page-2',
  status: 'processing',
  text: '',
});
assert.equal(interrupted.status, 'error');
assert.match(interrupted.error, /interrotto/i);
assert.match(interrupted.error, /Riprova OCR/i);

const meta = scannerMetaRecord('  Manuale di diritto  ', [
  { id: 'page-2' },
  { id: 'page-1' },
]);
assert.equal(meta.name, 'Manuale di diritto');
assert.deepEqual(meta.order, ['page-2', 'page-1']);

const longName = scannerMetaRecord('x'.repeat(120), []);
assert.equal(longName.name.length, 80);

console.log('Scanner session persistence model: OK');
