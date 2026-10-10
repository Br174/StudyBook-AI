import { useEffect, useMemo, useRef, useState } from 'react';
import { detectChaptersFromPages, readSourceFile } from './lib/documentParserV11.js';
import { buildStudyBook, refineParagraphWithAi, summaryLevels } from './lib/studyEngineV10.js';
import { exportDocx, exportEpub, exportHtml, exportJson, exportMarkdown, exportOdt, exportPdf, exportRtf, exportTxt, printStudyBook } from './lib/exporters.js';
import {
  createLibraryId,
  deleteLibraryBook,
  deleteLibraryVersion,
  ensureDefaultProfile,
  getLibraryBook,
  listLibraryBooks,
  listProfiles,
  saveLibraryBook,
  saveProfile,
  updateLibraryMetadata,
} from './lib/library.js';
import { loadAccessibility, saveAccessibility } from './lib/accessibility.js';
import { BottomNav, HomeScreen, LibraryScreen, OriginalBookScreen, SettingsScreen, StudioScreen } from './components/AppScreens.jsx';
import StudyMode from './components/StudyMode.jsx';
import { deliverBlob } from './lib/fileDelivery.js';
import {
  clearScannerSessionStore,
  saveCapturedScannerPage,
  listArchivedScannerPages,
  getArchivedScannerPages,
  deleteArchivedScannerPages,
  updateArchivedScannerText,
  archiveScannerSessionPages,
  renameArchivedCollection,
  renameArchivedPhoto,
  deleteScannerPage as deleteScannerPageRecord,
  loadScannerSession,
  saveScannerMeta,
  saveScannerPage as saveScannerPageRecord,
} from './lib/scannerSessionStore.js';
import { compressScannerImage, estimateScannerStorage, formatStorageBytes, requestScannerPersistence } from './lib/scannerStorage.js';
import { recognizeScannerImage, releaseScannerOcr } from './lib/scannerOcrRuntime.js';
import ScannerArchive from './components/ScannerArchive.jsx';
import { isGenericTitle, sanitizeTitle, suggestDocumentTitle } from './lib/smartTitles.js';
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
  const scanSessionNameRef = useRef('Appunti fotografati');
  const scanTitleManualRef = useRef(false);
  const scanAutoTitleConfidenceRef = useRef(0);
  const [scannerResultReady, setScannerResultReady] = useState(false);
  const [scannerStoreReady, setScannerStoreReady] = useState(false);
  const [scannerStorageInfo, setScannerStorageInfo] = useState(null);
  const [scannerOptimizing, setScannerOptimizing] = useState(false);
  const [archivedScans, setArchivedScans] = useState([]);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryId, setLibraryId] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryInitialView, setLibraryInitialView] = useState('all');
  const [originalRecord, setOriginalRecord] = useState(null);
  const [originalReading, setOriginalReading] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraFileInputRef = useRef(null);
  const documentFileInputRef = useRef(null);
  const scanPagesRef = useRef([]);
  const scanPersistTimersRef = useRef(new Map());
  const scanOcrQueueRef = useRef([]);
  const scanOcrRunningRef = useRef(false);
  const scanOcrCancelledRef = useRef(new Set());
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
    if (activeScreen === 'original' && originalReading) {
      setOriginalReading(false);
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
      if (page.status === 'ready' || page.status === 'error') void updateArchivedScannerText(page, scanSessionName);
      void refreshScannerStorage();
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
        // LAB11: migra anche le fotografie ancora presenti nella raccolta LAB10.
        const migrated = await archiveScannerSessionPages(restored.pages, restored.name);
        const restoredPages = restored.pages.map((page) => ({
          ...page,
          archiveId: page.archiveId || (migrated ? page.id : null),
          previewUrl: URL.createObjectURL(page.file),
        }));
        // Segna anche nell'archivio della sessione le fotografie già migrate:
        // una successiva eliminazione da Scannerizzati non dovrà farle ricomparire.
        if (migrated) await Promise.all(restoredPages.filter(p=>p.archiveId && !restored.pages.find(r=>r.id===p.id)?.archiveId).map(page=>saveScannerPageRecord(page)));
        scanPagesRef.current = restoredPages;
        setScanPages(restoredPages);
        setScanSessionName(restored.name || 'Appunti fotografati');
        scanSessionNameRef.current = restored.name || 'Appunti fotografati';
        scanTitleManualRef.current = !isGenericTitle(restored.name);
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
    void releaseScannerOcr();
  }, []);

  async function refreshLibrary(profileId = activeProfileId) {
    try { setLibraryItems(await listLibraryBooks({ profileId })); } catch { setLibraryItems([]); }
  }

  /* LAB12: il nome del libro è un metadato. Non modifica immagini, struttura o testi. */
  async function renameLibraryBook(id, title) {
    const clean = sanitizeTitle(title);
    if (!id || !clean || libraryBusy) return false;
    setLibraryBusy(true);
    try {
      const record = await updateLibraryMetadata(id,{fileName:clean});
      if (libraryId === id) setFileName(record.fileName);
      await refreshLibrary();
      setStatus(`Libro rinominato: ${clean}`);
      return true;
    } catch (err) { setError(err.message || 'Rinomina libro non riuscita.'); return false; }
    finally { setLibraryBusy(false); }
  }

  async function renameCurrentBook(title) {
    if (!libraryId) { setError('Salva prima il libro nella Libreria.'); return false; }
    return renameLibraryBook(libraryId,title);
  }

  async function renameScannerArchiveCollection(ids, title) {
    const clean = sanitizeTitle(title);
    if (!clean || archiveBusy) return false;
    setArchiveBusy(true);
    try {
      const ok = await renameArchivedCollection(ids,clean,{manual:true});
      if (!ok) throw new Error('Rinomina raccolta non riuscita.');
      setArchivedScans(await listArchivedScannerPages());
      if(scanPagesRef.current.some(page=>ids.includes(page.archiveId || page.id))) {
        scanTitleManualRef.current=true;
        scanSessionNameRef.current=clean;
        setScanSessionName(clean);
      }
      setStatus(`Raccolta rinominata: ${clean}`);
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setArchiveBusy(false); }
  }

  async function renameScannerArchivePhoto(id, title) {
    const clean = sanitizeTitle(title);
    if (!clean || archiveBusy) return false;
    setArchiveBusy(true);
    try {
      const ok = await renameArchivedPhoto(id,clean);
      if (!ok) throw new Error('Rinomina fotografia non riuscita.');
      setArchivedScans(await listArchivedScannerPages());
      setStatus(`Fotografia rinominata: ${clean}`);
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setArchiveBusy(false); }
  }

  async function saveCurrentScannerName(name,{manual=true}={}) {
    const clean=sanitizeTitle(name) || 'Appunti fotografati';
    const ids=scanPagesRef.current.map(p=>p.archiveId || p.id).filter(Boolean);
    const success=ids.length?await renameArchivedCollection(ids,clean,{manual}):true;
    if(!success) { setError('Nome raccolta non salvato nell’archivio.'); return false; }
    scanSessionNameRef.current=clean;
    if(manual) scanTitleManualRef.current=true;
    setScanSessionName(clean);
    return true;
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
        setOriginalRecord(record);
        setOriginalReading(false);
        setStatus('Versione originale pronta · nessuna modifica');
        navigateTo('original');
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

  async function removeLibraryItem(id, view = 'all') {
    if (libraryBusy) return false;
    setLibraryBusy(true);
    try {
      if (view === 'original' || view === 'processed') await deleteLibraryVersion(id, view);
      else await deleteLibraryBook(id);
      if (libraryId === id && view !== 'original') {
        setLibraryId('');
        setStudyBook(null);
        setDocumentData(null);
        setSourceFile(null);
        setFileName('');
        setStudyModeOpen(false);
      }
      await refreshLibrary(activeProfileId);
      if (originalRecord?.id === id && view !== 'processed') { setOriginalRecord(null); setOriginalReading(false); }
      setStatus(view === 'all' ? 'Libro eliminato definitivamente dalla Libreria' : 'Versione eliminata · altre versioni conservate');
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
      // LAB13: conservazione anticipata del file esatto prima di OCR/rielaborazione.
      // Un errore del parser non deve far perdere il documento originale importato.
      const originalSaved = await saveLibraryBook({
        id: createLibraryId(), fileName: file.name, profileId: activeProfileId, originalFile: file,
      });
      setLibraryId(originalSaved.id);
      await refreshLibrary(activeProfileId);
      const parsed = await readSourceFile(file, {
        autoOcr: true,
        onProgress(update) { setStatus(importStatus(update)); },
      });
      setDocumentData(parsed);
      await saveLibraryBook({
        id: originalSaved.id, fileName: file.name, profileId: activeProfileId,
        originalFile: file, sourceData: parsed,
      });
      await refreshLibrary(activeProfileId);
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
      // LAB12: il titolo finale considera l'intero documento elaborato; non sostituisce mai il nome manuale.
      const suggestedFinal = fromScanner && !scanTitleManualRef.current
        ? suggestDocumentTitle(sourceData.pages || [], result.chapters || []) : null;
      const nameToSave = suggestedFinal?.title
        ? `${sanitizeTitle(suggestedFinal.title)}.pdf` : sourceName;
      setFileName(nameToSave);
      const saved = await persistBook(result, sourceData, nameToSave, libraryId);
      setScannerResultReady(fromScanner);
      if (fromScanner && saved) {
        scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
        scanPersistTimersRef.current.clear();
        // Foto salvate indipendentemente dal libro: non svuotare la raccolta se l'archivio fallisce.
        const archived = await archiveScannerSessionPages(scanPagesRef.current, scanSessionName);
        if (archived) {
          scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
          scanPersistTimersRef.current.clear();
          scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
          setScanPagesNow([]);
          await clearScannerSessionStore();
          // Nuovo libro = nuova raccolta. Il titolo automatico non eredita il nome precedente.
          scanSessionNameRef.current='Appunti fotografati';
          scanTitleManualRef.current=false;
          scanAutoTitleConfidenceRef.current=0;
          setScanSessionName('Appunti fotografati');
        } else setError('Libro creato, ma il salvataggio delle foto non è confermato: raccolta scanner conservata.');
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
    if (importing || generating || scannerOptimizing) return;
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

  /* LAB11: OCR in una coda seriale con motore ita+eng persistente.
     L'acquisizione delle altre fotografie non attende questa coda. */
  function recognizeScanPage(id, file, pageNumber) {
    if (!id || !file || scanOcrQueueRef.current.some(job => job.id === id)) return;
    scanOcrCancelledRef.current.delete(id);
    scanOcrQueueRef.current.push({ id, file, pageNumber });
    patchScanPage(id, { status: 'processing', error: '' });
    void drainScanOcrQueue();
  }

  async function drainScanOcrQueue() {
    if (scanOcrRunningRef.current) return;
    scanOcrRunningRef.current = true;
    setScanProcessing(true);
    try {
      while (scanOcrQueueRef.current.length) {
        const job = scanOcrQueueRef.current.shift();
        if (!job || scanOcrCancelledRef.current.has(job.id)) continue;
        if (!scanPagesRef.current.some(page => page.id === job.id)) continue;
        const start = performance.now();
        let lastPercent = -10;
        try {
          const text = await recognizeScannerImage(job.file, fraction => {
            const percent = Math.round(fraction*100);
            if (percent < 100 && percent - lastPercent < 10) return; // Evita re-render inutili
            lastPercent = percent;
            setStatus(`Pagina ${job.pageNumber} · OCR ${percent}% · ${scanOcrQueueRef.current.length} in coda`);
          });
          if (scanOcrCancelledRef.current.has(job.id) || !scanPagesRef.current.some(p=>p.id===job.id)) continue;
          patchScanPage(job.id, { status: 'ready', text, error: '', ocrMs: Math.round(performance.now()-start) });
          const updated = scanPagesRef.current.find(page=>page.id===job.id);
          if (updated) void updateArchivedScannerText(updated, scanSessionNameRef.current);
          // LAB12: suggerimento incrementale dopo l'OCR, mai al posto di un nome manuale.
          if (!scanTitleManualRef.current) {
            const suggested = suggestDocumentTitle(scanPagesRef.current.filter(p=>p.status==='ready').map(p=>({text:p.text})));
            if (suggested && suggested.confidence > scanAutoTitleConfidenceRef.current + .015) {
              const ids=scanPagesRef.current.map(p=>p.archiveId||p.id).filter(Boolean);
              const saved=await renameArchivedCollection(ids,suggested.title,{manual:false});
              if (saved) {
                scanAutoTitleConfidenceRef.current=suggested.confidence;
                scanSessionNameRef.current=suggested.title;
                setScanSessionName(suggested.title);
              }
            }
          }
          setStatus(`Pagina ${job.pageNumber} pronta · OCR ${((performance.now()-start)/1000).toFixed(1)} s · ${scanOcrQueueRef.current.length} in coda`);
        } catch(err) {
          if (scanOcrCancelledRef.current.has(job.id) || !scanPagesRef.current.some(p=>p.id===job.id)) continue;
          patchScanPage(job.id, { status: 'error', error: err.message || 'OCR non riuscito. Riprova la foto.' });
          const updated = scanPagesRef.current.find(page=>page.id===job.id);
          if (updated) void updateArchivedScannerText(updated, scanSessionName);
          setStatus(`Pagina ${job.pageNumber} da rifare · ${scanOcrQueueRef.current.length} in coda`);
        }
      }
    } finally {
      scanOcrRunningRef.current = false;
      setScanProcessing(false);
      if (scanOcrQueueRef.current.length) void drainScanOcrQueue();
    }
  }

  async function addScanPage(file, { precompressed = false } = {}) {
    if (!file || scannerOptimizing) return;
    setScannerOptimizing(true);
    setError('');
    try {
      setStatus('Ottimizzo la foto per OCR e spazio locale…');
      if (!scanPagesRef.current.length) requestScannerPersistence();
      const acquisitionStart = performance.now();
      const optimizedFile = precompressed ? file : await compressScannerImage(file);
      const storage = await refreshScannerStorage(optimizedFile.size * 2);
      if (storage?.risk === 'blocked') {
        throw new Error('Spazio locale insufficiente per aggiungere un’altra pagina in sicurezza. Completa o svuota la raccolta prima di continuare.');
      }

      const id = scanId();
      const pageNumber = scanPagesRef.current.length + 1;
      const previewUrl = URL.createObjectURL(optimizedFile);
      const page = {
        id,
        archiveId: id, // LAB11: marca la foto gia' salvata permanentemente, evita riesumazioni dopo eliminazione
        file: optimizedFile,
        previewUrl,
        status: 'processing',
        text: '',
        error: '',
        originalBytes: Number(file.size || optimizedFile.size || 0),
        storedBytes: Number(optimizedFile.size || 0),
        optimized: Number(optimizedFile.size || 0) < Number(file.size || 0) * 0.98,
        captureMs: Math.round(performance.now() - acquisitionStart),
      };
      // Salvataggio atomico PRIMA dell'OCR: foto disponibile in Scannerizzati.
      const stored = await saveCapturedScannerPage(page, scanSessionName);
      if (!stored) { URL.revokeObjectURL(previewUrl); throw new Error('Impossibile salvare la fotografia sul telefono.'); }
      setScannerResultReady(false);
      setScanPagesNow((pages) => [...pages, page]);
      recognizeScanPage(id, optimizedFile, pageNumber);
      setStatus(`Pagina ${pageNumber} acquisita in ${((performance.now()-acquisitionStart)/1000).toFixed(1)} s · OCR in background`);
      void refreshScannerStorage();
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
      await addScanPage(file, { precompressed: true });
      // Lo scanner resta aperto e pronto per la fotografia successiva.
    } catch (err) {
      setError(err.message || 'Errore durante lo scatto.');
    } finally {
      setCameraCapturing(false);
    }
  }

  async function handleCameraFallback(event) {
    const file = event.target.files?.[0];
    if (file) await addScanPage(file);
    event.target.value = '';
  }

  function moveScanPage(index, direction) {
    if (generating) return;
    setScanPagesNow((pages) => {
      const target = index + direction;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeScanPage(id) {
    if (generating) return;
    scanOcrCancelledRef.current.add(id);
    scanOcrQueueRef.current = scanOcrQueueRef.current.filter(job => job.id !== id);
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
    const fullSuggestion=suggestDocumentTitle(pages,chapters);
    const chosen = scanTitleManualRef.current ? scanSessionNameRef.current
      : (fullSuggestion?.title || scanSessionNameRef.current || 'Scansione libro');
    const sourceName = `${sanitizeTitle(chosen) || 'Scansione libro'}.pdf`;
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
    scanOcrQueueRef.current = [];
    scanPagesRef.current.forEach((page) => { scanOcrCancelledRef.current.add(page.id); if (page.previewUrl) URL.revokeObjectURL(page.previewUrl); });
    setScanPagesNow([]);
    clearScannerSessionStore().finally(() => refreshScannerStorage());
    setScannerResultReady(false);
    setStatus('Raccolta scansioni svuotata');
  }

  /* LAB11: archivio Scannerizzati separato dai file temporanei della sessione. */
  async function openScannerArchive() {
    setArchiveBusy(true);
    setError('');
    try {
      const entries = await listArchivedScannerPages();
      setArchivedScans(entries);
      navigateTo('scans');
    } catch (err) { setError(err.message || 'Impossibile aprire Scannerizzati.'); }
    finally { setArchiveBusy(false); }
  }

  async function deleteScannerArchiveSelection(ids) {
    if (!ids.length || archiveBusy) return false;
    setArchiveBusy(true);
    try {
      const ok = await deleteArchivedScannerPages(ids);
      if (!ok) throw new Error('Archivio non modificato: eliminazione non riuscita.');
      setArchivedScans(await listArchivedScannerPages());
      setStatus(`${ids.length} fotografie eliminate definitivamente dall’archivio`);
      return true;
    } catch(err) { setError(err.message); return false; }
    finally { setArchiveBusy(false); }
  }

  async function restoreScannerArchiveSelection(ids) {
    if (!ids.length || archiveBusy || generating || importing || scannerOptimizing) return false;
    setArchiveBusy(true);
    setError('');
    const prepared = [];
    const writtenIds = [];
    try {
      const entries = await getArchivedScannerPages(ids);
      if (entries.length !== ids.length) throw new Error('Alcune fotografie non sono più presenti nell’archivio.');
      if (!scanPagesRef.current.length) {
        void requestScannerPersistence();
        const restoredCollection=entries[0]?.collection;
        if(restoredCollection && entries.every(p=>p.collection===restoredCollection)) {
          scanSessionNameRef.current=restoredCollection;
          setScanSessionName(restoredCollection);
          scanTitleManualRef.current=entries.some(p=>p.collectionManual)||!isGenericTitle(restoredCollection);
          scanAutoTitleConfidenceRef.current=0;
        }
      }
      for (const entry of entries) {
        const file = new File([entry.blob], entry.fileName || scanFileName(), {
          type: entry.fileType || entry.blob.type || 'image/jpeg',
          lastModified: Number(entry.lastModified || Date.now()),
        });
        prepared.push({
          id: scanId(), archiveId: entry.id, file,
          previewUrl: URL.createObjectURL(file),
          status: entry.text?.trim() ? 'ready' : 'processing',
          text: String(entry.text || ''), error: '',
          originalBytes: Number(entry.originalBytes || file.size),
          storedBytes: Number(file.size), optimized: Boolean(entry.optimized),
        });
      }
      // Nessuna immagine viene tolta dall'archivio. Il testo OCR pronto si riutilizza.
      for (const page of prepared) {
        const ok = await saveCapturedScannerPage(page, scanSessionName, { archive: false });
        if (!ok) throw new Error('Salvataggio delle fotografie recuperate non riuscito.');
        writtenIds.push(page.id);
      }
      setScanPagesNow(pages => [...pages, ...prepared]);
      setDocumentData(null);
      setScannerResultReady(false);
      for (const page of prepared) if (!page.text.trim()) {
        recognizeScanPage(page.id, page.file, scanPagesRef.current.findIndex(p => p.id === page.id) + 1);
      }
      setStatus(`${prepared.length} fotografie recuperate · ${prepared.filter(p=>p.text.trim()).length} OCR riutilizzati`);
      goHome();
      return true;
    } catch(err) {
      for (const id of writtenIds) await deleteScannerPageRecord(id);
      for (const page of prepared) URL.revokeObjectURL(page.previewUrl);
      setError(err.message || 'Ripresa delle fotografie non riuscita.');
      return false;
    } finally { setArchiveBusy(false); }
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

  function openOriginalLibrary() {
    setLibraryInitialView('original');
    navigateTo('library');
  }

  async function refreshArchiveForLibrary() {
    setArchiveBusy(true);
    try { setArchivedScans(await listArchivedScannerPages()); }
    catch (err) { setError(err.message || 'Archivio scansioni non disponibile.'); }
    finally { setArchiveBusy(false); }
  }

  async function openOriginalNative() {
    if (!originalRecord?.originalFile) { setError('File originale non disponibile.'); return; }
    try {
      await deliverBlob(originalRecord.originalFile, originalRecord.original?.name || originalRecord.fileName, 'Apri il file originale', { preferOpen: true });
    } catch (err) { setError(err.message || 'Non riesco ad aprire il file.'); }
  }

  async function exportOriginal(format) {
    const record = originalRecord;
    if (!record?.originalFile) { setError('File originale non disponibile.'); return; }
    try {
      const name = record.original?.name || record.originalFile?.name || record.fileName;
      if (format === 'original') {
        await deliverBlob(record.originalFile, name, 'Esporta versione originale');
        return;
      }
      if (!record.sourceData?.chapters?.length) throw new Error('Conversione indisponibile: non è stato possibile leggere il testo originale.');
      // Adatta esclusivamente una copia in memoria, mai il blob o il record originale.
      const sourceBook = {
        chapters: record.sourceData.chapters.map(chapter => ({
          title: chapter.title,
          paragraphs: (chapter.paragraphs || []).map(paragraph => {
            const value = typeof paragraph === 'string' ? paragraph : String(paragraph?.original || paragraph?.text || '');
            return { original: value, summary: value, dsaSummary: value, simpleSummary: value, glossary: [] };
          }),
        })),
      };
      const outputName = name.replace(/\.[^.]+$/, '') + '_originale';
      if (format === 'pdf') await exportPdf(sourceBook, outputName, false);
      else if (format === 'docx') await exportDocx(sourceBook, outputName, false);
      else if (format === 'epub') await exportEpub(sourceBook, outputName, false);
      else if (format === 'html') await exportHtml(sourceBook, outputName, false);
      else if (format === 'txt') {
        const text = sourceBook.chapters.map(chapter => [chapter.title, ...chapter.paragraphs.map(p => p.original)].join('\n\n')).join('\n\n');
        await deliverBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), outputName + '.txt', 'Esporta testo originale');
      }
      setStatus('Copia convertita dal testo originale · file originale invariato');
    } catch (err) { setError(err.message || 'Esportazione originale non riuscita.'); }
  }

  function openFromLibrary(item, view = 'processed') {
    return openLibraryItem(item.id, { original: view === 'original', openReader: view !== 'original' });
  }

  function openFromLibraryCover(item, view = 'processed') {
    // LAB08: nella Libreria gli Elaborati aprono la pagina completa «Libro aperto».
    // Gli Originali mantengono la consegna al lettore esterno già prevista.
    return openLibraryItem(item.id, { original: view === 'original', openReader: false });
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
        <label className="scan-name-field">Nome raccolta
          <input value={scanSessionName} onChange={(event)=>{ scanTitleManualRef.current=true; scanSessionNameRef.current=event.target.value; setScanSessionName(event.target.value); }} onBlur={()=>{ if(scanTitleManualRef.current) void saveCurrentScannerName(scanSessionName); }} maxLength={90} />
          {scanPages.length>0 && suggestDocumentTitle(scanPages.filter(p=>p.text).map(p=>({text:p.text}))) && (
            <button className="sb-smart-title-choice" type="button" onClick={()=>void saveCurrentScannerName(suggestDocumentTitle(scanPages.filter(p=>p.text).map(p=>({text:p.text}))).title,{manual:true})}>✦ Usa titolo suggerito</button>
          )}
        </label>
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
            <div className="scan-thumb-wrap"><img className="scan-thumb" src={page.previewUrl} alt={`Pagina ${index + 1}`} loading="lazy" decoding="async" /><span className="scan-page-number">{index + 1}</span></div>
            <div className="scan-page-body">
              <div className="scan-page-title"><strong>Pagina {index + 1}</strong><span className={`scan-status ${page.status}`}>{page.status === 'ready' ? 'Pronta' : page.status === 'error' ? 'Da rifare' : 'OCR…'}</span></div>
              {page.status === 'ready' && <details className="scan-text-preview"><summary>Controlla testo OCR</summary><textarea value={page.text} onChange={(event) => patchScanPage(page.id, { text: event.target.value }, { persistDelay: 600 })} /></details>}
              {page.status === 'error' && <div className="scan-page-error">{page.error}</div>}
              <div className="scan-page-actions">
                <button type="button" onClick={() => moveScanPage(index, -1)} disabled={index === 0 || generating}>↑</button>
                <button type="button" onClick={() => moveScanPage(index, 1)} disabled={index === scanPages.length - 1 || generating}>↓</button>
                {page.status === 'error' && <button type="button" onClick={() => recognizeScanPage(page.id, page.file, index + 1)} disabled={scanProcessing}>Riprova OCR</button>}
                <button type="button" className="danger-link" onClick={() => removeScanPage(page.id)} disabled={scanProcessing}>Elimina</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="scan-basket-actions">
        <button type="button" className="secondary-button" onClick={clearScanSession} disabled={scanProcessing || generating}>Svuota</button>
        <button type="button" className="scanner-button" onClick={openScanner} disabled={generating || scannerOptimizing}>📷 Aggiungi pagina</button>
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
          onImport={() => documentFileInputRef.current?.click()} onScanner={openScanner} onScannerArchive={openScannerArchive} onOpenOriginals={openOriginalLibrary} onOpenBook={openFromLibrary} onContinueBook={openContinueBook}
          documentData={documentData} fileName={fileName} onCreateBook={generateBook} progressPercent={progressPercent}
          scanContent={scannerPanel}
        />
      )}

      {activeScreen === 'scans' && <ScannerArchive entries={archivedScans} busy={archiveBusy} onBack={goBack} onRestore={restoreScannerArchiveSelection} onDelete={deleteScannerArchiveSelection} onRenameCollection={renameScannerArchiveCollection} onRenamePhoto={renameScannerArchivePhoto} />}

      {activeScreen === 'library' && <LibraryScreen items={libraryItems} initialView={libraryInitialView} onOpenBook={openFromLibraryCover} onDeleteBook={removeLibraryItem} onRenameBook={renameLibraryBook} onRefreshScans={refreshArchiveForLibrary}
        scannerProps={{ entries: archivedScans, busy: archiveBusy, onRestore: restoreScannerArchiveSelection, onDelete: deleteScannerArchiveSelection, onRenameCollection: renameScannerArchiveCollection, onRenamePhoto: renameScannerArchivePhoto }} />}
      {activeScreen === 'original' && <OriginalBookScreen record={originalRecord} reading={originalReading}
        onRead={() => setOriginalReading(reading => !reading)} onCloseRead={() => setOriginalReading(false)}
        onOpenNative={openOriginalNative} onExport={exportOriginal} accessibility={accessibility} />}

      {activeScreen === 'studio' && (
        <StudioScreen
          studyBook={studyBook} fileName={fileName} onRenameBook={renameCurrentBook}
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

      <BottomNav active={activeScreen === 'settings' || activeScreen === 'scans' ? 'home' : activeScreen === 'original' ? 'library' : activeScreen} onChange={screen => { if (screen === 'library') setLibraryInitialView('all'); navigateTo(screen); }} />
      <input ref={cameraFileInputRef} className="camera-fallback-input" type="file" accept="image/*" capture="environment" onChange={handleCameraFallback} />

      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Scanner pagina">
          <div className="camera-sheet">
            <div className="camera-header"><div><span className="eyebrow">SCANNER · PAGINA {scanPages.length + 1}</span><h2>Fotografa la pagina</h2></div><button type="button" className="camera-close" onClick={stopCamera}>×</button></div>
            <div className="camera-stage"><video ref={videoRef} playsInline muted onLoadedMetadata={() => setCameraReady(true)} /><div className="scan-frame" aria-hidden="true" /></div>
            <p className="camera-help">Scatta più pagine di seguito: l’OCR procede mentre fotografi. Le immagini rimangono nell’archivio Scannerizzati.</p>
            <div className="camera-actions"><button type="button" className="secondary-button" onClick={stopCamera}>Fine foto</button><button type="button" className="capture-button" onClick={capturePhoto} disabled={!cameraReady || cameraCapturing}>{cameraCapturing ? 'Acquisizione…' : 'Scatta pagina'}</button></div>
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
