const MB = 1024 * 1024;
export const SCANNER_LONG_EDGE = 2600;
export const SCANNER_JPEG_QUALITY = 0.9;
export const SCANNER_COMPRESS_MIN_BYTES = 900 * 1024;
export const SCANNER_RESERVE_BYTES = 16 * MB;

export function formatStorageBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function computeScannerTargetSize(width, height, maxLongEdge = SCANNER_LONG_EDGE) {
  const w = Math.max(1, Number(width || 1));
  const h = Math.max(1, Number(height || 1));
  const longest = Math.max(w, h);
  if (longest <= maxLongEdge) return { width: Math.round(w), height: Math.round(h), scale: 1 };
  const scale = maxLongEdge / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
  };
}

export function classifyScannerStorage({ usage = 0, quota = 0, extraBytes = 0 } = {}) {
  const safeUsage = Math.max(0, Number(usage || 0));
  const safeQuota = Math.max(0, Number(quota || 0));
  const extra = Math.max(0, Number(extraBytes || 0));
  if (!safeQuota) {
    return { risk: 'unknown', ratio: null, available: null, projected: safeUsage + extra };
  }

  const available = Math.max(0, safeQuota - safeUsage);
  const projected = safeUsage + extra;
  const ratio = projected / safeQuota;
  const remainingAfterWrite = available - extra;

  if (remainingAfterWrite < SCANNER_RESERVE_BYTES || ratio >= 0.985) {
    return { risk: 'blocked', ratio, available, projected };
  }
  if (ratio >= 0.92 || remainingAfterWrite < 48 * MB) {
    return { risk: 'critical', ratio, available, projected };
  }
  if (ratio >= 0.8 || remainingAfterWrite < 120 * MB) {
    return { risk: 'warning', ratio, available, projected };
  }
  return { risk: 'ok', ratio, available, projected };
}

export async function estimateScannerStorage(extraBytes = 0) {
  if (!globalThis.navigator?.storage?.estimate) {
    return {
      supported: false,
      usage: null,
      quota: null,
      available: null,
      projected: null,
      ratio: null,
      risk: 'unknown',
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = Number(estimate?.usage || 0);
    const quota = Number(estimate?.quota || 0);
    return {
      supported: true,
      usage,
      quota,
      ...classifyScannerStorage({ usage, quota, extraBytes }),
    };
  } catch {
    return {
      supported: false,
      usage: null,
      quota: null,
      available: null,
      projected: null,
      ratio: null,
      risk: 'unknown',
    };
  }
}

export async function requestScannerPersistence() {
  if (!globalThis.navigator?.storage?.persist) return null;
  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try { return await createImageBitmap(file); } catch { /* fallback below */ }
    }
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw new Error('Decodifica immagine non disponibile.');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('Immagine non leggibile.'));
      node.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Compressione immagine non riuscita.')),
      type,
      quality,
    );
  });
}

export async function compressScannerImage(file, {
  maxLongEdge = SCANNER_LONG_EDGE,
  quality = SCANNER_JPEG_QUALITY,
  minBytes = SCANNER_COMPRESS_MIN_BYTES,
} = {}) {
  if (!(file instanceof Blob) || !String(file.type || '').startsWith('image/')) return file;
  if (file.size <= minBytes) return file;
  if (typeof document === 'undefined') return file;

  let source;
  try {
    source = await loadImageSource(file);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) return file;

    const target = computeScannerTargetSize(width, height, maxLongEdge);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    canvas.width = 1;
    canvas.height = 1;

    if (blob.size >= file.size * 0.96) return file;
    const originalName = file.name || 'pagina.jpg';
    const stem = originalName.replace(/\.[^.]+$/, '') || 'pagina';
    if (typeof File === 'undefined') return blob;
    return new File([blob], `${stem}.jpg`, {
      type: 'image/jpeg',
      lastModified: Number(file.lastModified || Date.now()),
    });
  } catch {
    return file;
  } finally {
    source?.close?.();
  }
}
