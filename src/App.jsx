import { useEffect, useMemo, useRef, useState } from 'react';
import { readSourceFile } from './lib/documentParser.js';
import { buildStudyBook, summaryLevels } from './lib/studyEngine.js';
import { exportDocx, exportHtml, exportJson, exportPdf, exportTxt } from './lib/exporters.js';

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
  return `scansione-libro-${stamp}.jpg`;
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

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraFileInputRef = useRef(null);

  const paragraphCount = useMemo(
    () => (documentData ? countParagraphs(documentData.chapters) : 0),
    [documentData],
  );

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
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
    if (importing || generating) return;
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
      setStatus('Scanner pronto · inquadra la pagina');
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
    setStatus(fromScanner ? 'Foto letta · preparo automaticamente il riassunto DSA…' : 'Creazione del libro di studio…');
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
          ? 'Scansione pronta · riassunto DSA creato · PDF pronto da scaricare'
          : 'Scansione pronta · sintesi locale DSA · PDF pronto da scaricare');
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

  async function processFile(file, { autoGenerate = false, fromScanner = false } = {}) {
    if (!file) return;

    setError('');
    setStatus(fromScanner ? 'Analisi della fotografia…' : 'Analisi del documento…');
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
        setStatus(fromScanner ? 'Foto riconosciuta con OCR' : `Documento analizzato · OCR completato su ${recovered} pagine`);
      } else {
        setStatus('Documento analizzato');
      }

      if (autoGenerate) {
        await createStudyBook(parsed, file.name, { fromScanner });
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
    await processFile(file, { autoGenerate: false, fromScanner: false });
    event.target.value = '';
  }

  async function handleCameraFallback(event) {
    const file = event.target.files?.[0];
    if (file) await processFile(file, { autoGenerate: true, fromScanner: true });
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
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Impossibile acquisire la foto.')), 'image/jpeg', 0.94);
      });
      const file = new File([blob], scanFileName(), { type: 'image/jpeg' });
      canvas.width = 1;
      canvas.height = 1;
      stopCamera();
      await processFile(file, { autoGenerate: true, fromScanner: true });
    } catch (err) {
      setCameraCapturing(false);
      setError(err.message || 'Errore durante lo scatto.');
      setStatus('Errore scanner');
    }
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
          <span className="eyebrow">STUDYBOOK AI · v0.4</span>
          <h1>Trasforma un libro in un libro di studio.</h1>
          <p>
            Importa un documento oppure fotografa direttamente una pagina: StudyBook AI estrae il testo,
            lo riassume, crea la versione DSA e prepara un nuovo PDF pronto da scaricare.
          </p>
        </div>
        <div className="status-pill">{status}</div>
      </header>

      <section className="panel import-panel">
        <div>
          <h2>1. Importa o scansiona</h2>
          <p>PDF, TXT e immagini. Con Scanner fotografi la pagina e parte automaticamente OCR → riassunto → DSA → PDF.</p>
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
            disabled={importing || generating}
            aria-label="Apri scanner con fotocamera"
          >
            <span aria-hidden="true">📷</span>
            Scanner
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

      {scannerResultReady && studyBook && (
        <section className="panel scan-ready-panel">
          <div>
            <span className="eyebrow dark">SCANSIONE COMPLETATA</span>
            <h2>La pagina è già diventata un PDF di studio.</h2>
            <p>OCR, riassunto e modalità DSA sono stati applicati automaticamente. Puoi controllare il risultato sotto oppure scaricarlo subito.</p>
          </div>
          <button type="button" className="primary-button ready-download" onClick={() => exportPdf(studyBook, fileName, true)}>
            Scarica PDF pronto
          </button>
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

      {!documentData && !importing && (
        <section className="empty-state panel">
          <h2>Carica un libro oppure fotografa una pagina</h2>
          <p>Lo scanner può trasformare una fotografia in un riassunto DSA e in un nuovo PDF senza passaggi manuali intermedi.</p>
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
                <span className="eyebrow">SCANNER</span>
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
            <p className="camera-help">Tieni il foglio diritto, ben illuminato e dentro il riquadro. Dopo lo scatto partiranno automaticamente OCR, riassunto, DSA e preparazione del PDF.</p>
            <div className="camera-actions">
              <button type="button" className="secondary-button" onClick={stopCamera}>Annulla</button>
              <button type="button" className="capture-button" onClick={capturePhoto} disabled={!cameraReady || cameraCapturing}>
                {cameraCapturing ? 'Acquisizione…' : 'Scatta e crea PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
