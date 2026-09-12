import { useMemo, useState } from 'react';
import { readSourceFile } from './lib/documentParser.js';
import { buildStudyBook, summaryLevels } from './lib/studyEngine.js';
import { exportDocx, exportHtml, exportJson, exportPdf, exportTxt } from './lib/exporters.js';

function countParagraphs(chapters) {
  return chapters.reduce((total, chapter) => total + chapter.paragraphs.length, 0);
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

  const paragraphCount = useMemo(
    () => (documentData ? countParagraphs(documentData.chapters) : 0),
    [documentData],
  );

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setStatus('Analisi del documento…');
    setFileName(file.name);
    setStudyBook(null);
    setProgress({ done: 0, total: 0 });
    try {
      const parsed = await readSourceFile(file);
      setDocumentData(parsed);
      setSelectedChapter(0);
      setStatus('Documento analizzato');
    } catch (err) {
      setError(err.message || 'Errore durante la lettura del documento.');
      setStatus('Errore');
    }
  }

  async function generateBook() {
    if (!documentData || generating) return;
    setError('');
    setGenerating(true);
    setStatus('Creazione del libro di studio…');
    setProgress({ done: 0, total: paragraphCount });
    try {
      const result = await buildStudyBook(documentData, {
        level,
        preferAi: true,
        onProgress(done, total) {
          setProgress({ done, total });
        },
      });
      setStudyBook(result);
      localStorage.setItem('studybook:last', JSON.stringify({ fileName, book: result }));
      setStatus(result.engine === 'ai' ? 'Libro di studio creato con AI' : 'Libro di studio creato · modalità locale');
    } catch (err) {
      setError(err.message || 'Errore durante la creazione del libro di studio.');
      setStatus('Errore');
    } finally {
      setGenerating(false);
    }
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
          <span className="eyebrow">STUDYBOOK AI · v0.2</span>
          <h1>Trasforma un libro in un libro di studio.</h1>
          <p>
            Importa il documento, riconosci capitoli e paragrafi, genera una sintesi strutturata,
            attiva la modalità DSA e ricostruisci un nuovo libro esportabile.
          </p>
        </div>
        <div className="status-pill">{status}</div>
      </header>

      <section className="panel import-panel">
        <div>
          <h2>1. Importa il libro</h2>
          <p>PDF e TXT sono già attivi. Le pagine con poco testo vengono segnalate per il futuro passaggio OCR.</p>
        </div>
        <label className="upload-button">
          Scegli file
          <input type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFile} />
        </label>
        {fileName && <div className="file-name">{fileName}</div>}
        {error && <div className="error-box">{error}</div>}
      </section>

      {documentData && (
        <>
          <section className="stats-grid">
            <article className="stat-card"><span>Capitoli</span><strong>{documentData.chapters.length}</strong></article>
            <article className="stat-card"><span>Paragrafi</span><strong>{paragraphCount}</strong></article>
            <article className="stat-card"><span>Pagine con possibile OCR</span><strong>{documentData.needsOcr.length}</strong></article>
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
            <button type="button" className="primary-button" onClick={generateBook} disabled={generating}>
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

      {!documentData && (
        <section className="empty-state panel">
          <h2>La base del progetto è pronta</h2>
          <p>Carica un documento per iniziare dalla struttura reale del libro.</p>
        </section>
      )}
    </main>
  );
}
