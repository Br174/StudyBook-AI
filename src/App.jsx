import { useEffect, useMemo, useRef, useState } from 'react';
import { detectChapters, readSourceFile } from './lib/documentParser.js';
import { buildStudyBook, summaryLevels } from './lib/studyEngine.js';
import { exportDocx, exportHtml, exportJson, exportPdf, exportTxt, printStudyBook } from './lib/exporters.js';

function countParagraphs(chapters = []) {
  return chapters.reduce((total, chapter) => total + chapter.paragraphs.length, 0);
}

function importStatus(update) {
  if (!update) return 'Analisi del documento…';
  if (update.phase === 'extract') return `Lettura PDF · pagina ${update.done}/${update.total}`;
  if (update.phase === 'ocr-loading') return 'Avvio OCR per il testo fotografato/scansionato…';
  if (update.phase === 'ocr-page') return `OCR · ${update.done}/${update.total} pagine · pagina ${update.pageNumber}`;
  if (update.phase === 'ocr-recognize') return `OCR · riconoscimento ${Math.round((update.fraction || 0) * 100)}%`;
  if (update.phase === 'complete') return 'Ricostruzione della struttura…';
  return 'Analisi del documento…';
}

function scanFileName() {
  const stamp = new Date().toISOString().replace(/[.:]/g, '-');
  return `pagina-${stamp}.jpg`;
}

function scanId() {
  return globalThis.crypto?.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sessionFileName(name, count) {
  const base = String(name || 'Scansione libro').trim() || 'Scansione libro';
  return `${base} - ${count} pagine.pdf`;
}

export default function App() {
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraCapturing, setCameraCapturing] = useState(false);
  const [scannerResultReady, setScannerResultReady] = useState(false);
  const [scanPages, setScanPages] = useState([]);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [scanSessionName, setScanSessionName] = useState('Appunti fotografati');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraFileInputRef = useRef(null);
  const scanPagesRef = useRef([]);

  const paragraphCount = useMemo(
    () => (documentData ? countParagraphs(documentData.chapters) : 0),
    [documentData],
  );

  const scanReadyCount = useMemo(
    () => scanPages.filter((page) => page.status === 'ready').length,
    [scanPages],
  );

  const scanHasErrors = useMemo(
    () => scanPages.some((page) => page.status === 'error'),
    [scanPages],
  );

  useEffect(() => {
    scanPagesRef.current = scanPages;
  }, [scanPages]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    scanPagesRef.current.forEach((page) => {
      if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
    });
  }, []);

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
    setScannerResultReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileInputRef.current?.click();
      return;
    }

    try {
      setStatus('Apertura scanner…');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setStatus(`Scanner pronto · prossima pagina ${scanPages.length + 1}`);
    } catch {
      setStatus('Apro la fotocamera del dispositivo…');
      cameraFileInputRef.current?.click();
    }
  }

  async function createStudyBook(sourceData, sourceName, { fromScanner = false } = {}) {
    if (!sourceData || generating) return null;
    const total = countParagraphs(sourceData.chapters);
    setError('');
    setGenerating(true);
    setDsaMode(true);
    setStatus(fromScanner
      ? 'Scansione completa · preparo riassunto, DSA e impaginazione…'
      : 'Creazione del libro di studio…');
    setProgress({ done: 0, total });

    try {
      const result = await buildStudyBook(sourceData, {
        level,
        preferAi: true,
        onProgress(done, progressTotal) {
          setProgress({ done, total: progressTotal });
        },
      });
      setStudyBook(result);
      localStorage.setItem('studybook:last', JSON.stringify({ fileName: sourceName, book: result }));

      if (fromScanner) {
        setScannerResultReady(true);
        setStatus(result.engine === 'ai'
          ? 'Raccolta pronta · riassunto DSA creato · PDF pronto'
          : 'Raccolta pronta · sintesi locale DSA · PDF pronto');
      } else {
        setStatus(result.engine === 'ai' ? 'Libro di studio creato con AI' : 'Libro di studio creato · modalità locale');
      }
      return result;
    } catch (err) {
      setError(err.message || 'Errore durante la creazione del libro di studio.');
      setStatus('Errore');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function processFile(file) {
    if (!file) return;

    setError('');
    setStatus('Analisi del documento…');
    setFileName(file.name);
    setStudyBook(null);
    setDocumentData(null);
    setScannerResultReady(false);
    setProgress({ done: 0, total: 0 });
    setImporting(true);

    try {
      const parsed = await readSourceFile(file, {
        autoOcr: true,
        onProgress(update) {
          setStatus(importStatus(update));
        },
      });
      setDocumentData(parsed);
      setSelectedChapter(0);

      const recovered = parsed.ocrApplied?.length || 0;
      const unresolved = parsed.needsOcr?.length || 0;
      if (unresolved) {
        setStatus(`Documento analizzato · OCR recuperato su ${recovered} pagine · ${unresolved} da verificare`);
      } else if (recovered) {
        setStatus(`Documento analizzato · OCR completato su ${recovered} pagine`);
      } else {
        setStatus('Documento analizzato');
      }
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

  function patchScanPage(id, patch) {
    setScanPages((pages) => pages.map((page) => (page.id === id ? { ...page, ...patch } : page)));
  }

  async function recognizeScanPage(id, file, pageNumber) {
    setScanProcessing(true);
    patchScanPage(id, { status: 'processing', error: '' });
    setStatus(`Pagina ${pageNumber} · OCR in corso…`);

    try {
      const parsed = await readSourceFile(file, {
        autoOcr: true,
        onProgress(update) {
          if (update?.phase === 'ocr-recognize') {
            setStatus(`Pagina ${pageNumber} · OCR ${Math.round((update.fraction || 0) * 100)}%`);
          }
        },
      });
      patchScanPage(id, {
        status: 'ready',
        parsed,
        text: parsed.fullText,
        error: '',
      });
      setStatus(`Pagina ${pageNumber} pronta · controlla oppure aggiungi la successiva`);
      return parsed;
    } catch (err) {
      patchScanPage(id, {
        status: 'error',
        error: err.message || 'Testo non riconosciuto. Riprova la foto.',
      });
      setStatus(`Pagina ${pageNumber} da rifare`);
      return null;
    } finally {
      setScanProcessing(false);
    }
  }

  async function addScanPage(file) {
    if (!file || scanProcessing) return;
    const id = scanId();
    const previewUrl = URL.createObjectURL(file);
    const pageNumber = scanPages.length + 1;

    setScannerResultReady(false);
    setScanPages((pages) => [
      ...pages,
      {
        id,
        file,
        previewUrl,
        status: 'processing',
        parsed: null,
        text: '',
        error: '',
      },
    ]);

    await recognizeScanPage(id, file, pageNumber);
  }

  async function handleCameraFallback(event) {
    const file = event.target.files?.[0];
    if (file) await addScanPage(file);
    event.target.value = '';
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || cameraCapturing) return;
    setCameraCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d', { alpha: false });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error('Impossibile acquisire la foto.')),
          'image/jpeg',
          0.94,
        );
      });
      const file = new File([blob], scanFileName(), { type: 'image/jpeg' });
      canvas.width = 1;
      canvas.height = 1;
      stopCamera();
      await addScanPage(file);
    } catch (err) {
      setCameraCapturing(false);
      setError(err.message || 'Errore durante lo scatto.');
      setStatus('Errore scanner');
    }
  }

  function moveScanPage(index, direction) {
    setScanPages((pages) => {
      const target = index + direction;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeScanPage(id) {
    if (scanProcessing || generating) return;
    setScanPages((pages) => {
      const page = pages.find((item) => item.id === id);
      if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
      return pages.filter((item) => item.id !== id);
    });
    setScannerResultReady(false);
    setStatus('Pagina rimossa dalla raccolta');
  }

  async function retryScanPage(id) {
    if (scanProcessing || generating) return;
    const page = scanPages.find((item) => item.id === id);
    const index = scanPages.findIndex((item) => item.id === id);
    if (!page) return;
    await recognizeScanPage(id, page.file, index + 1);
  }

  function clearScanSession() {
    if (scanProcessing || generating) return;
    scanPages.forEach((page) => {
      if (page.previewUrl) URL.revokeObjectURL(page.previewUrl);
    });
    setScanPages([]);
    setScannerResultReady(false);
    setStatus('Raccolta scansioni svuotata');
  }

  async function finishScanSession() {
    if (!scanPages.length || scanProcessing || generating) return;
    if (scanPages.some((page) => page.status !== 'ready' || !page.parsed?.fullText)) {
      setError('Prima di terminare, correggi o elimina le pagine che non sono state riconosciute.');
      return;
    }

    const pages = scanPages.map((page, index) => ({
      pageNumber: index + 1,
      text: page.parsed.fullText,
      source: 'camera-ocr',
    }));
    const fullText = pages.map((page) => page.text).join('\n\n');
    const sourceData = {
      fullText,
      pages,
      chapters: detectChapters(fullText),
      needsOcr: [],
      ocrApplied: pages.map((page) => page.pageNumber),
      scanCount: pages.length,
    };
    const sourceName = sessionFileName(scanSessionName, pages.length);

    setError('');
    setFileName(sourceName);
    setDocumentData(sourceData);
    setStudyBook(null);
    setSelectedChapter(0);
    setProgress({ done: 0, total: 0 });
    await createStudyBook(sourceData, sourceName, { fromScanner: true });
  }

  async function generateBook() {
    if (!documentData || generating) return;
    await createStudyBook(documentData, fileName, { fromScanner: false });
  }

  const originalChapter = documentData?.chapters?.[selectedChapter];
  const generatedChapter = studyBook?.chapters?.[selectedChapter];
  const visibleChapter = generatedChapter || originalChapter;
  const progressPercent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  function speakChapter() {
    if (!visibleChapter) return;
    const text = generatedChapter
      ? generatedChapter.paragraphs.map((item) => dsaMode ? (item.dsaSummary || item.summary) : item.summary).join(' ')
      : originalChapter.paragraphs.join(' ');
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">STUDYBOOK AI · v0.5</span>
          <h1>Trasforma un libro in un libro di studio.</h1>
          <p>
            Importa un documento oppure fotografa più pagine una alla volta. Ogni foto viene letta con OCR,
            entra nella tua raccolta, può essere controllata e riordinata, poi viene trasformata in un unico libro DSA esportabile.
          </p>
        </div>
        <div className="status-pill">{status}</div>
      </header>

      <section className="panel import-panel">
        <div>
          <h2>1. Importa o scansiona</h2>
          <p>PDF, TXT e immagini. Lo Scanner multipagina crea una cartellina temporanea: pagina 1, pagina 2, pagina 3… poi “Fine scansione”.</p>
        </div>
        <div className="import-actions">
          <label className={importing ? 'upload-button disabled' : 'upload-button'}>
            {importing ? 'Analisi in corso…' : 'Scegli file'}
            <input
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,image/png,image/jpeg,image/webp"
              onChange={handleFile}
              disabled={importing}
            />
          </label>
          <button
            type="button"
            className="scanner-button"
            onClick={openScanner}
            disabled={importing || generating || scanProcessing}
            aria-label="Apri scanner multipagina"
          >
            <span aria-hidden="true">📷</span>
            {scanPages.length ? 'Aggiungi pagina' : 'Scanner'}
          </button>
          <input
            ref={cameraFileInputRef}
            className="camera-fallback-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCameraFallback}
          />
        </div>
        {fileName && <div className="file-name">{fileName}</div>}
        {error && <div className="error-box">{error}</div>}
      </section>

      {scanPages.length > 0 && (
        <section className="panel scan-basket">
          <div className="scan-basket-head">
            <div>
              <span className="eyebrow dark">CARTELLINA SCANSIONI</span>
              <h2>{scanPages.length} {scanPages.length === 1 ? 'pagina' : 'pagine'} · {scanReadyCount} pronte</h2>
              <p>Controlla l'ordine e il testo riconosciuto. Il riassunto viene creato solo alla fine, così l'AI vede tutte le pagine insieme.</p>
            </div>
            <label className="scan-name-field">
              Nome raccolta
              <input value={scanSessionName} onChange={(event) => setScanSessionName(event.target.value)} maxLength={80} />
            </label>
          </div>

          <div className="scan-page-grid">
            {scanPages.map((page, index) => (
              <article className={`scan-page-card ${page.status}`} key={page.id}>
                <div className="scan-thumb-wrap">
                  <img className="scan-thumb" src={page.previewUrl} alt={`Pagina ${index + 1}`} />
                  <span className="scan-page-number">{index + 1}</span>
                </div>
                <div className="scan-page-body">
                  <div className="scan-page-title">
                    <strong>Pagina {index + 1}</strong>
                    <span className={`scan-status ${page.status}`}>
                      {page.status === 'ready' ? 'Pronta' : page.status === 'error' ? 'Da rifare' : 'OCR…'}
                    </span>
                  </div>

                  {page.status === 'ready' && (
                    <details className="scan-text-preview">
                      <summary>Controlla testo OCR</summary>
                      <p>{page.text}</p>
                    </details>
                  )}

                  {page.status === 'error' && (
                    <div className="scan-page-error">{page.error}</div>
                  )}

                  <div className="scan-page-actions">
                    <button type="button" onClick={() => moveScanPage(index, -1)} disabled={index === 0 || scanProcessing}>↑</button>
                    <button type="button" onClick={() => moveScanPage(index, 1)} disabled={index === scanPages.length - 1 || scanProcessing}>↓</button>
                    {page.status === 'error' && (
                      <button type="button" onClick={() => retryScanPage(page.id)} disabled={scanProcessing}>Riprova OCR</button>
                    )}
                    <button type="button" className="danger-link" onClick={() => removeScanPage(page.id)} disabled={scanProcessing}>Elimina</button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="scan-basket-actions">
            <button type="button" className="secondary-button" onClick={clearScanSession} disabled={scanProcessing || generating}>Svuota</button>
            <button type="button" className="scanner-button" onClick={openScanner} disabled={scanProcessing || generating}>📷 Aggiungi pagina</button>
            <button
              type="button"
              className="primary-button finish-scan-button"
              onClick={finishScanSession}
              disabled={scanProcessing || generating || scanHasErrors || scanReadyCount !== scanPages.length}
            >
              {generating ? `Elaborazione ${progressPercent}%` : 'Fine scansione · Crea libro PDF'}
            </button>
          </div>
          {scanHasErrors && <p className="scan-warning">Correggi o elimina le pagine segnate “Da rifare” prima di terminare.</p>}
        </section>
      )}

      {scannerResultReady && studyBook && (
        <section className="panel scan-ready-panel">
          <div>
            <span className="eyebrow dark">RACCOLTA COMPLETATA</span>
            <h2>Le pagine sono diventate un unico libro di studio.</h2>
            <p>OCR, riassunto, modalità DSA e impaginazione sono stati applicati all'intera raccolta. Puoi scaricare, stampare o esportare.</p>
          </div>
          <div className="ready-actions">
            <button type="button" className="primary-button ready-download" onClick={() => exportPdf(studyBook, fileName, true)}>Scarica PDF</button>
            <button type="button" className="secondary-button" onClick={() => printStudyBook(studyBook, fileName, true)}>Stampa</button>
          </div>
        </section>
      )}

      {documentData && (
        <>
          <section className="stats-grid">
            <article className="stat-card"><span>Capitoli</span><strong>{documentData.chapters.length}</strong></article>
            <article className="stat-card"><span>Paragrafi</span><strong>{paragraphCount}</strong></article>
            <article className="stat-card"><span>Pagine recuperate con OCR</span><strong>{documentData.ocrApplied?.length || 0}</strong></article>
            <article className="stat-card"><span>Pagine da verificare</span><strong>{documentData.needsOcr.length}</strong></article>
          </section>

          <section className="panel study-controls">
            <div>
              <span className="eyebrow dark">MOTORE DI STUDIO</span>
              <h2>3. Crea il nuovo libro</h2>
              <p>Il motore prova prima l'endpoint AI. Se non è configurato, usa automaticamente una sintesi locale dichiarata, senza fingere che sia AI.</p>
            </div>
            <label>
              Livello di sintesi
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {Object.entries(summaryLevels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </label>
            <label className="toggle-row">
              <input type="checkbox" checked={dsaMode} onChange={(event) => setDsaMode(event.target.checked)} />
              Modalità DSA
            </label>
            <button type="button" className="primary-button" onClick={generateBook} disabled={generating || importing}>
              {generating ? `Elaborazione ${progressPercent}%` : (studyBook ? 'Rigenera libro' : 'Crea libro di studio')}
            </button>
            {generating && (
              <div className="progress-wrap">
                <div className="progress-bar"><span style={{ width: `${progressPercent}%` }} /></div>
                <small>{progress.done} / {progress.total} paragrafi</small>
              </div>
            )}
          </section>

          {studyBook && (
            <section className="panel export-bar">
              <div>
                <span className="eyebrow dark">ESPORTA</span>
                <strong>{studyBook.engine === 'ai' ? 'Motore AI' : 'Modalità locale di sicurezza'}</strong>
              </div>
              <div className="export-actions">
                <button type="button" onClick={() => exportPdf(studyBook, fileName, dsaMode)}>PDF</button>
                <button type="button" onClick={() => printStudyBook(studyBook, fileName, dsaMode)}>Stampa</button>
                <button type="button" onClick={() => exportDocx(studyBook, fileName, dsaMode)}>DOCX</button>
                <button type="button" onClick={() => exportHtml(studyBook, fileName, dsaMode)}>HTML</button>
                <button type="button" onClick={() => exportTxt(studyBook, fileName, dsaMode)}>TXT</button>
                <button type="button" onClick={() => exportJson(studyBook, fileName)}>JSON</button>
              </div>
            </section>
          )}

          <section className="workspace">
            <aside className="panel chapter-list">
              <h2>2. Struttura</h2>
              {documentData.chapters.map((chapter, index) => (
                <button
                  type="button"
                  key={`${chapter.title}-${index}`}
                  className={index === selectedChapter ? 'chapter-button active' : 'chapter-button'}
                  onClick={() => setSelectedChapter(index)}
                >
                  <span>{chapter.title}</span>
                  <small>{chapter.paragraphs.length} paragrafi</small>
                </button>
              ))}
            </aside>

            <section className="panel reader-panel">
              <div className="reader-heading">
                <div>
                  <span className="eyebrow dark">{studyBook ? 'LIBRO DI STUDIO' : 'TESTO ORIGINALE'}</span>
                  <h2>{visibleChapter?.title}</h2>
                </div>
                <button type="button" className="secondary-button" onClick={speakChapter}>Leggi capitolo</button>
              </div>

              <div className="paragraph-stack">
                {visibleChapter?.paragraphs.map((paragraph, index) => {
                  if (!studyBook) {
                    return (
                      <article className="paragraph-card" key={index}>
                        <div className="paragraph-number">{index + 1}</div>
                        <p>{paragraph}</p>
                        <div className="future-tag">Pronto per sintesi e modalità DSA</div>
                      </article>
                    );
                  }

                  const text = dsaMode ? (paragraph.dsaSummary || paragraph.summary) : paragraph.summary;
                  return (
                    <article className={dsaMode ? 'paragraph-card dsa-card' : 'paragraph-card'} key={index}>
                      <div className="paragraph-number">{index + 1}</div>
                      <p className="summary-text">{text}</p>
                      {paragraph.keywords?.length > 0 && (
                        <div className="chips">{paragraph.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>
                      )}
                      {paragraph.keyPoints?.length > 0 && (
                        <div className="study-box">
                          <strong>Punti chiave</strong>
                          <ul>{paragraph.keyPoints.map((point, i) => <li key={i}>{point}</li>)}</ul>
                        </div>
                      )}
                      {paragraph.remember?.length > 0 && (
                        <div className="remember-box">
                          <strong>Da ricordare</strong>
                          <ul>{paragraph.remember.map((point, i) => <li key={i}>{point}</li>)}</ul>
                        </div>
                      )}
                      <details className="original-details">
                        <summary>Mostra testo originale</summary>
                        <p>{paragraph.original}</p>
                      </details>
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
        </>
      )}

      {!documentData && !importing && scanPages.length === 0 && (
        <section className="empty-state panel">
          <h2>Carica un libro oppure avvia lo scanner</h2>
          <p>Con lo scanner multipagina raccogli prima tutte le fotografie, controlli il risultato e solo alla fine crei un unico PDF di studio.</p>
        </section>
      )}

      {importing && (
        <section className="empty-state panel">
          <h2>{status}</h2>
          <p>Il testo viene riconosciuto, organizzato e preparato per il motore di studio.</p>
        </section>
      )}

      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Scanner pagina">
          <div className="camera-sheet">
            <div className="camera-header">
              <div>
                <span className="eyebrow">SCANNER · PAGINA {scanPages.length + 1}</span>
                <h2>Fotografa la pagina</h2>
              </div>
              <button type="button" className="camera-close" onClick={stopCamera} aria-label="Chiudi scanner">×</button>
            </div>
            <div className="camera-stage">
              <video
                ref={videoRef}
                playsInline
                muted
                onLoadedMetadata={() => setCameraReady(true)}
              />
              <div className="scan-frame" aria-hidden="true" />
            </div>
            <p className="camera-help">Tieni il foglio diritto, ben illuminato e dentro il riquadro. Dopo lo scatto la pagina viene letta con OCR e messa nella cartellina; potrai controllarla prima di creare il PDF finale.</p>
            <div className="camera-actions">
              <button type="button" className="secondary-button" onClick={stopCamera}>Annulla</button>
              <button type="button" className="capture-button" onClick={capturePhoto} disabled={!cameraReady || cameraCapturing}>
                {cameraCapturing ? 'Acquisizione…' : 'Scatta pagina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
