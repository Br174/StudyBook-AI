export const MOTORLAB_RUNTIME_VERSION = 'studybook-r21-runtime-v1';

const HARD_MAX_CONCURRENCY = 4;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function runtimeHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function makeRuntimeUnitKey(unit, level = 'studio') {
  const fingerprint = [
    MOTORLAB_RUNTIME_VERSION,
    level,
    unit?.chapterTitle || '',
    unit?.sourceMeta?.sourceSection || '',
    unit?.sourceMeta?.sourcePageStart ?? '',
    unit?.sourceMeta?.sourcePageEnd ?? '',
    unit?.previousText || '',
    unit?.text || '',
    unit?.nextText || '',
    unit?.chapterMemory || '',
    unit?.bookMemory || '',
  ].join('::');
  return `mlr:${runtimeHash(fingerprint)}`;
}

export function chooseRuntimeConcurrency(maxConcurrency, environment = {}) {
  const nav = environment.navigator || globalThis.navigator || {};
  const connection = environment.connection || nav.connection || {};
  const hardwareConcurrency = Number(environment.hardwareConcurrency ?? nav.hardwareConcurrency ?? 0);
  const deviceMemory = Number(environment.deviceMemory ?? nav.deviceMemory ?? 0);
  const effectiveType = String(environment.effectiveType ?? connection.effectiveType ?? '').toLowerCase();

  let cap = HARD_MAX_CONCURRENCY;
  if (Number.isFinite(Number(maxConcurrency)) && Number(maxConcurrency) > 0) {
    cap = Math.min(cap, Math.floor(Number(maxConcurrency)));
  }

  if (connection.saveData) return 1;

  let target = 3;
  if (effectiveType === 'slow-2g' || effectiveType === '2g') target = 1;
  else if (effectiveType === '3g') target = Math.min(target, 2);

  if (hardwareConcurrency > 0) {
    if (hardwareConcurrency <= 2) target = Math.min(target, 1);
    else if (hardwareConcurrency <= 4) target = Math.min(target, 2);
    else if (hardwareConcurrency >= 8 && !effectiveType) target = 4;
  }

  if (deviceMemory > 0) {
    if (deviceMemory <= 2) target = Math.min(target, 1);
    else if (deviceMemory <= 4) target = Math.min(target, 2);
  }

  return clamp(target, 1, Math.max(1, cap));
}

export async function runAdaptiveBatchQueue({
  batches = [],
  worker,
  preferAi = true,
  initialConcurrency = 3,
  maxConcurrency = HARD_MAX_CONCURRENCY,
  onWave,
} = {}) {
  if (typeof worker !== 'function') throw new Error('MotorLab Runtime richiede un worker.');
  const ceiling = clamp(Math.floor(Number(maxConcurrency) || HARD_MAX_CONCURRENCY), 1, HARD_MAX_CONCURRENCY);
  let concurrency = clamp(Math.floor(Number(initialConcurrency) || 1), 1, ceiling);
  let maxConcurrencyUsed = concurrency;
  let cursor = 0;
  let waveNumber = 0;
  let cleanWaves = 0;
  let aiEnabled = Boolean(preferAi);
  let aiFailures = 0;
  let correctionRelays = 0;

  while (cursor < batches.length) {
    const waveSize = Math.min(concurrency, batches.length - cursor);
    const waveBatches = batches.slice(cursor, cursor + waveSize);
    const aiAllowed = aiEnabled;
    const results = await Promise.all(waveBatches.map((batch, offset) => (
      worker(batch, {
        aiAllowed,
        runnerIndex: offset,
        concurrency,
        waveNumber: waveNumber + 1,
      })
    )));
    cursor += waveSize;
    waveNumber += 1;

    const failures = results.filter((item) => item?.aiFailure);
    const successes = results.filter((item) => item?.aiSuccess);
    const aiNotConfigured = failures.some((item) => item.aiFailure === 'AI_NOT_CONFIGURED');
    aiFailures += failures.length;
    correctionRelays += failures.length;

    if (aiNotConfigured) {
      aiEnabled = false;
      concurrency = 1;
      cleanWaves = 0;
    } else if (failures.length) {
      concurrency = Math.max(1, concurrency - 1);
      cleanWaves = 0;
    } else if (aiAllowed && successes.length === results.length && results.length) {
      cleanWaves += 1;
      if (cleanWaves >= 2 && concurrency < ceiling) {
        concurrency += 1;
        maxConcurrencyUsed = Math.max(maxConcurrencyUsed, concurrency);
        cleanWaves = 0;
      }
    }

    if (onWave) {
      await onWave({
        results,
        concurrency,
        maxConcurrencyUsed,
        waveNumber,
        processedBatches: cursor,
        totalBatches: batches.length,
        aiEnabled,
        aiFailures,
        correctionRelays,
      });
    }
  }

  return {
    runtimeId: MOTORLAB_RUNTIME_VERSION,
    waves: waveNumber,
    processedBatches: cursor,
    totalBatches: batches.length,
    initialConcurrency: clamp(Math.floor(Number(initialConcurrency) || 1), 1, ceiling),
    finalConcurrency: concurrency,
    maxConcurrencyUsed,
    aiEnabled,
    aiFailures,
    correctionRelays,
  };
}
