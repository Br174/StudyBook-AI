import assert from 'node:assert/strict';
import {
  SCANNER_RESERVE_BYTES,
  classifyScannerStorage,
  computeScannerTargetSize,
  formatStorageBytes,
} from '../src/lib/scannerStorage.js';

const MB = 1024 * 1024;

const target = computeScannerTargetSize(4000, 3000, 2600);
assert.equal(target.width, 2600);
assert.equal(target.height, 1950);
assert.ok(target.scale < 1);

const unchanged = computeScannerTargetSize(1600, 1200, 2600);
assert.deepEqual(unchanged, { width: 1600, height: 1200, scale: 1 });

assert.equal(classifyScannerStorage({ usage: 100 * MB, quota: 1000 * MB, extraBytes: 4 * MB }).risk, 'ok');
assert.equal(classifyScannerStorage({ usage: 820 * MB, quota: 1000 * MB, extraBytes: 4 * MB }).risk, 'warning');
assert.equal(classifyScannerStorage({ usage: 930 * MB, quota: 1000 * MB, extraBytes: 4 * MB }).risk, 'critical');
assert.equal(classifyScannerStorage({ usage: 980 * MB, quota: 1000 * MB, extraBytes: 8 * MB }).risk, 'blocked');

const nearFull = classifyScannerStorage({
  usage: 100 * MB,
  quota: 120 * MB,
  extraBytes: 5 * MB,
});
assert.equal(nearFull.risk, 'blocked');
assert.ok(nearFull.available < 32 * MB);
assert.ok(SCANNER_RESERVE_BYTES >= 16 * MB);

assert.equal(classifyScannerStorage({ usage: 10, quota: 0, extraBytes: 10 }).risk, 'unknown');
assert.equal(formatStorageBytes(1024 * 1024), '1.0 MB');
assert.equal(formatStorageBytes(2 * 1024 * 1024 * 1024), '2.0 GB');

console.log('Scanner storage protection helpers: OK');
