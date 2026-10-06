import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileViewer } from '@capacitor/file-viewer';

function safeFileName(value = 'StudyBook') {
  return String(value || 'StudyBook').replace(/[\\/:*?"<>|]+/g, '_');
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const size = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += size) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + size));
  }
  return btoa(binary);
}

function webDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function deliverBlob(blob, fileName, title = 'Esporta da StudyBook AI', { preferOpen = false } = {}) {
  const name = safeFileName(fileName);
  if (!Capacitor.isNativePlatform()) {
    webDownload(blob, name);
    return { native: false, fileName: name };
  }

  const data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: name,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  if (preferOpen) {
    const candidates = [written.uri, String(written.uri || '').replace(/^file:\/\//, '')].filter(Boolean);
    for (const path of [...new Set(candidates)]) {
      try {
        await FileViewer.openDocumentFromLocalPath({ path });
        return { native: true, fileName: name, uri: written.uri, opened: true };
      } catch {
        // Prova la forma alternativa del percorso; poi fallback al pannello Android.
      }
    }
  }

  await Share.share({
    title,
    text: 'File creato con StudyBook AI',
    url: written.uri,
    dialogTitle: 'Salva o condividi',
  });
  return { native: true, fileName: name, uri: written.uri, opened: false };
}
