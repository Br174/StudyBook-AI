import { useEffect, useMemo, useRef, useState } from 'react';
import { detectChaptersFromPages, readSourceFile } from './lib/documentParserV11.js';
import { buildStudyBook, refineParagraphWithAi, summaryLevels } from './lib/studyEngineV10.js';
import { markResumeStatePublished } from './lib/resumeStore.js';
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
import { isScannerBook, coverContext, pickLocalTheme, requestAiCoverTheme, renderAICover, imageBlobToThumbnail, extractOriginalCover } from './lib/libraryCoverEngine.js';
import { generateTrueBookImage } from './lib/trueAiCover.js';
import { searchBookCoverOnWeb } from './lib/bookCoverSearch.js';
import {coverAssetIdentity,usedCoverAssets,findDuplicateWebCovers} from './lib/coverUniqueness.js';
import { BottomNav, LibraryScreen, SettingsScreen, StudioScreen } from './components/AppScreens.jsx';
import { HomeDashboardV16 } from './components/HomeDashboardV16.jsx';
import StudyMode from './components/StudyMode.jsx';
import { buildPrecisionEdition, normalizeReduction } from './lib/precisionCore.js';
import { generateGeminiEditionsV36 } from './lib/generativeEditionsV36.js';
import {EXPLAINED_REQUEST_TIMEOUT_V122,explainedProgressMessageV122,generateExplainedBookV122} from './lib/explainedGeneratorV122.js';
import {EXPLAINED_POLICY_V122} from './lib/explainedPolicyV122.js';
import {EXPLAINED_POLICY_V126} from './lib/explainedStagesV126.js';
import {generateExplainedBookV126} from './lib/explainedGeneratorV126.js';
import {buildExplainedEditionViewV122,isExplainedBookV122} from './lib/explainedViewV122.js';
import {exportExplainedPdfV122} from './lib/exportExplainedPdfV122.js';
import ExplainedReaderV122 from './components/ExplainedReaderV122.jsx';
import {rebalanceSavedStudyBookV67,canRebalanceBookV67} from './lib/studyRebalanceV67.js';
import {STUDY_PILLAR_VERSION} from './lib/studyPillarV38.js';
import {studyHomeAction,sameStoredDocument} from './lib/studyHomeFlowV38.js';
import {progressDiagnostic} from './lib/geminiRecoveryV39.js';
import { readGeminiPause, quotaDisplayV36 } from './lib/geminiQuotaControllerV36.js';
import { planStudyAutoResumeV45,autoResumeWakeDecisionV54,autoResumeNextWakeMsV54 } from './lib/studyAutoResumeV45.js';
import {requiresRecalibrationV79,hasFinishedLocalAuditV79} from './lib/studyQualityRecoveryV79.js';
import { auditBookSourceCoverage } from './lib/studyQualityGuard.js';
import { reprocessStoredBook } from './lib/libraryReprocess.js';
import { reacquireFromSavedPdf } from './lib/sourceRecoveryV34.js';
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
  if (update.phase === 'turbo-file-read') return 'PDF originale conservato · preparo la lettura e verifico lo spazio…';
  if (update.phase === 'turbo-file-hash') return update.done ? 'Impronta SHA-256 dell’originale verificata' : 'Verifico l’identità del PDF originale…';
  if (update.phase === 'mirror-figure-map') return `Libro Specchio · catalogo immagini e grafici ${update.done}/${update.total} pagine · ${update.restored||0} riprese`;
  if (update.phase === 'mirror-index-verify') return `Libro Specchio · indice ${update.chapters||0} capitoli · ${update.figures||0} riferimenti visivi · ${update.review||0} verifiche`;
  if (update.phase === 'mirror-outline-review') return 'Libro Specchio · confronto con l’indice originale richiesto';
  if (update.phase === 'turbo-inventory') return `Integrity 360 · inventario di ${update.total} pagine · ${update.blocks} blocchi logici`;
  if (update.phase === 'turbo-resume') return `Integrity 360 · ${update.resumed || 0} pagine recuperate dalla memoria`;
  if (update.phase === 'turbo-merge') return 'Integrity 360 · ricomposizione del Libro Maestro…';
  if (update.phase === 'turbo-verify') return `Integrity 360 · ${update.done}/${update.total} pagine verificate · ${update.verifiedChapters || 0} capitoli`;
  if (update.phase === 'turbo-chapter-verified') return `Capitolo verificato · ${update.title || 'Senza titolo'}`;
  if (update.phase === 'turbo-throttle') return 'Integrity 360 · regolo automaticamente la velocità per proteggere la memoria';
  if (update.phase === 'turbo-ocr-unavailable') return 'Integrity 360 · OCR non disponibile, pagine segnalate';
    if (update.phase === 'extract') return `Lettura Turbo · pagina ${update.done}/${update.total}`;
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
  const [reduction, setReduction] = useState('summary');
  const [dsaMode, setDsaMode] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // LAB46: separate physical pages from Gemini chunk/edition counters.
  const [importAcquisition,setImportAcquisition]=useState({id:null,done:0,total:0});
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sourceEditor, setSourceEditor] = useState(null);
  const [summaryEditor, setSummaryEditor] = useState(null);
  const [refiningKey, setRefiningKey] = useState('');
  const [studyModeOpen, setStudyModeOpen] = useState(false);
  const [libraryId, setLibraryId] = useState('');
  const precisionBook = useMemo(() => isExplainedBookV122(studyBook)
    ?buildExplainedEditionViewV122(studyBook):buildPrecisionEdition(studyBook,reduction),
    [studyBook,reduction]);
  function changeReduction(nextValue) {
    const next = normalizeReduction(nextValue);
    setReduction(next);
    if (libraryId) {
      try { localStorage.setItem(`studybook:precision:${libraryId}`, String(next)); } catch { /* optional preference */ }
    }
  }
  useEffect(() => {
    if (!libraryId) return;
    try { setReduction(normalizeReduction(localStorage.getItem(`studybook:precision:${libraryId}`) ?? 'summary')); }
    catch { setReduction('summary'); }
  }, [libraryId]);
  const [studyEntryMode, setStudyEntryMode] = useState('reader');
  const [activeScreen, setActiveScreen] = useState('home');
  const [sourceFile, setSourceFile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState('default');
  const [accessibility, setAccessibility] = useState(() => loadAccessibility('default'));

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraCapturing, setCameraCapturing] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [cameraFeedback, setCameraFeedback] = useState('');
  const cameraFlashTimerRef = useRef(null);
  const cameraFeedbackTimerRef = useRef(null);
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
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryInitialView, setLibraryInitialView] = useState('all');
  // LAB37: one abortable Gemini runner, one restart request, never two writers.
  const geminiAbortRef = useRef(null);
  const geminiLastActivityRef = useRef(Date.now());
  const restartRequestedRef = useRef(false);
  const resumeExecutionRef = useRef(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeCandidate, setResumeCandidate] = useState(null);
  const [workPhase,setWorkPhase] = useState('idle');
  const [geminiStalled,setGeminiStalled] = useState(false);
  const coverQueueRef = useRef(new Set());
  const coverWorkerRef = useRef(false);
  // LAB20: one optional online concept request at a time; local covers never wait.
  const coverRemoteTailRef = useRef(Promise.resolve());
  const coverAiUnavailableRef = useRef(false);
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
  const qualityAutoResumeRef = useRef({fingerprint:'',verified:-1,stalledAttempts:0});

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
  const currentIncomplete=Boolean(studyBook?.editionsV36&&studyBook.editionsV36.complete!==true&&documentData);
  const homeAction=studyHomeAction({
    generating,
    hasSource:Boolean(documentData),
    hasCurrentIncomplete:currentIncomplete||sameStoredDocument(resumeCandidate,libraryId,fileName),
    hasCurrentBook:Boolean(studyBook&&documentData),
    hasSavedIncomplete:Boolean(resumeCandidate),
  });

  // LAB46: the SAME LAB45 recovery planner owns manual and automatic resume.
  // Operates on Home, Studio and Library while the app is foreground-visible.
  // Cold-start candidate is loaded from IndexedDB, not reconstructed from UI text.
  useEffect(() => {
    const activeEdition=studyBook?.editionsV36?.complete===false?studyBook.editionsV36:null;
    if(studyBook?.editionsV36?.complete===true&&libraryId===resumeCandidate?.id)return;
    const editions=activeEdition||resumeCandidate?.edition;
    if(generating||resumeExecutionRef.current||resumeBusy||!editions||editions.complete)return;
    const currentKey=activeEdition?libraryId:resumeCandidate?.id;
    // LAB73: saving full-page drafts is actual progress even before final certification.
    const verified=(Number(editions.verifiedChunkVariants)||0)+
      (Number(editions.draftUnitsSaved)||0)+
      (Number(editions.comprehensionV126?.verifiedPages)||0);
    const fingerprint=String(currentKey||'')+':'+String(editions.sourceFingerprint||'');
    const state=qualityAutoResumeRef.current;
    if(state.fingerprint!==fingerprint||verified>state.verified){
      state.fingerprint=fingerprint;state.verified=verified;state.stalledAttempts=0;
    }
    const plan=planStudyAutoResumeV45(editions,Date.now(),state.stalledAttempts);
    if(!plan)return;
    // LAB54: keep the original single LAB45 recovery owner. A timer that fires
    // 1ms early must re-arm instead of consuming the only retry. Android sleep,
    // screen-off and activity re-entry all recompute the SAME saved cooldown.
    let fired=false,cancelled=false,timer=null;
    const schedule=()=>{
      if(cancelled||fired)return;
      if(timer!==null)clearTimeout(timer);
      const delay=autoResumeNextWakeMsV54(plan,Date.now());
      if(delay!==null)timer=setTimeout(tryResume,delay);
    };
    const tryResume=()=>{
      if(cancelled||fired)return;
      const visible=typeof document==='undefined'||document.visibilityState!=='hidden';
      const decision=autoResumeWakeDecisionV54(plan,{
        now:Date.now(),visible,inFlight:resumeExecutionRef.current
      });
      if(resumeBusy||generating){schedule();return;}
      if(decision==='too-early'||decision==='in-flight'){schedule();return;}
      if(decision==='foreground-required')return; // Resume on visibility/focus/pageshow.
      if(decision!=='ready')return;
      fired=true; // One writer, no duplicate request on concurrent wake events.
      if(plan.reason!=='provider-cooldown')state.stalledAttempts++;
      if(activeEdition&&documentData)void resumeGeminiEditions();
      else void resumeFromHome({auto:true});
    };
    schedule();
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',tryResume);
    if(typeof window!=='undefined'){
      window.addEventListener('focus',tryResume);
      window.addEventListener('pageshow',tryResume);
    }
    return ()=>{
      cancelled=true;
      if(timer!==null)clearTimeout(timer);
      if(typeof document!=='undefined')document.removeEventListener('visibilitychange',tryResume);
      if(typeof window!=='undefined'){
        window.removeEventListener('focus',tryResume);
        window.removeEventListener('pageshow',tryResume);
      }
    };
  },[generating,resumeBusy,libraryId,documentData,studyBook?.editionsV36?.updatedAt,
    studyBook?.editionsV36?.status,studyBook?.editionsV36?.verifiedChunkVariants,
    studyBook?.editionsV36?.comprehensionV126?.verifiedPages,
    studyBook?.editionsV36?.quota?.retryAt,resumeCandidate?.id,
    resumeCandidate?.edition?.updatedAt,resumeCandidate?.edition?.status,
    resumeCandidate?.edition?.verifiedChunkVariants]);

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
    if (activeScreen === 'studio' && originalReading) {
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
  // LAB16: aggiorna Recenti sulla Home e quando le fotografie cambiano.
  useEffect(() => {
    if (activeScreen !== 'home') return undefined;
    let cancelled = false;
    void listArchivedScannerPages().then(pages => {
      if (!cancelled) setArchivedScans(pages);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeScreen, scanPages.length]);

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
    clearTimeout(cameraFlashTimerRef.current);
    clearTimeout(cameraFeedbackTimerRef.current);
    void releaseScannerOcr();
  }, []);

  async function refreshLibrary(profileId = activeProfileId) {
    try { setLibraryItems(await listLibraryBooks({ profileId })); } catch { setLibraryItems([]); }
  }

  // Recover LAB36 records too: older metadata did not contain the partial flag.
  useEffect(()=>{
    let active=true;
    (async()=>{
      const candidates=libraryItems.filter(item=>item.metadata?.hasProcessed &&
        item.metadata?.geminiEditionIncomplete!==false).sort((a,b)=>
          Number(b.id===libraryId)-Number(a.id===libraryId)
          || String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
      for(const item of candidates){
        const saved=await getLibraryBook(item.id).catch(()=>null);
        if(!active)return;
        const edition=saved?.studyBook?.editionsV36;
        if(edition && edition.complete!==true){
          setResumeCandidate({id:item.id,fileName:saved.fileName,
            done:edition.verifiedChunkVariants||0,total:edition.totalChunkVariants||0,
            edition,diagnostic:progressDiagnostic(edition)});
          return;
        }
      }
      if(active)setResumeCandidate(null);
    })();
    return ()=>{active=false;};
  },[libraryItems,activeProfileId]);

  useEffect(()=>{
    if(!generating)return;
    const timer=setInterval(()=>{
      const timeout=isExplainedBookV122(studyBook)?EXPLAINED_REQUEST_TIMEOUT_V122:90000;
      if(geminiAbortRef.current && Date.now()-geminiLastActivityRef.current>timeout){
        setGeminiStalled(true);
        setStatus('Gemini senza nuovi segnali · puoi interrompere e riprendere dal checkpoint');
      }
    },15000);
    return ()=>clearInterval(timer);
  },[generating,studyBook?.editionsV36?.version]);

  /* LAB19 — asynchronous cover pipeline. No scanner images sent to AI, no mutation
     of original PDF/eBook bytes, and never wait for artwork before showing the book.
     Only one worker per session; completed/failed covers are cached in IndexedDB. */
  async function generateLibraryCover(id, { forceAI=false, automatic=false } = {}) {
    if(!id) return false;
    let record=await getLibraryBook(id);
    if(!record || (automatic && (record.coverCustom || record.coverOriginal || record.coverAI)))return false;
    if(isScannerBook(record)) {
      if(forceAI)throw new Error('Le scansioni mantengono sempre la fotografia originale.');
      if(record.coverOriginal)return true;
      const ids=record.sourceData?.scanArchivePhotoIds||[];
      if(!ids.length)return false;
      const archived=await getArchivedScannerPages(ids.slice(0,1));
      if(!archived[0]?.blob)return false;
      const image=await imageBlobToThumbnail(archived[0].blob);
      const fresh=await getLibraryBook(id);
      if(!fresh||fresh.coverCustom)return false;
      await updateLibraryMetadata(id,{coverOriginal:image,coverStatus:'ready',coverOrigin:'scan'});
      await refreshLibrary();
      return true;
    }
    if(!forceAI && !record.coverOriginal && !record.coverCustom && record.originalFile) {
      try {
        const image=await extractOriginalCover(record.originalFile);
        if(image) {
          const fresh=await getLibraryBook(id);
          if(!fresh||fresh.coverCustom||fresh.coverOriginal)return false;
          await updateLibraryMetadata(id,{coverOriginal:image,coverStatus:'ready',coverOrigin:'original'});
          await refreshLibrary();
          return true;
        }
      }catch(error) { console.warn('LAB19 original-cover extraction skipped:',error.message); }
    }
    record=await getLibraryBook(id);
    if(!record || (automatic && (record.coverCustom || record.coverOriginal || record.coverAI)))return false;
    // LAB21: no automatically fabricated SVG covers. True image generation is explicit,
    // because each provider call may be billable. Only original extraction stays automatic.
    if(automatic)return false;

    // LAB20: cover generation is guaranteed locally, even without internet.
    // The online AI's job is refining THEME; it does not gate the UI or block the user.
    const variant=(Number(record.coverVariant)||0)+(forceAI?1:0);
    const localTheme=pickLocalTheme(coverContext(record));
    const localCover=renderAICover({title:record.fileName,theme:localTheme,variant});
    const fresh=await getLibraryBook(id);
    if(!fresh || (automatic && (fresh.coverCustom || fresh.coverOriginal || fresh.coverAI)))return false;
    await updateLibraryMetadata(id,{
      coverAI:localCover,
      coverCustom:forceAI?localCover:(fresh.coverCustom||null),
      coverStatus:'ready',
      coverOrigin:forceAI?'local-manual':'local',
      coverVariant:variant,
    });
    await refreshLibrary();

    // One optional, bounded online request can upgrade the cover without
    // replacing any later user-selected photo, cover edit, or original scan.
    if(!coverAiUnavailableRef.current || forceAI) {
      const originalRecord=fresh;
      const improve=async()=>{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),6500);
        try {
          const theme=await requestAiCoverTheme(originalRecord,{signal:controller.signal});
          const latest=await getLibraryBook(id);
          if(!latest || latest.coverVariant!==variant || latest.coverAI!==localCover ||
             (forceAI && latest.coverCustom!==localCover) ||
             (!forceAI && (latest.coverCustom || latest.coverOriginal)))return;
          const updated=renderAICover({title:latest.fileName,theme,variant});
          await updateLibraryMetadata(id,{
            coverAI:updated,
            ...(forceAI?{coverCustom:updated}:{}),
            coverOrigin:forceAI?'ai-manual':'ai',
            coverStatus:'ready',
          });
          await refreshLibrary();
        } catch(error) {
          // No false failure state: the cover is already visible and saved.
          coverAiUnavailableRef.current=true;
          console.warn('LAB20 online cover concept unavailable; local design retained:',error.message);
        } finally {clearTimeout(timeout);}
      };
      coverRemoteTailRef.current=coverRemoteTailRef.current.catch(()=>{}).then(improve);
    }
    if(forceAI) setStatus('Copertina illustrata pronta · il tema AI si aggiorna se il servizio è disponibile');
    return true;
  }
  /* LAB21: REAL image generation. A manual click starts one Gemini image request.
     This produces a preview; it saves NOTHING until the user accepts it.
     Never claim that a generated SVG is an AI-created image. */
  async function generateRealCoverPreview(id,{variant=1,onStage=()=>{}}={}){
    if(!id)throw new Error('Libro non trovato.');
    const record=await getLibraryBook(id);
    if(!record)throw new Error('Questo libro non è più in Libreria.');
    if(isScannerBook(record))throw new Error('Le fotografie scannerizzate conservano la loro immagine originale.');
    return generateTrueBookImage(record,{variant,onStage});
  }
  async function applyRealAICover(id,preview){
    if(!id||!preview?.src?.startsWith('data:image/jpeg;base64,'))
      throw new Error('La copertina generata non è una vera immagine JPEG.');
    const current=await getLibraryBook(id);
    if(!current || isScannerBook(current))throw new Error('Libro non disponibile.');
    await updateLibraryMetadata(id,{
      coverAI:preview.src,coverCustom:preview.src,
      coverStatus:'ready',coverOrigin:'ai-image',
      coverImageProvider:preview.provider||'Gemini Image',
      coverAiPrompt:preview.prompt||'',coverAiGeneratedAt:preview.generatedAt||new Date().toISOString(),
      coverVariant:(Number(current.coverVariant)||0)+1,
    });
    await refreshLibrary();
    setStatus('Vera copertina AI salvata in Libreria · il file originale è invariato');
    return true;
  }
  /* LAB22 · Original first; royalty-free thematic art otherwise.
     Manual one-tap action, no provider secrets, original book/scanned photos unchanged. */
  async function findAndApplyLibraryCover(id,{onStage=()=>{}}={}){
    if(!id)throw new Error('Libro non trovato.');
    const original=await getLibraryBook(id);
    if(!original||isScannerBook(original))throw new Error('Questa fotografia scannerizzata non può essere modificata.');
    const otherBooks=await listLibraryBooks({profileId:original.profileId||activeProfileId});
    const excluded=usedCoverAssets(otherBooks,id);
    const currentAsset=coverAssetIdentity(original);
    if(currentAsset)excluded.push(currentAsset);
    const result=await searchBookCoverOnWeb(original,{onStage,excludeAssets:excluded});
    // LAB23: if an older stored record used the same Commons photo under a
    // legacy URL identity, do not write a duplicate, even if the server
    // accidentally returned one.
    const refreshedBooks=await listLibraryBooks({profileId:original.profileId||activeProfileId});
    const used=usedCoverAssets(refreshedBooks,id);
    if(used.includes(result.assetId)||used.includes(result.sourceUrl))
      throw new Error('Questa foto è già presente su un altro libro. Riprova per cercarne una diversa.');
    if(!result?.src?.startsWith('data:image/jpeg;base64,'))
      throw new Error('La ricerca non ha restituito una copertina utilizzabile.');
    onStage('saving');
    const current=await getLibraryBook(id);
    if(!current||isScannerBook(current))throw new Error('Libro non più disponibile.');
    await updateLibraryMetadata(id,{
      coverCustom:result.src,coverStatus:'ready',
      coverOrigin:result.kind==='original'?'online-catalog':'online-thematic',
      coverImageSource:result.source,
      coverImageSourceUrl:result.sourceUrl,
      coverImageAssetId:result.assetId||'',
      coverImageLicense:result.license,
      coverImageAttribution:result.attribution,
      coverCatalogMatchedTitle:result.matchedTitle,
      coverVariant:(Number(current.coverVariant)||0)+1
    });
    await refreshLibrary();
    setStatus(result.kind==='original'
      ? 'Copertina del catalogo trovata e salvata · PDF originale invariato'
      : 'Fotografia tematica trovata e salvata · PDF originale invariato');
    return result;
  }
  async function chooseLibraryCover(id,file) {
    if(!id||!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Scegli una foto JPG, PNG o WebP.');
    const image=await imageBlobToThumbnail(file);
    const record=await getLibraryBook(id);
    if(!record || isScannerBook(record))throw new Error('Questa copertina non può essere cambiata.');
    await updateLibraryMetadata(id,{coverCustom:image,coverOrigin:'custom',coverStatus:'ready'});
    await refreshLibrary();
    setStatus('Copertina personale salvata · PDF originale invariato');
    return true;
  }
  async function resetLibraryCover(id) {
    const record=await getLibraryBook(id);
    if(!record?.coverOriginal)return false;
    await updateLibraryMetadata(id,{coverCustom:null,coverOrigin:'original',coverStatus:'ready'});
    await refreshLibrary();
    return true;
  }
  /* LAB23: heal duplicate thematic covers from LAB22 one time per library view.
     Only web-sourced copies are touched. Real scanned photos, imported covers,
     book bytes and individually chosen pictures are never rewritten.
     On successful search, replacement is persisted to the correct book ID. */
  const repairingCoversRef=useRef(false);
  useEffect(()=>{
    if(repairingCoversRef.current||activeScreen!=='library'||!libraryItems.length)return;
    const duplicates=findDuplicateWebCovers(libraryItems);
    if(!duplicates.length)return;
    repairingCoversRef.current=true;
    (async()=>{
      for(const item of duplicates.slice(0,8)){
        try{
          const record=await getLibraryBook(item.id);
          if(!record || record.coverOrigin!=='online-thematic'
             ||record.coverImageSourceUrl!==item.coverImageSourceUrl)continue;
          // Remove only a provably duplicated online thematic custom cover.
          await updateLibraryMetadata(item.id,{
            coverCustom:null,
            coverAI:record.coverAI===record.coverCustom?null:record.coverAI,
            coverOrigin:'online-duplicate-repair',
            coverStatus:'needs-new-cover',
            coverImageSourceUrl:'',
            coverImageAssetId:'',
          });
          await refreshLibrary();
          try{await findAndApplyLibraryCover(item.id);}catch(error){
            console.warn('LAB23 replacement not available for',item.id,error?.message);
          }
        }catch(error){console.warn('LAB23 safe duplicate reconciliation skipped',error?.message);}
      }
      repairingCoversRef.current=false;
    })();
  },[libraryItems,activeScreen,activeProfileId]);
  useEffect(()=>{
    if(importing||generating||coverWorkerRef.current||!libraryItems.length)return;
    // Process only incomplete books; each attempt is stored to avoid retry storms.
    const waiting=libraryItems.filter(item=>!coverQueueRef.current.has(item.id)
      && !item.coverCustom&&!item.coverOriginal&&!item.coverAI
).slice(0,20);
    if(!waiting.length)return;
    let cancelled=false;
    const timer=setTimeout(async()=>{
      if(coverWorkerRef.current||cancelled)return;
      coverWorkerRef.current=true;
      try {
        for(const book of waiting) {
          // Continue the bounded queue even when refreshLibrary re-renders after each completed cover.
          coverQueueRef.current.add(book.id);
          try {await generateLibraryCover(book.id,{automatic:true});}
          catch(error){console.warn('LAB19 background cover skipped:',error.message);}
        }
      } finally {coverWorkerRef.current=false;}
    },500);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[libraryItems,importing,generating,activeProfileId]);

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
        // LAB15: la copia originale apre direttamente la scheda Libro aperto.
        // Non si avvia alcuna elaborazione e non si crea un altro record.
        if (!record.originalFile) throw new Error('Il file originale non è disponibile su questo dispositivo.');
        setOriginalRecord(record);
        setOriginalReading(false);
        setLibraryId(record.id);
        setFileName(record.fileName);
        setDocumentData(record.sourceData || null);
        setSourceFile(record.originalFile);
        setStudyBook(record.studyBook || null);
        setLevel(record.studyBook?.level || 'studio');
        setDsaMode(record.dsaMode !== false);
        setSelectedChapter(0);
        setSourceEditor(null);
        setSummaryEditor(null);
        setStudyModeOpen(false);
        setStatus(record.studyBook ? 'Libro pronto · scegli come utilizzarlo' : 'Originale pronto · scegli come utilizzarlo');
        navigateTo('studio');
        return;
      }
      if (!record.studyBook || !record.sourceData) throw new Error('Libro elaborato non disponibile.');
      setOriginalRecord(null);
      setOriginalReading(false);
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


  async function recoverSourceFromLibrary(id) {
    if (libraryBusy || importing || generating || scanProcessing) return false;
    setLibraryBusy(true); setImporting(true); setError('');
    setProgress({done:0,total:1});
    setStatus('Fonte Blindata · verifico la copia PDF originale conservata…');
    try {
      const {record,reviewPages}=await reacquireFromSavedPdf(id,{
        onProgress(update) {
          if (String(update?.phase||'').startsWith('study-')) {
            const m=update.meta||{};
            setProgress({done:m.chunksDone ?? update.done ?? 0,
              total:m.chunksTotal || update.total || 1});
            setStatus('Studio da fonte verificata · '+(m.chunksDone ?? update.done ?? 0)+'/'+(m.chunksTotal || update.total || 1)+' blocchi');
          } else {
            if (Number.isFinite(update?.done) && Number.isFinite(update?.total) && update.total > 0)
              setProgress({done:update.done,total:update.total});
            setStatus(update?.phase==='source-recovery-start'
              ? 'Riesame del PDF conservato · cerco le sole pagine problematiche…'
              : importStatus(update));
          }
        },
      });
      setLibraryId(record.id); setFileName(record.fileName);
      setDocumentData(record.sourceData); setSourceFile(record.originalFile);
      setStudyBook(record.studyBook||null);
      setOriginalRecord(record.studyBook?null:record);
      setSelectedChapter(0);
      await refreshLibrary();
      setStatus(reviewPages.length
        ? 'Riesame completato · '+reviewPages.length+' pagine richiedono confronto con l’originale'
        : 'Riesame completato · PDF conservato · testo ricostruito');
      navigateTo('studio');
      return true;
    } catch (err) {
      setError(err?.message || 'Recupero interrotto: versione precedente conservata.');
      setStatus('Recupero non completato · vecchio libro e PDF originale conservati');
      return false;
    } finally { setImporting(false); setLibraryBusy(false); }
  }

  async function reprocessLibraryItem(id) {
    if (libraryBusy || generating || importing || scanProcessing) return false;
    setLibraryBusy(true);
    setGenerating(true);
    setError('');
    setStatus('Rielaborazione dal testo originale · preparo il libro…');
    setProgress({done:0,total:0});
    try {
      const priorRecord = await getLibraryBook(id);
      setProgress({done:0,total:countParagraphs(priorRecord?.sourceData?.chapters || [])});
      setStatus('Riprendo la rielaborazione: verifico i checkpoint salvati…');
      const record = await reprocessStoredBook(id, {
        onProgress(done, total, phase, meta) {
          if (phase === 'fidelity') {
            setProgress({done:meta?.chaptersDone||0,total:meta?.chaptersTotal||1});
            setStatus('Verifica fedeltà · capitolo '+(meta?.chaptersDone||0)+'/'+(meta?.chaptersTotal||1));
          } else {
            setProgress({done:meta?.chunksDone ?? done,total:meta?.chunksTotal || total});
            if (phase === 'resume') setStatus('Progressi recuperati · '+done+'/'+total+' paragrafi · riprendo dai checkpoint');
            else if (phase === 'preparazione') setStatus('Preparazione completata · primo blocco in elaborazione…');
            else if (phase === 'ai' || phase === 'misto' || phase === 'locale')
              setStatus('Rielaborazione · blocchi '+(meta?.chunksDone ?? done)+'/'+(meta?.chunksTotal || total)+' · salvataggio continuo');
          }
        },
      });
      // All context is installed only after the atomic book save succeeded.
      setOriginalRecord(null);
      setOriginalReading(false);
      setLibraryId(record.id);
      setFileName(record.fileName);
      setDocumentData(record.sourceData);
      setSourceFile(record.originalFile || null);
      setStudyBook(record.studyBook);
      setDsaMode(record.dsaMode !== false);
      setLevel(record.studyBook?.level || 'studio');
      setSelectedChapter(0);
      setSourceEditor(null);
      setSummaryEditor(null);
      setStudyModeOpen(false);
      setStatus('Rielaborazione completata · originale e copertina conservati');
      await refreshLibrary(record.profileId || activeProfileId);
      navigateTo('studio');
      return true;
    } catch (err) {
      const message = err?.message || 'Rielaborazione non riuscita: libro precedente conservato.';
      setError(message);
      setStatus('Rielaborazione non completata · libro precedente conservato');
      return false;
    } finally {
      setGenerating(false);
      setLibraryBusy(false);
    }
  }

  async function processFile(file, { resumeRecord = null } = {}) {
    if (!file) return;
    // LAB47: PDF/eBook importer only. Images belong to the separate Scanner flow.
    if (/^image\//i.test(file.type||'') || /\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name||'')) {
      setError('Immagini escluse dall’importazione libri. Per acquisire una foto usa Scanner.');
      setStatus('Importazione solo testo · nessuna immagine caricata');
      return;
    }
    setError('');
    setStatus('Analisi del documento…');
    setFileName(file.name);
    setSourceFile(file);
    setLibraryId(resumeRecord?.id || '');
    setStudyBook(null);
    setDocumentData(null);
    setScannerResultReady(false);
    setSourceEditor(null);
    setSummaryEditor(null);
    setProgress({ done: 0, total: 0 });
    setImportAcquisition({id:resumeRecord?.id||null,done:0,total:0});
    setImporting(true);

    try {
      // LAB13: conservazione anticipata del file esatto prima di OCR/rielaborazione.
      // Un errore del parser non deve far perdere il documento originale importato.
      const originalSaved = resumeRecord || await saveLibraryBook({
        id: createLibraryId(), fileName: file.name, profileId: activeProfileId, originalFile: file,
      });
      setLibraryId(originalSaved.id);
      setImportAcquisition({id:originalSaved.id,done:0,total:0});
      setOriginalRecord(originalSaved);
      setOriginalReading(false);
      await refreshLibrary(activeProfileId);
      // LAB46: persist true page acquisition every ~5% (at most 20 writes for
      // large books) without rewriting the original or the Gemini checkpoints.
      // All updates use the existing library owner with one serialized writer.
      let acquisitionSaveTail=Promise.resolve();
      let acquisitionCheckpointDone=-1;
      let acquisitionCheckpointTotal=0;
      const parsed = await readSourceFile(file, {
        autoOcr: false, textOnly: true,
        onProgress(update) {
          setStatus(importStatus(update));
          if (Number.isFinite(update?.done) && Number.isFinite(update?.total) && update.total > 0) {
            setProgress({ done: update.done, total: update.total });
          }
          // Only physical source-page events update the source acquisition meter.
          // OCR progress and Gemini chunks must never masquerade as downloaded pages.
          const phase=String(update?.phase||'');
          if(['turbo-inventory','turbo-resume','extract','turbo-verify'].includes(phase)
              && Number.isFinite(update?.total)&&update.total>0){
            const total=Math.max(0,Math.trunc(update.total));
            const count=phase==='turbo-resume'?(update.resumed||0):(update.done||0);
            const done=Math.max(0,Math.min(total,Math.trunc(Number(count)||0)));
            setImportAcquisition(old=>({id:old.id,total,done:Math.max(
              old.total===total?old.done:0,done)}));
            const threshold=Math.max(10,Math.ceil(total/20));
            if(total!==acquisitionCheckpointTotal ||
               done>=acquisitionCheckpointDone+threshold || done===total){
              acquisitionCheckpointTotal=total;
              acquisitionCheckpointDone=done;
              acquisitionSaveTail=acquisitionSaveTail.then(async()=>{
                const saved=await getLibraryBook(originalSaved.id);
                if(!saved)return;
                const current=saved.metadata||{};
                const metadata={...current,pages:Math.max(total,Number(current.pages)||0),
                  pagesAcquired:Math.min(total,Math.max(done,Number(current.pagesAcquired)||0))};
                await updateLibraryMetadata(originalSaved.id,{metadata});
              }).catch(()=>null);
            }
          }
        },
      });
      setDocumentData(parsed);
      await acquisitionSaveTail;
      const parsedOriginal = await saveLibraryBook({
        id: originalSaved.id, fileName: file.name, profileId: activeProfileId,
        originalFile: file, sourceData: parsed,
      });
      setOriginalRecord(parsedOriginal);
      const totalPages=Number(parsed?.structure?.pageCount||parsed?.pages?.length)||0;
      setImportAcquisition({id:parsedOriginal.id,total:totalPages,done:totalPages});
      await refreshLibrary(activeProfileId);
      setSelectedChapter(0);
      const recovered = parsed.ocrApplied?.length || 0;
      const unresolved = parsed.needsOcr?.length || 0;
      const suspected = parsed.sourceShield?.reviewPages?.length || 0;
      const structuralWarnings = parsed.precisionAudit?.warningCount || 0;
      if (unresolved) setStatus(`Importazione solo testo · ${unresolved} pagine prive di testo selezionabile da verificare · nessuna immagine elaborata`);
      else if (suspected) setStatus(`Originale conservato · ${suspected} pagine da confrontare con il PDF · nessun testo cancellato`);
      else if (structuralWarnings) setStatus(`Documento analizzato · ${structuralWarnings} possibili anomalie da verificare`);
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

  function requestActiveGeminiRecovery(){
    // LAB124: the prior "Verifica richiesta Gemini" button was inert during
    // a live LAB122-123 run: this runner never registered its AbortController.
    // Cancel only this one active request and restart serially at its checkpoint.
    if(isExplainedBookV122(studyBook)){
      if(restartRequestedRef.current){
        setStatus('Ripresa già richiesta · nessuna richiesta Gemini duplicata');
        return;
      }
      const controller=geminiAbortRef.current;
      if(!controller){
        setStatus('Verifico il checkpoint locale: nessuna richiesta Gemini interrompibile in questo istante');
        return;
      }
      restartRequestedRef.current=true;
      setStatus('Interrompo la richiesta Gemini corrente · riparto dalle pagine già salvate');
      controller.abort();
      return;
    }
    if(!geminiStalled){
      setStatus('Elaborazione già attiva · attendi o apri lo stato del libro; nessun riavvio necessario');
      navigateTo('studio');
      return;
    }
    if(restartRequestedRef.current)return;
    const controller=geminiAbortRef.current;
    if(!controller){
      setStatus('Preparazione ancora in corso · la ripresa diventa disponibile appena parte Gemini');
      return;
    }
    restartRequestedRef.current=true;
    setResumeBusy(true);
    setStatus('Ripresa richiesta · interrompo la singola richiesta e recupero i checkpoint…');
    controller.abort();
  }

  // The same runner owns fresh generation and resumed generation, serially.
  // Aborted requests cannot execute a second concurrent checkpoint writer.
  async function runGeminiWithSafeRestart(book,onProgress){
    // Existing LAB36/LAB37 checkpoints remain available for re-verification;
    // the new pedagogical pillar is mandatory for every new or resumed run.
    const progressiveBook={...book,studyPillarV38:STUDY_PILLAR_VERSION};
    for(;;){
      restartRequestedRef.current=false;
      const controller=new AbortController();
      geminiAbortRef.current=controller;
      geminiLastActivityRef.current=Date.now();
      setGeminiStalled(false);
      setWorkPhase('gemini');
      let snapshot;
      try{
        snapshot=await generateGeminiEditionsV36(progressiveBook,{
          maxConcurrency:1,signal:controller.signal,onProgress,
          onActivity:()=>{
            geminiLastActivityRef.current=Date.now();
            setGeminiStalled(false);
          },
        });
      }finally{
        if(geminiAbortRef.current===controller)geminiAbortRef.current=null;
      }
      const restart=restartRequestedRef.current && snapshot?.status==='interrupted';
      setResumeBusy(false);
      setGeminiStalled(false);
      if(!restart){
        restartRequestedRef.current=false;
        return snapshot;
      }
      setStatus('Checkpoint recuperati · riprendo soltanto le parti ancora mancanti…');
    }
  }

  // LAB124: one serial owner, one AbortController for both NEW and RESUMED
  // explained books. The manual recovery control cancels an in-flight request
  // and the same runner retries from the last persisted verified pages.
  async function runExplainedWithSafeRestart(book,{
    retryReviewed=false,onProgress=async()=>{},onActivity=()=>{}
  }={}){
    let working=book,restarts=0;
    for(;;){
      restartRequestedRef.current=false;
      const controller=new AbortController();
      geminiAbortRef.current=controller;
      geminiLastActivityRef.current=Date.now();
      setGeminiStalled(false);
      let snapshot;
      try{
        snapshot=await (working?.editionsV36?.version===EXPLAINED_POLICY_V126
          ?generateExplainedBookV126:generateExplainedBookV122)(working,{
          retryReviewed,signal:controller.signal,onProgress,
          onActivity:info=>{
            geminiLastActivityRef.current=Date.now();
            setGeminiStalled(false);
            const start=info?.pageStart||'?';
            const end=info?.pageEnd||start;
            setStatus(info?.stage==='comprehend'
              ?'Gemini · comprensione dell’intero libro, pagine '+start+
                (start===end?'':'–'+end)+' · nessuna compressione ancora avviata'
              :'Gemini · richiesta pagin'+(start===end?'a ':'e ')+
                start+(start===end?'':'–'+end)+' in corso · risultati salvati pagina per pagina');
            onActivity(info);
          }
        });
      }finally{
        if(geminiAbortRef.current===controller)geminiAbortRef.current=null;
      }
      working={...working,editionsV36:snapshot};
      if(restartRequestedRef.current&&snapshot?.status==='interrupted'&&restarts<2){
        restarts++;
        setStatus('Richiesta interrotta · riparto dal checkpoint senza duplicare il libro');
        continue;
      }
      restartRequestedRef.current=false;
      return snapshot;
    }
  }

  async function createStudyBook(sourceData, sourceName, { fromScanner = false } = {}) {
    if (!sourceData || generating) return null;
    let generatedDraft = null;
    setGenerating(true);
    setWorkPhase('preparing');
    setGeminiStalled(false);
    setDsaMode(true);
    setError('');
    setProgress({ done: 0, total: countParagraphs(sourceData.chapters) });
    setStatus(fromScanner ? 'MotorLab Runtime · scansione completa · preparo il libro…' : 'MotorLab Runtime · preparo il libro di studio…');

    try {
      // LAB36: prepare the source map locally; the SIX editions below are the only
      // Gemini requests. Avoid paying a second quota/time cost for throwaway summaries.
      const generated = await buildStudyBook(sourceData, {
        level,
        preferAi: false,
        onProgress(done, total, phase, meta) {
          if (phase === 'fidelity') {
            setProgress({done:meta?.chaptersDone||0,total:meta?.chaptersTotal||1});
            setStatus(`Controllo fedeltà · capitolo ${meta?.chaptersDone||0}/${meta?.chaptersTotal||1}`);
          } else {
            setProgress({done:meta?.chunksDone ?? done,total:meta?.chunksTotal || total});
            if (phase === 'resume') setStatus(`Ripresa dal checkpoint · ${meta?.chunksDone ?? done}/${meta?.chunksTotal || total} blocchi`);
            else if (phase === 'preparazione') setStatus('Preparazione completata · attendo il primo blocco di studio…');
            else if (phase === 'ai' || phase === 'misto' || phase === 'locale')
              setStatus(`Studio · ${meta?.chunksDone ?? done}/${meta?.chunksTotal || total} blocchi · salvataggio continuo`);
          }
        },
      });
      const sourceIntegrity = auditBookSourceCoverage(sourceData, generated);
      let result = { ...generated,
        studyPillarV38:STUDY_PILLAR_VERSION,
        canonicalBookMap: sourceData?.canonicalBookMap || generated.canonicalBookMap || null,
        quality: { ...(generated.quality || {}), sourceIntegrity } };
      // LAB122 NEW BOOKS: exactly one explained edition per original page.
      // No legacy six-pass provider requests; old saved books keep their runner.
      if(result.canonicalBookMap?.pages?.length){
        const initialSnapshot={
          version:EXPLAINED_POLICY_V126,
          sourceFingerprint:result.canonicalBookMap.originalFingerprint,
          pages:[],originalPages:result.canonicalBookMap.pageCount,
          complete:false,status:'comprehension',phase:'comprehension',
          verifiedChunkVariants:0,totalChunkVariants:result.canonicalBookMap.pageCount,
          verifiedChunks:0,draftUnitsSaved:0,checkpointPersistent:true,
          semanticCertified:false,diagnostics:{requestsSent:0,mode:'lab126-understand-entire-book-first'}
        };
        let explained={...result,editionsV36:initialSnapshot,engine:'misto'};
        generatedDraft=explained;
        setStudyBook(explained);setWorkPhase('gemini');
        setProgress({done:0,total:initialSnapshot.totalChunkVariants});
        setStatus('Libro spiegato · fase 1: comprensione di tutto il libro');
        navigateTo('studio');
        const firstSaved=await persistBook(explained,sourceData,sourceName,libraryId);
        if(!firstSaved){
          setStatus('Originale conservato · impossibile salvare il checkpoint iniziale');
          return explained;
        }
        const savedId=firstSaved.id;
        const finalSnapshot=await runExplainedWithSafeRestart(explained,{
          onProgress:async (snapshot,meta)=>{
            explained={...result,editionsV36:snapshot,
              engine:snapshot.complete?'ai':'misto'};
            generatedDraft=explained;
            setStudyBook(explained);
            setProgress({done:snapshot.phase==='comprehension'
              ?snapshot.comprehensionV126?.verifiedPages||0:snapshot.verifiedChunkVariants||0,
              total:snapshot.totalChunkVariants||1});
            setStatus(snapshot.phase==='comprehension'
              ?'Comprensione di tutto il libro · '+
                (snapshot.comprehensionV126?.verifiedPages||0)+'/'+
                (snapshot.comprehensionV126?.totalPages||0)+' pagine comprese · nessuna compressione avviata'
              :'Libro spiegato · '+(snapshot.verifiedChunkVariants||0)+'/'+
                (snapshot.totalChunkVariants||0)+' pagine verificate · glossario incluso');
            if(meta?.persist!==false){
              await saveLibraryBook({
                id:savedId,fileName:sourceName,sourceData,
                studyBook:explained,dsaMode:true,profileId:activeProfileId,
                originalFile:sourceFile
              });
            }
          }
        });
        explained={...result,editionsV36:finalSnapshot,
          engine:finalSnapshot.complete?'ai':'misto'};
        generatedDraft=explained;
        setStudyBook(explained);
        setProgress({done:finalSnapshot.verifiedChunkVariants||0,
          total:finalSnapshot.totalChunkVariants||1});
        await persistBook(explained,sourceData,sourceName,savedId);
        setStatus(finalSnapshot.complete
          ?'Libro spiegato completo · pagine e glossario pronti per il PDF'
          :explainedProgressMessageV122(finalSnapshot));
        navigateTo('studio');
        return explained;
      }

      // LAB38 hotfix: local preprocessing is NOT Gemini progress. Only here
      // does the Gemini counter begin, and the book becomes openable.
      setWorkPhase('gemini');
      setProgress({done:0,total:0});
      // LAB36: show only verified generated pages as a progressive preview.
      // Persist individual chunks in the existing MotorLab runtime IndexedDB store.
      const initialDraft={...result,editionsV36:{status:'partial',complete:false,rows:[]}};
      generatedDraft=initialDraft;
      setStudyBook(initialDraft);
      navigateTo('studio');
      // Persist a single Library identity before the first Gemini request.
      const firstSave=await persistBook(initialDraft,sourceData,sourceName,libraryId);
      if(!firstSave){
        setStatus('Preparazione completa ma salvataggio locale non riuscito · libro originale conservato');
        return initialDraft;
      }
      const lab36BookId=firstSave.id;
      let savedVerified = 0,savedDrafts = 0;
      // LAB61: a successful but not-yet-verified correction is real progress.
      // Persist its attempt map and updated drafts, not only approved counts.
      let savedRepairMarker='{}';
      let checkpointTail = Promise.resolve();
      const editions = await runGeminiWithSafeRestart(result,(snapshot)=>{
          generatedDraft={...result,editionsV36:snapshot,
            engine:snapshot.complete?'ai':(snapshot.verifiedChunks>0?'misto':result.engine)};
          setStudyBook(generatedDraft);
          setProgress({done:snapshot.verifiedChunkVariants||0,total:snapshot.totalChunkVariants||1});
          setStatus(snapshot.phase==='draft'
            ?'Compressione delle sei versioni · bozze salvate man mano, controllo qualità successivo'
            :snapshot.phase==='quality'
              ?'Controllo qualità locale · nessuna correzione automatica'
              :'Controllo qualità delle sei versioni');
          // Save progress occasionally, never let concurrent IndexedDB writers race.
          const repairMarker=JSON.stringify(snapshot.repairAttemptsV57||{});
          if(lab36BookId && (
              (snapshot.draftUnitsSaved||0)>savedDrafts ||
              (snapshot.verifiedChunkVariants||0)>savedVerified ||
              repairMarker!==savedRepairMarker
            )){
            savedVerified=snapshot.verifiedChunkVariants||0;
            savedDrafts=snapshot.draftUnitsSaved||0;
            savedRepairMarker=repairMarker;
            const copy=generatedDraft;
            checkpointTail=checkpointTail.then(()=>saveLibraryBook({
              id:lab36BookId,fileName:sourceName,sourceData,studyBook:copy,
              dsaMode:true,profileId:activeProfileId,originalFile:sourceFile,
            })).catch(()=>null);
          }
      });
      await checkpointTail;
      result={...result,editionsV36:editions,
        engine:editions.complete?'ai':(editions.verifiedChunks>0?'misto':result.engine)};
      generatedDraft=result;
      setStudyBook(result);
      // LAB12: il titolo finale considera l'intero documento elaborato; non sostituisce mai il nome manuale.
      const suggestedFinal = fromScanner && !scanTitleManualRef.current
        ? suggestDocumentTitle(sourceData.pages || [], result.chapters || []) : null;
      const nameToSave = suggestedFinal?.title
        ? `${sanitizeTitle(suggestedFinal.title)}.pdf` : sourceName;
      setFileName(nameToSave);
      const saved = await persistBook(result, sourceData, nameToSave, lab36BookId);
      if (saved && result.editionsV36?.complete && (generated.resumeSignature || generated.quality?.resumeSignature))
        await markResumeStatePublished(generated.resumeSignature || generated.quality?.resumeSignature);
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
        setArchivedScans(await listArchivedScannerPages());
        await refreshScannerStorage();
      }
      const engineLabel = result.engine === 'ai' ? 'AI' : result.engine === 'misto' ? 'AI + sicurezza locale' : 'modalità locale';
      const runtime = result.quality?.motorLabRuntime;
      const speedLabel = runtime ? ` · MotorLab Runtime · ${runtime.maxConcurrencyUsed || 1} corridori${runtime.cachedChunks ? ` · ${runtime.cachedChunks} blocchi riusati` : ''}` : '';
      const completionInfo=progressDiagnostic(result.editionsV36);
      setStatus(!result.editionsV36?.complete
        ? completionInfo.description+' · '+completionInfo.base+' · originale conservato'
        : sourceIntegrity.passed
        ? `Sei edizioni generate · controllo qualità locale completato${speedLabel}${saved ? ' · salvate in Libreria' : ''}`
        : `Libro da verificare · ${sourceIntegrity.issueCount} possibili anomalie di completezza · originale conservato`);
      navigateTo('studio');
      return result;
    } catch (err) {
      setError(err.message || 'Errore durante la creazione del libro di studio.');
      if(generatedDraft){
        setStudyBook(generatedDraft);
        await persistBook(generatedDraft,sourceData,sourceName,libraryId);
        setStatus('Anteprima parziale salvata · le edizioni non verificate rimangono bloccate');
        navigateTo('studio');
        return generatedDraft;
      }
      setStatus('Errore');
      return null;
    } finally {
      setGenerating(false);
      setWorkPhase('idle');
      setGeminiStalled(false);
    }
  }

  async function generateBook() {
    // Never preprocess the same incomplete book again on a second Home tap.
    if(generating){
      if(studyBook)navigateTo('studio');
      else setStatus('La preparazione del documento è ancora in corso');
      return;
    }
    if(homeAction==='resume'){
      await resumeFromHome();
      return;
    }
    if(homeAction==='open'){
      navigateTo('studio');
      return;
    }
    await createStudyBook(documentData,fileName);
  }

  // Direct resume, also after Android process death: always reload the stored
  // original and the sparse verified-unit checkpoints, never reimport the PDF.
  // LAB67: explicit improvement of deficient completed editions. This is
  // PHASE TWO, never a correction cycle in the nonblocking quality phase.
  async function improveReductionV67(){
    if(generating||resumeExecutionRef.current||!canRebalanceBookV67(studyBook)){
      setStatus('Miglioramento non disponibile: verificare il libro salvato.');
      return;
    }
    resumeExecutionRef.current=true;
    setGenerating(true);setWorkPhase('gemini');setGeminiStalled(false);setError('');
    const book=studyBook;
    const abort=new AbortController();
    geminiAbortRef.current=abort;
    try{
      setStatus('Gemini riformula con parole più semplici, proteggendo formule e leggi. Le versioni attuali restano salvate.');
      const result=await rebalanceSavedStudyBookV67(book,{
        signal:abort.signal,
        onActivity:info=>{
          geminiLastActivityRef.current=Date.now();
          if(info.phase==='recalibrate')
            setStatus('Ricalibrazione '+(info.level==='summary'?'Riassunto':info.level+'%')+
              ' · pagine '+info.pageStart+'-'+info.pageEnd+
              ' · testo più comprensibile e riduzione misurata');
        },
        onProgress:async checkpoint=>{
          const saved={...book,editionsV36:checkpoint};
          // Never advance the local checkpoint without durable persistence.
          if(libraryId){
            const stored=await persistBook(saved,documentData,fileName,libraryId);
            if(!stored)throw new Error('Checkpoint non salvato: conservate le versioni precedenti.');
          }
          setStudyBook(saved);
        }
      });
      const improved={...book,editionsV36:result};
      if(libraryId){
        const stored=await persistBook(improved,documentData,fileName,libraryId);
        if(!stored)throw new Error('Ultimo checkpoint non salvato.');
      }
      setStudyBook(improved);
      const done=result.rebalanceV67;
      const left=done?.remaining?.length||0;
      setStatus(done?.status==='waiting-provider'
        ?'Gemini temporaneamente non disponibile. Progressi conservati; riprendi la ricalibrazione.'
        :left===0
          ?'Riduzioni migliorate · testo più chiaro · controllo qualità aggiornato'
          :'Ricalibrazione conclusa: '+(done?.accepted||0)+
             ' versioni migliorate; '+left+' obiettivi ancora fuori tolleranza. I testi precedenti restano salvati.');
    }catch(error){
      setError(error?.message||'Ricalibrazione interrotta.');
      setStatus('Ricalibrazione interrotta. Libro originale e versioni precedenti conservati.');
    }finally{
      if(geminiAbortRef.current===abort)geminiAbortRef.current=null;
      resumeExecutionRef.current=false;
      setGenerating(false);setWorkPhase('idle');setGeminiStalled(false);
    }
  }

  async function resumeGeminiEditions(record=null){
    if(generating){
      if(geminiStalled)requestActiveGeminiRecovery();
      else {setStatus('Gemini sta già lavorando · nessuna nuova richiesta avviata');navigateTo('studio');}
      return;
    }
    if(resumeExecutionRef.current){setStatus('Recupero già avviato · nessuna richiesta duplicata');return;}
    const current={...(record?.studyBook||studyBook),studyPillarV38:STUDY_PILLAR_VERSION};
    const targetSource=record?.sourceData||documentData;
    const targetName=record?.fileName||fileName;
    const targetId=record?.id||libraryId;
    if(isExplainedBookV122(current)){
      if(!targetSource||!targetId){setError('Fonte originale non presente.');return;}
      const retryAt=Date.parse(String(current.editionsV36?.quota?.retryAt||''));
      if(Number.isFinite(retryAt)&&Date.now()<retryAt){
        setStatus('Pausa Gemini ancora in corso fino alle '+
          new Date(retryAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+
          ' · il libro e i checkpoint sono conservati');
        return;
      }
      resumeExecutionRef.current=true;
      setGenerating(true);setWorkPhase('gemini');setError('');
      let latest=current;
      try{
        const snapshot=await runExplainedWithSafeRestart(current,{
          retryReviewed:true,
          onProgress:async (update,meta)=>{
            latest={...current,editionsV36:update,
              engine:update.complete?'ai':'misto'};
            setStudyBook(latest);
            setProgress({done:update.phase==='comprehension'
              ?update.comprehensionV126?.verifiedPages||0:update.verifiedChunkVariants||0,
              total:update.totalChunkVariants||1});
            setStatus(update.phase==='comprehension'
              ?'Comprensione dell’intero libro · '+
                (update.comprehensionV126?.verifiedPages||0)+'/'+
                (update.comprehensionV126?.totalPages||0)+' pagine'
              :'Libro spiegato · '+(update.verifiedChunkVariants||0)+'/'+
                (update.totalChunkVariants||0)+' pagine verificate');
            if(meta?.persist!==false){
              await saveLibraryBook({id:targetId,fileName:targetName,sourceData:targetSource,
                studyBook:latest,dsaMode:true,profileId:activeProfileId,
                originalFile:record?.originalFile||sourceFile});
            }
          }
        });
        latest={...current,editionsV36:snapshot,engine:snapshot.complete?'ai':'misto'};
        setStudyBook(latest);
        await persistBook(latest,targetSource,targetName,targetId);
        setStatus(snapshot.complete?'Libro spiegato completo · PDF pronto':
          explainedProgressMessageV122(snapshot));
      }catch(error){setError(error?.message||'Ripresa Libro spiegato non riuscita.');
        await persistBook(latest,targetSource,targetName,targetId);
      }finally{
        resumeExecutionRef.current=false;setGenerating(false);setWorkPhase('idle');
        setGeminiStalled(false);setResumeBusy(false);
      }
      return;
    }
    if(!current?.editionsV36||current.editionsV36.complete||!targetSource){
      setStatus('Nessuna elaborazione parziale recuperabile per questo libro');
      return;
    }
    if(requiresRecalibrationV79(current.editionsV36)){
      // LAB79: "resume" must not repeat an already complete local audit
      // or imply a Gemini request ran. Show the existing targeted correction
      // control instead; only explicit user action may call the provider.
      setStatus('Tutte le bozze sono salvate. Il controllo ha rilevato '+
        'riduzioni fuori margine. Apri Studio e premi «Migliora percentuali e chiarezza».');
      navigateTo('studio');
      return;
    }
    resumeExecutionRef.current=true;
    let draft=current;
    setGenerating(true);setWorkPhase('gemini');setGeminiStalled(false);setError('');
    setProgress({done:current.editionsV36.verifiedChunkVariants||0,
      total:current.editionsV36.totalChunkVariants||1});
    try{
      // LAB79: execute a free local audit ONLY if the six saved drafts
      // have never been audited. A finished but nonconforming audit must
      // never be mistaken for more pending generation.
      const localAudit=Boolean(current.editionsV36?.draftComplete&&
        current.editionsV36?.draftRowsV57&&
        !hasFinishedLocalAuditV79(current.editionsV36));
      const pause=localAudit?null:await readGeminiPause();
      if(pause){
        const paused={...current.editionsV36,quota:pause,status:pause.automatic?'quota-paused':'quota-review'};
        draft={...current,editionsV36:paused};
        setStudyBook(draft);
        await persistBook(draft,targetSource,targetName,targetId);
        setStatus(quotaDisplayV36(pause)+
          ' · Nessuna richiesta inviata. Ripresa automatica quando il telefono torna in primo piano e termina la pausa. Checkpoint conservati.');
        return;
      }
      let checkpointTail=Promise.resolve(),savedVerified=current.editionsV36.verifiedChunkVariants||0,
        savedDrafts=current.editionsV36.draftUnitsSaved||0,
        savedRepairMarker=JSON.stringify(current.editionsV36.repairAttemptsV57||{});
      const snapshot=await runGeminiWithSafeRestart(current,(update)=>{
        draft={...current,editionsV36:update,
          engine:update.complete?'ai':(update.verifiedChunks>0?'misto':current.engine)};
        setStudyBook(draft);
        setProgress({done:update.verifiedChunkVariants||0,total:update.totalChunkVariants||1});
        setStatus(update.phase==='draft'
          ?'Compressione delle sei versioni · bozze conservate'
          :update.phase==='quality'
            ?'Controllo qualità locale · pagine disponibili con eventuali avvisi'
            :'Controllo qualità delle sei versioni');
        const count=update.verifiedChunkVariants||0;
        const repairMarker=JSON.stringify(update.repairAttemptsV57||{});
        if(targetId&&(count>savedVerified||(update.draftUnitsSaved||0)>savedDrafts||
          repairMarker!==savedRepairMarker)){
          savedVerified=count;
          savedDrafts=update.draftUnitsSaved||0;
          savedRepairMarker=repairMarker;
          const copy=draft;
          checkpointTail=checkpointTail.then(()=>saveLibraryBook({
            id:targetId,fileName:targetName,sourceData:targetSource,studyBook:copy,
            dsaMode:true,profileId:activeProfileId,originalFile:record?.originalFile||sourceFile,
          })).catch(()=>null);
        }
      });
      await checkpointTail;
      draft={...current,editionsV36:snapshot,
        engine:snapshot.complete?'ai':(snapshot.verifiedChunks>0?'misto':current.engine)};
      setStudyBook(draft);
      await persistBook(draft,targetSource,targetName,targetId);
      const outcome=progressDiagnostic(snapshot);
      setStatus(snapshot.complete?'Sei edizioni disponibili · controllo qualità terminato · avvisi consultabili':
        outcome.description+' · originale conservato');
    }catch(error){
      setStudyBook(draft);
      await persistBook(draft,targetSource,targetName,targetId);
      setError(error?.message||'Impossibile riprendere Gemini');
    }finally{
      resumeExecutionRef.current=false;
      setGenerating(false);
      setWorkPhase('idle');
      setGeminiStalled(false);
      setResumeBusy(false);
    }
  }

  async function resumeFromHome({auto=false}={}){
    if(generating){
      // Opening the processing page is safe; aborting an active request is not.
      if(studyBook)navigateTo('studio');
      else setStatus('Preparazione in corso · attendo il libro prima di aprirlo');
      return;
    }
    if(resumeExecutionRef.current||resumeBusy)return;
    setResumeBusy(true);
    try{
      const currentSaved=studyBook?.editionsV36?.complete===false && libraryId
        ? await getLibraryBook(libraryId).catch(()=>null):null;
      const saved=currentSaved||(resumeCandidate?.id
        ? await getLibraryBook(resumeCandidate.id).catch(()=>null):null);
      const record=saved || (studyBook?.editionsV36?.complete===false
        ? {id:libraryId,fileName,sourceData:documentData,studyBook}:null);
      if(!record?.studyBook?.editionsV36||record.studyBook.editionsV36.complete){
        setStatus('Nessun libro incompleto trovato nei checkpoint');
        return;
      }
      if(requiresRecalibrationV79(record.studyBook.editionsV36)){
        setLibraryId(record.id);
        setFileName(record.fileName);
        setDocumentData(record.sourceData);
        setSourceFile(record.originalFile||null);
        setStudyBook(record.studyBook);
        setStatus('44/44 pagine esaminate per livello. Bozze conservate: '+
          'aprire Studio e usare «Migliora percentuali e chiarezza».');
        if(!auto)navigateTo('studio');
        return;
      }
      setLibraryId(record.id);
      setFileName(record.fileName);
      setDocumentData(record.sourceData);
      setSourceFile(record.originalFile||null);
      setStudyBook(record.studyBook);
      setProgress({done:record.studyBook.editionsV36.verifiedChunkVariants||0,
        total:record.studyBook.editionsV36.totalChunkVariants||1});
      if(!auto)navigateTo('studio');
      // Recupero in corso must describe ONLY the IndexedDB read. The long
      // Gemini run owns generating/workPhase independently, so the button
      // cannot cycle between two labels while a request is pending.
      setResumeBusy(false);
      void resumeGeminiEditions(record).catch(error=>{
        setError(error?.message||'Ripresa Gemini non riuscita. I checkpoint restano conservati.');
      });
    }finally{setResumeBusy(false);}
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
      // LAB16: conferma visiva soltanto dopo la scrittura verificata.
      setCameraFeedback('✓ Foto acquisita · OCR avviato');
      clearTimeout(cameraFeedbackTimerRef.current);
      cameraFeedbackTimerRef.current = setTimeout(() => setCameraFeedback(''), 1500);
      setStatus(`Pagina ${pageNumber} acquisita in ${((performance.now()-acquisitionStart)/1000).toFixed(1)} s · OCR in background`);
      void refreshScannerStorage();
      return true;
    } catch (err) {
      setCameraFeedback('');
      setError(err.message || 'Non riesco ad aggiungere questa pagina.');
      setStatus('Pagina non aggiunta');
      return false;
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
      // Feedback fotografico immediato: fotogramma acquisito prima dell'OCR.
      setCameraFlash(true);
      clearTimeout(cameraFlashTimerRef.current);
      cameraFlashTimerRef.current = setTimeout(() => setCameraFlash(false), 180);
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
      scanArchivePhotoIds: scanPages.map(page => page.archiveId || page.id),
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
    if (!precisionBook) return;
    if(isExplainedBookV122(studyBook)&&(format==='pdf'||format==='print')){
      return exportExplainedPdfV122(precisionBook,fileName)
        .catch(error=>setError(error?.message||'PDF Libro spiegato non disponibile'));
    }
    if(reduction!==0 && precisionBook.editionReadiness?.partial){
      setError('Questa è un’anteprima LAB36: esportazione disponibile dopo la verifica completa delle sei edizioni.');
      return;
    }
    const options = { dsaMode, variant, accessibility, originalFile: sourceFile };
    if (format === 'pdf') return exportPdf(precisionBook, fileName, options);
    if (format === 'docx') return exportDocx(precisionBook, fileName, options);
    if (format === 'html') return exportHtml(precisionBook, fileName, options);
    if (format === 'epub') return exportEpub(precisionBook, fileName, options);
    if (format === 'odt') return exportOdt(precisionBook, fileName, options);
    if (format === 'rtf') return exportRtf(precisionBook, fileName, options);
    if (format === 'md') return exportMarkdown(precisionBook, fileName, options);
    if (format === 'print') return printStudyBook(precisionBook, fileName, options);
    if (format === 'json') return exportJson(precisionBook, fileName);
    if (format === 'txt') {
      return exportTxt(precisionBook, fileName, dsaMode);
    }
    return undefined;
  }

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || { id: 'default', name: 'Bruno' };

  function openOriginalHome() {
    // LAB15: ultimo originale usato, altrimenti il più recente del profilo.
    const originals = libraryItems.filter(item => item.metadata?.hasOriginal);
    const selected = originals.find(item => item.id === originalRecord?.id) || originals[0];
    if (selected) {
      void openLibraryItem(selected.id, { original: true, openReader: false });
      return;
    }
    // Nessun libro: mostra scelta/importazione nella stessa schermata Libro aperto.
    setOriginalRecord(null);
    setOriginalReading(false);
    setLibraryId('');
    setSourceFile(null);
    setDocumentData(null);
    setStudyBook(null);
    setStudyModeOpen(false);
    setFileName('');
    navigateTo('studio');
  }

  async function refreshArchiveForLibrary() {
    setArchiveBusy(true);
    try { setArchivedScans(await listArchivedScannerPages()); }
    catch (err) { setError(err.message || 'Archivio scansioni non disponibile.'); }
    finally { setArchiveBusy(false); }
  }

  function readOriginalFromBook() {
    if (!originalRecord?.originalFile) { setError('File originale non disponibile.'); return; }
    // LAB15: lettura integrata; non ripresentare la vecchia schermata intermedia.
    setOriginalReading(true);
  }

  async function openOriginalPdfFromBook() {
    if (!originalRecord?.originalFile) { setError('File originale non disponibile.'); return; }
    const name = originalRecord.original?.name || originalRecord.originalFile?.name || originalRecord.fileName;
    try {
      if (/\\.pdf$/i.test(name) || originalRecord.originalFile.type === 'application/pdf') {
        await deliverBlob(originalRecord.originalFile, name, 'Leggi il PDF originale', { preferOpen: true });
      } else {
        await exportOriginal('pdf');
      }
    } catch (err) { setError(err.message || 'Impossibile aprire il PDF originale.'); }
  }

  async function prepareOriginalForStudy() {
    if (generating || importing || libraryBusy) return;
    if (!documentData?.chapters?.some(chapter => chapter.paragraphs?.length)) {
      if (originalRecord?.originalFile) {
        setStatus('Recupero l’acquisizione interrotta dal PDF conservato, senza creare duplicati…');
        await processFile(originalRecord.originalFile,{resumeRecord:originalRecord});
      } else setError('PDF originale non presente: importare nuovamente il documento.');
      return;
    }
    // L'elaborazione è consentita solo dopo il secondo clic esplicito di conferma.
    await createStudyBook(documentData, fileName);
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
    // LAB15: anche gli Originali aprono direttamente la scheda Libro aperto.
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

      <input ref={documentFileInputRef} type="file" hidden accept=".pdf,.docx,.epub,.txt,.html,.htm,.rtf,.odt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,application/rtf,application/vnd.oasis.opendocument.text,text/plain,text/html,text/markdown" onChange={handleFile} />
      {error && <div className="error-box sb-global-error">{error}</div>}

      {activeScreen === 'home' && (
        <HomeDashboardV16
          status={status} importing={importing} generating={generating} libraryItems={libraryItems} archivedScans={archivedScans}
          onImport={() => documentFileInputRef.current?.click()} onScanner={openScanner} onScannerArchive={openScannerArchive} onOpenOriginals={openOriginalHome} onOpenBook={openFromLibrary} onContinueBook={openContinueBook}
          onCategory={view => { setLibraryInitialView(view); navigateTo('library'); }}
          onViewAll={() => { setLibraryInitialView('all'); navigateTo('library'); }}
          onRecentScan={restoreScannerArchiveSelection}
          onOpenOriginal={item => openLibraryItem(item.id, { original:true, openReader:false })}
          documentData={documentData} fileName={fileName} onCreateBook={generateBook} progressPercent={progressPercent}
          scanContent={scannerPanel} workPhase={workPhase} homeAction={homeAction}
          currentBookId={libraryId} acquisitionProgress={importAcquisition}
          resumeCandidate={resumeCandidate} resumeBusy={resumeBusy} geminiStalled={geminiStalled}
          resumeEdition={studyBook?.editionsV36?.complete===false
            ?studyBook.editionsV36:resumeCandidate?.edition||null}
          progressStudyBook={studyBook}
          onResumeProcessing={()=>generating ? navigateTo('studio') : void resumeFromHome()}
          onManualRecovery={()=>generating
            ? (geminiStalled ? requestActiveGeminiRecovery() : setStatus('Gemini sta già lavorando · nessuna richiesta duplicata'))
            : void resumeFromHome()}
        />
      )}

      {activeScreen === 'scans' && <ScannerArchive entries={archivedScans} busy={archiveBusy} onBack={goBack} onRestore={restoreScannerArchiveSelection} onDelete={deleteScannerArchiveSelection} onRenameCollection={renameScannerArchiveCollection} onRenamePhoto={renameScannerArchivePhoto} />}

      {activeScreen === 'library' && <LibraryScreen items={libraryItems} initialView={libraryInitialView} onOpenBook={openFromLibraryCover} onDeleteBook={removeLibraryItem} onRenameBook={renameLibraryBook} onReprocessBook={reprocessLibraryItem} onRecoverOriginal={recoverSourceFromLibrary} processingStatus={status} processingProgress={progress} acquisitionProgress={importAcquisition} onSetCoverFile={chooseLibraryCover} onGenerateCover={findAndApplyLibraryCover} onResetCover={resetLibraryCover} onRefreshScans={refreshArchiveForLibrary}
        scannerProps={{ entries: archivedScans, busy: archiveBusy, onRestore: restoreScannerArchiveSelection, onDelete: deleteScannerArchiveSelection, onRenameCollection: renameScannerArchiveCollection, onRenamePhoto: renameScannerArchivePhoto }} />}
      {activeScreen === 'studio' && (
        <StudioScreen
          studyBook={precisionBook} fileName={fileName} onRenameBook={renameCurrentBook}
          reduction={reduction} onReductionChange={changeReduction} reductionMeta={precisionBook?.precisionEdition}
          isOriginalOnly={!studyBook && Boolean(originalRecord?.id === libraryId && sourceFile)}
          sourceData={documentData} generating={generating} onPrepareOriginal={prepareOriginalForStudy}
          status={status} workPhase={workPhase} geminiStalled={geminiStalled}
          onResumeGemini={()=>void resumeGeminiEditions()}
          onRebalance={()=>void improveReductionV67()}
          originalRecord={originalRecord?.id === libraryId ? originalRecord : null}
          originalReading={originalReading} onCloseOriginalReader={() => setOriginalReading(false)}
          onOpenOriginalNative={openOriginalNative} accessibility={accessibility}
          scannedPhoto={documentData?.sourceFormat === 'scan' ? (archivedScans.find(page => documentData.scanArchivePhotoIds?.includes(page.id))?.blob || archivedScans.find(page => page.collection && fileName.startsWith(page.collection))?.blob || null) : null}
          availableOriginals={libraryItems.filter(item => item.metadata?.hasOriginal)}
          onChooseOriginal={item => openLibraryItem(item.id, { original: true, openReader: false })}
          onImportOriginal={() => documentFileInputRef.current?.click()}
          onRead={() => {
            if (!studyBook && originalRecord?.id === libraryId) { readOriginalFromBook(); return; }
            setStudyEntryMode('reader'); setStudyModeOpen(true);
          }}
          onStudy={() => { setStudyEntryMode('study'); setStudyModeOpen(true); }}
          onExport={(format, variant) => {
            if (!studyBook && originalRecord?.id === libraryId) {
              if (format === 'pdf' && variant === 'original') return openOriginalPdfFromBook();
              return exportOriginal(format);
            }
            return exportCurrentBook(format, variant);
          }}
        />
      )}

      {activeScreen === 'settings' && (
        <SettingsScreen
          settings={accessibility} onSettingsChange={updateAccessibility}
          profiles={profiles.length ? profiles : [activeProfile]} activeProfileId={activeProfileId}
          onProfileChange={setActiveProfileId} onAddProfile={addProfile}
        />
      )}

      <BottomNav active={activeScreen === 'settings' || activeScreen === 'scans' ? 'home' : activeScreen} onChange={screen => { if (screen === 'library') setLibraryInitialView('all'); navigateTo(screen); }} />
      <input ref={cameraFileInputRef} className="camera-fallback-input" type="file" accept="image/*" capture="environment" onChange={handleCameraFallback} />

      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Scanner pagina">
          <div className="camera-sheet">
            <div className="camera-header"><div><span className="eyebrow">SCANNER · PAGINA {scanPages.length + 1}</span><h2>Fotografa la pagina</h2></div><button type="button" className="camera-close" onClick={stopCamera}>×</button></div>
            <div className="camera-stage"><video ref={videoRef} playsInline muted onLoadedMetadata={() => setCameraReady(true)} /><div className="scan-frame" aria-hidden="true" /><div className={cameraFlash ? 'sb-camera-shutter active' : 'sb-camera-shutter'} aria-hidden="true"/></div>
            {cameraFeedback && <div role="status" className="sb-camera-captured">{cameraFeedback}</div>}
            <p className="camera-help">Scatta più pagine di seguito: l’OCR procede mentre fotografi. Le immagini rimangono nell’archivio Scannerizzati.</p>
            <div className="camera-actions"><button type="button" className="secondary-button" onClick={stopCamera}>Fine foto</button><button type="button" className="capture-button" onClick={capturePhoto} disabled={!cameraReady || cameraCapturing}>{cameraCapturing ? 'Acquisizione…' : 'Scatta pagina'}</button></div>
          </div>
        </div>
      )}

      {studyModeOpen && precisionBook && (
        isExplainedBookV122(studyBook)
          ? <ExplainedReaderV122 book={precisionBook} bookId={libraryId}
              bookTitle={fileName} chapterIndex={selectedChapter}
              onClose={()=>setStudyModeOpen(false)}/>
          : <StudyMode
              book={precisionBook} sourceBook={studyBook} originalFile={sourceFile}
              bookTitle={fileName} bookId={libraryId} initialMode={studyEntryMode}
              chapterIndex={selectedChapter} onChapterChange={setSelectedChapter}
              dsaMode={dsaMode} accessibility={accessibility}
              onClose={()=>setStudyModeOpen(false)}
            />
      )}
    </main>
  );
}
