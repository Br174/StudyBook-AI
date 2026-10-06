import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MOTORLAB_RUNTIME_VERSION,
  chooseRuntimeConcurrency,
  makeRuntimeUnitKey,
  runAdaptiveBatchQueue,
} from '../src/lib/motorLabRuntime.js';

assert.equal(MOTORLAB_RUNTIME_VERSION, 'studybook-r21-runtime-v1');
assert.equal(chooseRuntimeConcurrency(undefined, {
  connection: { saveData: true },
  hardwareConcurrency: 8,
}), 1);
assert.equal(chooseRuntimeConcurrency(undefined, {
  effectiveType: '3g',
  hardwareConcurrency: 8,
}), 2);
assert.equal(chooseRuntimeConcurrency(undefined, {
  hardwareConcurrency: 4,
}), 2);
assert.equal(chooseRuntimeConcurrency(undefined, {
  hardwareConcurrency: 8,
}), 4);
assert.equal(chooseRuntimeConcurrency(2, {
  hardwareConcurrency: 16,
}), 2);

const unit = {
  chapterTitle: 'Capitolo',
  text: 'Testo invariato.',
  previousText: 'Prima.',
  nextText: 'Dopo.',
  chapterMemory: 'Memoria capitolo',
  bookMemory: 'Memoria libro',
  sourceMeta: { sourceSection: 'Sezione', sourcePageStart: 1, sourcePageEnd: 1 },
};
const keyA = makeRuntimeUnitKey(unit, 'studio');
const keyB = makeRuntimeUnitKey({ ...unit, text: 'Testo modificato.' }, 'studio');
assert.equal(keyA, makeRuntimeUnitKey(unit, 'studio'));
assert.notEqual(keyA, keyB);

let active = 0;
let peak = 0;
const processed = [];
const batches = [[1], [2], [3], [4], [5], [6]];
const metrics = await runAdaptiveBatchQueue({
  batches,
  preferAi: true,
  initialConcurrency: 3,
  maxConcurrency: 4,
  async worker(batch) {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    const id = batch[0];
    processed.push(id);
    return {
      batch,
      summaries: [{ summary: String(id), dsaSummary: String(id), engine: id === 2 ? 'locale' : 'ai' }],
      aiSuccess: id !== 2,
      aiFailure: id === 2 ? 'AI_TIMEOUT' : null,
    };
  },
});
assert.deepEqual([...processed].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
assert.equal(metrics.aiFailures, 1);
assert.equal(metrics.correctionRelays, 1);
assert.ok(peak >= 2 && peak <= 3);
assert.ok(metrics.finalConcurrency <= metrics.maxConcurrencyUsed);

const engine = await readFile('src/lib/studyEngineV09.js', 'utf8');
const store = await readFile('src/lib/resumeStore.js', 'utf8');
const app = await readFile('src/AppV15.jsx', 'utf8');
const workflow = await readFile('.github/workflows/android-apk.yml', 'utf8');

assert.ok(engine.includes("from './motorLabRuntime.js'"));
assert.ok(engine.includes('loadRuntimeUnitResults'));
assert.ok(engine.includes('saveRuntimeUnitResults'));
assert.ok(engine.includes('motorLabRuntime'));
assert.ok(engine.includes('runAdaptiveBatchQueue'));
assert.ok(store.includes("const DB_VERSION = 2"));
assert.ok(store.includes("runtime-unit-results"));
assert.ok(app.includes('MotorLab Runtime'));
assert.ok(workflow.includes('lab/studybook-core-android-01-update-03'));
assert.ok(workflow.includes('StudyBook-AI-LAB-03-AGGIORNAMENTO'));
assert.ok(workflow.includes('StudyBook-AI-LAB-03-RIPRISTINO'));

console.log(JSON.stringify({
  ok: true,
  runtime: MOTORLAB_RUNTIME_VERSION,
  adaptiveRunners: true,
  incrementalUnitCache: true,
  correctionRelay: true,
  runtimeMetrics: true,
  androidLab03Lifecycle: true,
}, null, 2));
