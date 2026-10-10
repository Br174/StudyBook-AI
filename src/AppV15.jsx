import { useEffect, useMemo, useRef, useState } from 'react';
import { detectChaptersFromPages, readSourceFile } from './lib/documentParserV11.js';
import { buildStudyBook, refineParagraphWithAi, summaryLevels } from './lib/studyEngineV10.js';
import { exportDocx, exportEpub, exportHtml, exportJson, exportMarkdown, exportOdt, exportPdf, exportRtf, exportTxt, printStudyBook } from './lib/exporters.js';
import {
  createLibraryId,
  deleteLibraryBook,
  ensureDefaultProfile,
  getLibraryBook,
  listLibraryBooks,
  listProfiles,
  saveLibraryBook,
  saveProfile,
} from './lib/library.js';
import { loadAccessibility, saveAccessibility } from './lib/accessibility.js';
import { BottomNav, HomeScreen, LibraryScreen, SettingsScreen, StudioScreen } from './components/AppScreens.jsx';
import StudyMode from './components/StudyMode.jsx';
import { deliverBlob } from './lib/fileDelivery.js';
import {
  clearScannerSessionStore,
  deleteScannerPage as deleteScannerPageRecord,
  loadScannerSession,
  saveScannerMeta,
  saveScannerPage as saveScannerPageRecord,
} from './lib/scannerSessionStore.js';
import { compressScannerImage, estimateScannerStorage, formatStorageBytes, requestScannerPersistence } from './lib/scannerStorage.js';
import './v11.css';
import './scanner-storage.css';

function countParagraphs(chapters = []) {
  return chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0);
}

function importStatus(update) {
  if (!update) return 'Analisi del documento…';
  if (update.phase === 'extract') return `Lettura PDF · pagina ${update.done}/${update.total}`;
  if (update.phase === 'ocr-loading') return 'Avvio OCR per il testo fotografato/scansionato…';
  if (update.phase === 'ocr-page') return `OCR · ${update.done}/${update.total} pagine · pagina ${update.pageNumber}`;
  if (update.phase === 'ocr-recognize') return `OCR · riconoscimento ${Math.round((update.fraction || 0) * 100)}%`;
  if (update.phase === 'rich-open') return `Apertura ${update.format || 'documento'}…`;
  if (update.phase === 'rich-part') return `${update.format || 'Documento'} · sezione ${update.done}/${update.total}`;
  if (update.phase === 'complete') return 'Ricostruzione della struttura…';
  return 'Analisi del documento…';
}

function scanFileName() {
  return `pagina-${new Date().toISOString().replace(/[.:]/g, '-')}.jpg`;
}

function scanId() {
  return globalThis.crypto?.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function paragraphKey(chapterIndex, paragraphIndex) {
  return `${chapterIndex}:${paragraphIndex}`;
}

function pageRange(start, end) {
  if (!Number.isFinite(start)) return '';
  if (!Number.isFinite(end) || end === start) return `p. ${start}`;
  return `pp. ${start}–${end}`;
}

function formatLibraryDate(value) {
  try {
    return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, keywords = [] }) {
  const terms = [...new Set((keywords || []).map((item) => String(item || '').trim()).filter((item) => item.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 18);
  if (!terms.length) return <>{text}</>;

  const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  const lower = new Set(terms.map((item) => item.toLocaleLowerCase('it-IT')));
  return <>{String(text || '').split(regex).map((part, index) => lower.has(part.toLocaleLowerCase('it-IT'))
    ? <strong className="semantic-bold" key={`${part}-${index}`}>{part}</strong>
    : <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>)}</>;
}

function speakText(text) {
  const value = String(text || '').trim();
  if (!value || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = 'it-IT';
  window.speechSynthesis.speak(utterance);
}

export default function AppV14() {
  const [documentData, setDocumentData] = useState(null);
  const [studyBook, setStudyBook] = useState(null);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('Pronto');
  const [error, setError] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [level, setLevel] = useState('studio');
  const [dsaMode, setDsaMode] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sourceEditor, setSourceEditor] = useState(null);
  const [summaryEditor, setSummaryEditor] = useState(null);
  const [refiningKey, setRefiningKey] = useState('');
  const [studyModeOpen, setStudyModeOpen] = useState(false);
  const [studyEntryMode, setStudyEntryMode] = useState('reader');
  const [activeScreen, setActiveScreen] = useState('home');
  const [sourceFile, setSourceFile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [accessibility, setAccessibility] = useState(() => loadAccessibility('default'));

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraCapturing, setCameraCapturing] = useState(false);
  const [scanPages, setScanPages] = useState([]);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [scanSessionName, setScanSessionName] = useState('Appunti fotografati');
  const [scannerResultReady, setScannerResultReady] = useState(false);
  const [scannerStoreReady, setScannerStoreReady] = useState(false);
  const [scannerStorageInfo, setScannerStorageInfo] = useState(null);
  const [scannerOptimizing, setScannerOptimizing] = useState(false);

  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryId, setLibraryId] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraFileInputRef = useRef(null);
  const documentFileInputRef = useRef(null);
  const scanPagesRef = useRef([]);
  const scanPersistTimersRef = useRef(new Map());
  const scannerRestoreStartedRef = useRef(false);
  const screenHistoryRef = useRef([]);

  const paragraphCount = useMemo(() => countParagraphs(documentData?.chapters), [documentData]);
  const scanReadyCount = useMemo(
    () => scanPages.filter((page) => page.status === 'ready' && page.text.trim()).length,
    [scanPages],
  );
  const scanHasErrors = useMemo(
    () => scanPages.some((page) => page.status === 'error' || (page.status === 'ready' && !page.text.trim())),
    [scanPages],
  );
  const progressPercent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  function navigateTo(nextScreen, { replace = false } = {}) {
    if (!nextScreen || nextScreen === activeScreen) return;
    if (!replace) screenHistoryRef.current.push(activeScreen);
    setActiveScreen(nextScreen);
  }

  function goBack() {
    if (studyModeOpen) {
      setStudyModeOpen(false);
      return;
    }
    const previous = screenHistoryRef.current.pop() || 'home';
    setActiveScreen(previous);
  }

  function goHome() {
    screenHistoryRef.current = [];
    setActiveScreen('home');
  }

  function setScanPagesNow(updater) {
    const current = scanPagesRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    scanPagesRef.current = next;
    setScanPages(next);
    return next;
  }

  async function refreshScannerStorage(extraBytes = 0) {
    const info = await estimateScannerStorage(extraBytes);
    setScannerStorageInfo(info);
    return info;
  }

  function scheduleScannerPageSave(page, delay = 0) {
    if (!page?.id || !page?.file) return;
    const timers = scanPersistTimersRef.current;
    const previous = timers.get(page.id);
    if (previous) clearTimeout(previous);

    const persist = async () => {
      timers.delete(page.id);
      await saveScannerPageRecord(page);
      refreshScannerStorage();
    };

    if (delay > 0) timers.set(page.id, setTimeout(persist, delay));
    else persist();
  }

  useEffect(() => { scanPagesRef.current = scanPages; }, [scanPages]);
  useEffect(() => {
    (async () => {
      try {
        await ensureDefaultProfile();
        setProfiles(await listProfiles());
      } catch { setProfiles([{ id: 'default', name: 'Bruno' }]); }
      await refreshLibrary('default');
      refreshScannerStorage();
    })();
  }, []);
  useEffect(() => {
    setAccessibility(loadAccessibility(activeProfileId));
    refreshLibrary(activeProfileId);
  }, [activeProfileId]);
  useEffect(() => {
    if (scannerRestoreStartedRef.current) return undefined;
    scannerRestoreStartedRef.current = true;
    let cancelled = false;

    (async () => {
      const restored = await loadScannerSession();
      if (cancelled) return;
      if (restored?.pages?.length) {
        const restoredPages = restored.pages.map((page) => ({
          ...page,
          previewUrl: URL.createObjectURL(page.file),
        }));
        scanPagesRef.current = restoredPages;
        setScanPages(restoredPages);
        setScanSessionName(restored.name || 'Appunti fotografati');
        const interrupted = restoredPages.filter((page) => page.status === 'error').length;
        setStatus(`Raccolta scanner ripristinata · ${restoredPages.length} pagine${interrupted ? ` · ${interrupted} da riprendere` : ''}`);
      }
      setScannerStoreReady(true);
    })();

    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!scannerStoreReady) return undefined;
    const timer = setTimeout(() => {
      if (scanPages.length) saveScannerMeta(scanSessionName, scanPages);
      else clearScannerSessionStore();
    }, 250);
    return () => clearTimeout(timer);
  }, [scannerStoreReady, scanSessionName, scanPages]);
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
    scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
  }, []);

  async function refreshLibrary(profileId = activeProfileId) {
    try { setLibraryItems(await listLibraryBooks({ profileId })); } catch { setLibraryItems([]); }
  }

  function updateAccessibility(next) {
    setAccessibility(saveAccessibility(activeProfileId, next));
  }

  async function addProfile(name) {
    try {
      const profile = await saveProfile({ name });
      setProfiles(await listProfiles());
      setActiveProfileId(profile.id);
      setStatus(`Profilo ${profile.name} creato`);
    } catch (err) {
      setError(err.message || 'Non riesco a creare il profilo.');
    }
  }

  async function persistBook(nextBook, nextSource = documentData, nextName = fileName, forcedId = libraryId) {
    if (!nextBook || !nextSource) return null;
    try {
      const record = await saveLibraryBook({
        id: forcedId || createLibraryId(),
        fileName: nextName,
        sourceData: nextSource,
        studyBook: nextBook,
        dsaMode,
        profileId: activeProfileId,
        originalFile: sourceFile,
      });
      setLibraryId(record.id);
      await refreshLibrary();
      return record;
    } catch (err) {
      setError(err.message || 'Non riesco a salvare questo libro nella Libreria locale.');
      return null;
    }
  }

  async function openLibraryItem(id, { original = false, openReader = false } = {}) {
    if (libraryBusy || generating || importing) return;
    setLibraryBusy(true);
    setError('');
    try {
      const record = await getLibraryBook(id);
      if (!record) throw new Error('Libro non disponibile.');
      if (original) {
        if (!record.originalFile) throw new Error('Il file originale non è disponibile su questo dispositivo.');
        await deliverBlob(
          record.originalFile,
          record.original?.name || record.originalFile?.name || record.fileName,
          'Apri originale con il lettore del formato',
          { preferOpen: true },
        );
        setStatus('Originale aperto con il lettore del formato');
        return;
      }
      if (!record.studyBook || !record.sourceData) throw new Error('Libro elaborato non disponibile.');
      setLibraryId(record.id);
      setFileName(record.fileName);
      setDocumentData(record.sourceData);
      setSourceFile(record.originalFile || null);
      setStudyBook(record.studyBook);
      setLevel(record.studyBook?.level || 'studio');
      setDsaMode(record.dsaMode !== false);
      setSelectedChapter(0);
      setSourceEditor(null);
      setSummaryEditor(null);
      setScannerResultReady(Boolean(record.sourceData.scanCount));
      setStatus('Libro riaperto dalla Libreria');
      navigateTo('studio');
      if (openReader) {
        setStudyEntryMode('reader');
        setStudyModeOpen(true);
      } else {
        // LAB07 • Aprendo un libro dalla Home si deve vedere l'intera pagina Libro aperto.
        setStudyModeOpen(false);
      }
    } catch (err) {
      setError(err.message || 'Impossibile aprire il libro.');
    } finally {
      setLibraryBusy(false);
    }
  }

  async function removeLibraryItem(id) {
    if (libraryBusy) return false;
    setLibraryBusy(true);
    try {
      await deleteLibraryBook(id);
      if (libraryId === id) {
        setLibraryId('');
        setStudyBook(null);
        setDocumentData(null);
        setSourceFile(null);
        setFileName('');
        setStudyModeOpen(false);
      }
      await refreshLibrary(activeProfileId);
      setStatus('Libro eliminato definitivamente dalla Libreria');
      return true;
    } catch (err) {
      setError(err.message || 'Impossibile eliminare il libro.');
      return false;
    } finally {
      setLibraryBusy(false);
    }
  }

  async function processFile(file) {
    if (!file) return;
    setError('');
    setStatus('Analisi del documento…');
    setFileName(file.name);
    setSourceFile(file);
    setLibraryId('');
    setStudyBook(null);
    setDocumentData(null);
    setScannerResultReady(false);
    setSourceEditor(null);
    setSummaryEditor(null);
    setProgress({ done: 0, total: 0 });
    setImporting(true);

    try {
      const parsed = await readSourceFile(file, {
        autoOcr: true,
        onProgress(update) { setStatus(importStatus(update)); },
      });
      setDocumentData(parsed);
      setSelectedChapter(0);
      const recovered = parsed.ocrApplied?.length || 0;
      const unresolved = parsed.needsOcr?.length || 0;
      if (unresolved) setStatus(`Documento analizzato · OCR recuperato su ${recovered} pagine · ${unresolved} da verificare`);
      else if (recovered) setStatus(`Documento analizzato · OCR completato su ${recovered} pagine`);
      else setStatus('Documento analizzato · struttura testuale pronta');
    } catch (err) {
      setError(err.message || 'Errore durante la lettura del documento.');
      setStatus('Errore');
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    await processFile(file);
    event.target.value = '';
  }

  async function createStudyBook(sourceData, sourceName, { fromScanner = false } = {}) {
    if (!sourceData || generating) return null;
    setGenerating(true);
    setDsaMode(true);
    setError('');
    setProgress({ done: 0, total: countParagraphs(sourceData.chapters) });
    setStatus(fromScanner ? 'MotorLab Runtime · scansione completa · preparo il libro…' : 'MotorLab Runtime · preparo il libro di studio…');

    try {
      const result = await buildStudyBook(sourceData, {
        level,
        preferAi: true,
        onProgress(done, total, phase, meta) {
          setProgress({ done, total });
          if (phase === 'resume') setStatus(`MotorLab Runtime · ripresa · ${done}/${total} paragrafi già pronti${meta?.cachedChunks ? ` · ${meta.cachedChunks} blocchi riusati` : ''}`);
          else if (phase === 'ai' || phase === 'misto') setStatus(`MotorLab Runtime · ${done}/${total} paragrafi · ${meta?.concurrency || 1} corridori`);
          else if (phase === 'locale') setStatus(`MotorLab Runtime · elaborazione locale · ${done}/${total} paragrafi`);
        },
      });
      setStudyBook(result);
      const saved = await persistBook(result, sourceData, sourceName, libraryId);
      setScannerResultReady(fromScanner);
      if (fromScanner && saved) {
        scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
        scanPersistTimersRef.current.clear();
        scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
        setScanPagesNow([]);
        await clearScannerSessionStore();
        await refreshScannerStorage();
      }
      const engineLabel = result.engine === 'ai' ? 'AI' : result.engine === 'misto' ? 'AI + sicurezza locale' : 'modalità locale';
      const runtime = result.quality?.motorLabRuntime;
      const speedLabel = runtime ? ` · MotorLab Runtime · ${runtime.maxConcurrencyUsed || 1} corridori${runtime.cachedChunks ? ` · ${runtime.cachedChunks} blocchi riusati` : ''}` : '';
      setStatus(`Libro pronto · ${engineLabel}${speedLabel}${saved ? ' · salvato in Libreria' : ''}`);
      navigateTo('studio');
      return result;
    } catch (err) {
      setError(err.message || 'Errore durante la creazione del libro di studio.');
      setStatus('Errore');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function generateBook() {
    await createStudyBook(documentData, fileName);
  }

  function beginSourceEdit(chapterIndex, paragraphIndex, value) {
    setSourceEditor({ key: paragraphKey(chapterIndex, paragraphIndex), chapterIndex, paragraphIndex, value });
  }

  function saveSourceEdit() {
    if (!sourceEditor?.value.trim()) return;
    const cleaned = sourceEditor.value.trim();
    const { chapterIndex, paragraphIndex } = sourceEditor;
    const chapters = documentData.chapters.map((chapter, cIndex) => cIndex !== chapterIndex ? chapter : ({
      ...chapter,
      paragraphs: chapter.paragraphs.map((paragraph, pIndex) => pIndex === paragraphIndex ? cleaned : paragraph),
    }));
    setDocumentData({ ...documentData, chapters, fullText: chapters.flatMap((chapter) => chapter.paragraphs).join('\n\n') });
    setStudyBook(null);
    setSourceEditor(null);
    setScannerResultReady(false);
    setStatus('Testo originale aggiornato · rigenera il libro per applicare la modifica');
  }

  function beginSummaryEdit(chapterIndex, paragraphIndex, paragraph) {
    const field = dsaMode ? 'dsaSummary' : 'summary';
    setSummaryEditor({
      key: paragraphKey(chapterIndex, paragraphIndex),
      chapterIndex,
      paragraphIndex,
      field,
      value: paragraph[field] || paragraph.summary || '',
    });
  }

  async function saveSummaryEdit() {
    if (!summaryEditor?.value.trim() || !studyBook) return;
    const { chapterIndex, paragraphIndex, field } = summaryEditor;
    const value = summaryEditor.value.trim();
    const next = {
      ...studyBook,
      editedAt: new Date().toISOString(),
      chapters: studyBook.chapters.map((chapter, cIndex) => cIndex !== chapterIndex ? chapter : ({
        ...chapter,
        paragraphs: chapter.paragraphs.map((paragraph, pIndex) => pIndex === paragraphIndex
          ? { ...paragraph, [field]: value, manuallyEdited: true }
          : paragraph),
      })),
    };
    setStudyBook(next);
    setSummaryEditor(null);
    await persistBook(next);
    setStatus('Paragrafo modificato · Libreria aggiornata');
  }

  async function refineParagraph(chapterIndex, paragraphIndex, paragraph) {
    const key = paragraphKey(chapterIndex, paragraphIndex);
    if (refiningKey || generating) return;
    setRefiningKey(key);
    setError('');
    setStatus(`Correzione AI approfondita · paragrafo ${paragraphIndex + 1}…`);
    try {
      const refined = await refineParagraphWithAi({
        original: paragraph.original,
        summary: paragraph.summary,
        dsaSummary: paragraph.dsaSummary,
        level,
      });
      const next = {
        ...studyBook,
        engine: studyBook.engine === 'locale' ? 'misto' : studyBook.engine,
        editedAt: new Date().toISOString(),
        chapters: studyBook.chapters.map((chapter, cIndex) => cIndex !== chapterIndex ? chapter : ({
          ...chapter,
          paragraphs: chapter.paragraphs.map((item, pIndex) => pIndex === paragraphIndex
            ? { ...item, ...refined, original: item.original, refinedAt: new Date().toISOString() }
            : item),
        })),
      };
      setStudyBook(next);
      setSummaryEditor(null);
      await persistBook(next);
      setStatus('Paragrafo ricontrollato con AI · Libreria aggiornata');
    } catch (err) {
      setError(err.message || 'Correzione AI non disponibile.');
      setStatus('Correzione AI non completata');
    } finally {
      setRefiningKey('');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraCapturing(false);
    setCameraOpen(false);
  }

  async function openScanner() {
    if (importing || generating || scanProcessing) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileInputRef.current?.click();
      return;
    }
    try {
      setStatus('Apertura scanner…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setStatus(`Scanner pronto · prossima pagina ${scanPages.length + 1}`);
    } catch {
      setStatus('Apro la fotocamera del dispositivo…');
      cameraFileInputRef.current?.click();
    }
  }

  function patchScanPage(id, patch, { persistDelay = 0 } = {}) {
    const nextPages = setScanPagesNow((pages) => pages.map((page) => page.id === id ? { ...page, ...patch } : page));
    const nextPage = nextPages.find((page) => page.id === id);
    if (nextPage) scheduleScannerPageSave(nextPage, persistDelay);
  }

  async function recognizeScanPage(id, file, pageNumber) {
    setScanProcessing(true);
    patchScanPage(id, { status: 'processing', error: '' });
    try {
      const parsed = await readSourceFile(file, {
        autoOcr: true,
        onProgress(update) {
          if (update?.phase === 'ocr-recognize') setStatus(`Pagina ${pageNumber} · OCR ${Math.round((update.fraction || 0) * 100)}%`);
        },
      });
      patchScanPage(id, { status: 'ready', parsed, text: parsed.fullText, error: '' });
      setStatus(`Pagina ${pageNumber} pronta · salvata automaticamente`);
    } catch (err) {
      patchScanPage(id, { status: 'error', error: err.message || 'Testo non riconosciuto. Riprova la foto.' });
      setStatus(`Pagina ${pageNumber} da rifare`);
    } finally {
      setScanProcessing(false);
    }
  }

  async function addScanPage(file) {
    if (!file || scanProcessing || scannerOptimizing) return;
    setScannerOptimizing(true);
    setError('');
    try {
      setStatus('Ottimizzo la foto per OCR e spazio locale…');
      if (!scanPagesRef.current.length) requestScannerPersistence();
      const optimizedFile = await compressScannerImage(file);
      const storage = await refreshScannerStorage(optimizedFile.size);
      if (storage?.risk === 'blocked') {
        throw new Error('Spazio locale insufficiente per aggiungere un’altra pagina in sicurezza. Completa o svuota la raccolta prima di continuare.');
      }

      const id = scanId();
      const pageNumber = scanPagesRef.current.length + 1;
      const previewUrl = URL.createObjectURL(optimizedFile);
      const page = {
        id,
        file: optimizedFile,
        previewUrl,
        status: 'processing',
        text: '',
        error: '',
        originalBytes: Number(file.size || optimizedFile.size || 0),
        storedBytes: Number(optimizedFile.size || 0),
        optimized: Number(optimizedFile.size || 0) < Number(file.size || 0) * 0.98,
      };
      setScannerResultReady(false);
      setScanPagesNow((pages) => [...pages, page]);
      scheduleScannerPageSave(page);
      await recognizeScanPage(id, optimizedFile, pageNumber);
      await refreshScannerStorage();
    } catch (err) {
      setError(err.message || 'Non riesco ad aggiungere questa pagina.');
      setStatus('Pagina non aggiunta');
    } finally {
      setScannerOptimizing(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || cameraCapturing) return;
    setCameraCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('Impossibile acquisire la foto.')),
        'image/jpeg',
        0.92,
      ));
      const file = new File([blob], scanFileName(), { type: 'image/jpeg' });
      canvas.width = 1;
      canvas.height = 1;
      stopCamera();
      await addScanPage(file);
    } catch (err) {
      setCameraCapturing(false);
      setError(err.message || 'Errore durante lo scatto.');
    }
  }

  async function handleCameraFallback(event) {
    const file = event.target.files?.[0];
    if (file) await addScanPage(file);
    event.target.value = '';
  }

  function moveScanPage(index, direction) {
    if (scanProcessing) return;
    setScanPagesNow((pages) => {
      const target = index + direction;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeScanPage(id) {
    if (scanProcessing || generating) return;
    const page = scanPagesRef.current.find((item) => item.id === id);
    if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
    const timer = scanPersistTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    scanPersistTimersRef.current.delete(id);
    setScanPagesNow((pages) => pages.filter((item) => item.id !== id));
    deleteScannerPageRecord(id).finally(() => refreshScannerStorage());
  }

  async function finishScanSession() {
    if (!scanPages.length || scanProcessing || generating || scanHasErrors) return;
    const pages = scanPages.map((page, index) => ({ pageNumber: index + 1, text: page.text.trim(), source: 'camera-ocr' }));
    const chapters = detectChaptersFromPages(pages);
    const sourceData = {
      fullText: pages.map((page) => page.text).join('\n\n'),
      pages,
      chapters,
      needsOcr: [],
      ocrApplied: pages.map((page) => page.pageNumber),
      scanCount: pages.length,
      sourceFormat: 'scan',
      structure: {
        pageCount: pages.length,
        chapterCount: chapters.length,
        sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
        paragraphCount: countParagraphs(chapters),
        textFirst: true,
      },
    };
    const sourceName = `${scanSessionName.trim() || 'Scansione libro'} - ${pages.length} pagine.pdf`;
    setLibraryId('');
    setFileName(sourceName);
    setDocumentData(sourceData);
    setStudyBook(null);
    setSelectedChapter(0);
    await createStudyBook(sourceData, sourceName, { fromScanner: true });
  }

  function clearScanSession() {
    if (scanProcessing || generating) return;
    scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
    scanPersistTimersRef.current.clear();
    scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
    setScanPagesNow([]);
    clearScannerSessionStore().finally(() => refreshScannerStorage());
    setScannerResultReady(false);
    setStatus('Raccolta scansioni svuotata');
  }

  const originalChapter = documentData?.chapters?.[selectedChapter];
  const generatedChapter = studyBook?.chapters?.[selectedChapter];
  const visibleChapter = generatedChapter || originalChapter;

  function metaForParagraph(paragraph, index) {
    if (studyBook) {
      return { pageStart: paragraph.sourcePageStart, pageEnd: paragraph.sourcePageEnd, section: paragraph.sourceSection };
    }
    const meta = originalChapter?.paragraphMeta?.[index];
    return { pageStart: meta?.pageStart, pageEnd: meta?.pageEnd, section: meta?.sectionTitle };
  }

  function speakChapter() {
    if (!visibleChapter) return;
    const text = generatedChapter
      ? generatedChapter.paragraphs.map((item) => dsaMode ? (item.dsaSummary || item.summary) : item.summary).join(' ')
      : originalChapter.paragraphs.join(' ');
    speakText(text);
  }

  function exportCurrentBook(format, variant = 'study') {
    if (!studyBook) return;
    const options = { dsaMode, variant, accessibility };
    if (format === 'pdf') return exportPdf(studyBook, fileName, options);
    if (format === 'docx') return exportDocx(studyBook, fileName, options);
    if (format === 'html') return exportHtml(studyBook, fileName, options);
    if (format === 'epub') return exportEpub(studyBook, fileName, options);
    if (format === 'odt') return exportOdt(studyBook, fileName, options);
    if (format === 'rtf') return exportRtf(studyBook, fileName, options);
    if (format === 'md') return exportMarkdown(studyBook, fileName, options);
    if (format === 'print') return printStudyBook(studyBook, fileName, options);
    if (format === 'json') return exportJson(studyBook, fileName);
    if (format === 'txt') {
      if (variant === 'simple') {
        const simpleBook = {
          ...studyBook,
          chapters: (studyBook.chapters || []).map((chapter) => ({
            ...chapter,
            paragraphs: (chapter.paragraphs || []).map((paragraph) => ({
              ...paragraph,
              summary: paragraph.simpleSummary || paragraph.summary,
              dsaSummary: paragraph.simpleSummary || paragraph.summary,
            })),
          })),
        };
        return exportTxt(simpleBook, fileName, false);
      }
      return exportTxt(studyBook, fileName, dsaMode);
    }
    return undefined;
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || { id: 'default', name: 'Bruno' };

  function openFromLibrary(item, view = 'processed') {
    return openLibraryItem(item.id, { original: view === 'original', openReader: view !== 'original' });
  }

  function openContinueBook(item) {
    // LAB07 • Il riquadro "Continua" carica il libro e apre l'intera StudioScreen.
    // Le copertine di Recenti e Libreria conservano la loro navigazione precedente.
    return openLibraryItem(item.id, { original: false, openReader: false });
  }

  const scannerPanel = scanPages.length > 0 ? (
    <section className="panel scan-basket sb-inline-scanner">
      <div className="scan-basket-head">
        <div><span className="eyebrow dark">SCANSIONI</span><h2>{scanPages.length} {scanPages.length === 1 ? 'pagina' : 'pagine'} · {scanReadyCount} pronte</h2><p>Le foto servono soltanto per l’OCR e non entreranno nel libro elaborato.</p></div>
        <label className="scan-name-field">Nome raccolta<input value={scanSessionName} onChange={(event) => setScanSessionName(event.target.value)} maxLength={80} /></label>
      </div>
      {scannerStorageInfo && (
        <div className={`scanner-storage-meter ${scannerStorageInfo.risk || 'unknown'}`}>
          <div className="scanner-storage-head"><strong>Protezione spazio scanner</strong><span>{scannerStorageInfo.supported && scannerStorageInfo.quota ? `${formatStorageBytes(scannerStorageInfo.usage)} / ${formatStorageBytes(scannerStorageInfo.quota)}` : 'Stima spazio non disponibile'}</span></div>
          {scannerStorageInfo.ratio != null && <div className="scanner-storage-track"><span style={{ width: `${Math.min(100, Math.max(1, Math.round(scannerStorageInfo.ratio * 100)))}%` }} /></div>}
        </div>
      )}
      <div className="scan-page-grid">
        {scanPages.map((page, index) => (
          <article className={`scan-page-card ${page.status}`} key={page.id}>
            <div className="scan-thumb-wrap"><img className="scan-thumb" src={page.previewUrl} alt={`Pagina ${index + 1}`} /><span className="scan-page-number">{index + 1}</span></div>
            <div className="scan-page-body">
              <div className="scan-page-title"><strong>Pagina {index + 1}</strong><span className={`scan-status ${page.status}`}>{page.status === 'ready' ? 'Pronta' : page.status === 'error' ? 'Da rifare' : 'OCR…'}</span></div>
              {page.status === 'ready' && <details className="scan-text-preview"><summary>Controlla testo OCR</summary><textarea value={page.text} onChange={(event) => patchScanPage(page.id, { text: event.target.value }, { persistDelay: 600 })} /></details>}
              {page.status === 'error' && <div className="scan-page-error">{page.error}</div>}
              <div className="scan-page-actions">
                <button type="button" onClick={() => moveScanPage(index, -1)} disabled={index === 0 || scanProcessing}>↑</button>
                <button type="button" onClick={() => moveScanPage(index, 1)} disabled={index === scanPages.length - 1 || scanProcessing}>↓</button>
                {page.status === 'error' && <button type="button" onClick={() => recognizeScanPage(page.id, page.file, index + 1)} disabled={scanProcessing}>Riprova OCR</button>}
                <button type="button" className="danger-link" onClick={() => removeScanPage(page.id)} disabled={scanProcessing}>Elimina</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="scan-basket-actions">
        <button type="button" className="secondary-button" onClick={clearScanSession} disabled={scanProcessing || generating}>Svuota</button>
        <button type="button" className="scanner-button" onClick={openScanner} disabled={scanProcessing || generating || scannerOptimizing}>📷 Aggiungi pagina</button>
        <button type="button" className="primary-button finish-scan-button" onClick={finishScanSession} disabled={scanProcessing || generating || scanHasErrors || scanReadyCount !== scanPages.length}>{generating ? `Elaborazione ${progressPercent}%` : 'Fine scansione · Crea libro'}</button>
      </div>
    </section>
  ) : null;

  return (
    <main className="sb-app-frame">
      <header className="sb-topbar">
        <div className="sb-topbar-left">
          {activeScreen !== 'home' && <button type="button" className="sb-back-button" onClick={goBack} aria-label="Torna indietro">←</button>}
          <button type="button" className="sb-brand" onClick={goHome}>StudyBook <b>AI</b></button>
        </div>
        <div className="sb-top-actions">
          <button type="button" onClick={() => navigateTo('settings')}>{activeProfile.name}</button>
          <button type="button" aria-label="Impostazioni" onClick={() => navigateTo('settings')}>⚙</button>
        </div>
      </header>

      <input ref={documentFileInputRef} type="file" hidden accept=".pdf,.docx,.epub,.txt,.html,.htm,.rtf,.odt,.md,.markdown,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,application/rtf,application/vnd.oasis.opendocument.text,text/plain,text/html,text/markdown,image/png,image/jpeg,image/webp" onChange={handleFile} />
      {error && <div className="error-box sb-global-error">{error}</div>}

      {activeScreen === 'home' && (
        <HomeScreen
          status={status} importing={importing} generating={generating} libraryItems={libraryItems}
          onImport={() => documentFileInputRef.current?.click()} onScanner={openScanner} onOpenBook={openFromLibrary} onContinueBook={openContinueBook}
          documentData={documentData} fileName={fileName} onCreateBook={generateBook} progressPercent={progressPercent}
          scanContent={scannerPanel}
        />
      )}

      {activeScreen === 'library' && <LibraryScreen items={libraryItems} onOpenBook={openFromLibrary} onDeleteBook={removeLibraryItem} />}

      {activeScreen === 'studio' && (
        <StudioScreen
          studyBook={studyBook} fileName={fileName}
          onRead={() => { setStudyEntryMode('reader'); setStudyModeOpen(true); }}
          onStudy={() => { setStudyEntryMode('study'); setStudyModeOpen(true); }}
          onExport={exportCurrentBook}
        />
      )}

      {activeScreen === 'settings' && (
        <SettingsScreen
          settings={accessibility} onSettingsChange={updateAccessibility}
          profiles={profiles.length ? profiles : [activeProfile]} activeProfileId={activeProfileId}
          onProfileChange={setActiveProfileId} onAddProfile={addProfile}
        />
      )}

      <BottomNav active={activeScreen === 'settings' ? 'home' : activeScreen} onChange={navigateTo} />
      <input ref={cameraFileInputRef} className="camera-fallback-input" type="file" accept="image/*" capture="environment" onChange={handleCameraFallback} />

      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Scanner pagina">
          <div className="camera-sheet">
            <div className="camera-header"><div><span className="eyebrow">SCANNER · PAGINA {scanPages.length + 1}</span><h2>Fotografa la pagina</h2></div><button type="button" className="camera-close" onClick={stopCamera}>×</button></div>
            <div className="camera-stage"><video ref={videoRef} playsInline muted onLoadedMetadata={() => setCameraReady(true)} /><div className="scan-frame" aria-hidden="true" /></div>
            <p className="camera-help">La foto serve all’OCR durante l’acquisizione. Nel libro finale salviamo il testo, non l’immagine.</p>
            <div className="camera-actions"><button type="button" className="secondary-button" onClick={stopCamera}>Annulla</button><button type="button" className="capture-button" onClick={capturePhoto} disabled={!cameraReady || cameraCapturing}>{cameraCapturing ? 'Acquisizione…' : 'Scatta pagina'}</button></div>
          </div>
        </div>
      )}

      {studyModeOpen && studyBook && (
        <StudyMode
          book={studyBook} bookTitle={fileName} initialMode={studyEntryMode}
          chapterIndex={selectedChapter} onChapterChange={setSelectedChapter}
          dsaMode={dsaMode} accessibility={accessibility} onClose={() => setStudyModeOpen(false)}
        />
      )}
    </main>
  );
}
