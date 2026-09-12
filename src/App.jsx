import { useMemo, useState } from 'react';
import { readSourceFile } from './lib/documentParser.js';

function countParagraphs(chapters) {
  return chapters.reduce((total, chapter) => total + chapter.paragraphs.length, 0);
}

export default function App() {
  const [documentData, setDocumentData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('Pronto');
  const [error, setError] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(0);

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

  const currentChapter = documentData?.chapters?.[selectedChapter];

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">STUDYBOOK AI · v0.1</span>
          <h1>Trasforma un libro in un libro di studio.</h1>
          <p>
            Importa un PDF o un TXT, riconosci la struttura e prepara il contenuto per riassunti,
            modalità DSA, lettura vocale ed esportazione.
          </p>
        </div>
        <div className="status-pill">{status}</div>
      </header>

      <section className="panel import-panel">
        <div>
          <h2>1. Importa il libro</h2>
          <p>Prima base reale: PDF e TXT. DOCX ed EPUB arriveranno nelle prossime versioni.</p>
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
            <article className="stat-card">
              <span>Capitoli</span>
              <strong>{documentData.chapters.length}</strong>
            </article>
            <article className="stat-card">
              <span>Paragrafi</span>
              <strong>{paragraphCount}</strong>
            </article>
            <article className="stat-card">
              <span>Pagine con possibile OCR</span>
              <strong>{documentData.needsOcr.length}</strong>
            </article>
          </section>

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
                  <span className="eyebrow">TESTO ORIGINALE</span>
                  <h2>{currentChapter?.title}</h2>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (!currentChapter) return;
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(currentChapter.paragraphs.join(' '));
                    utterance.lang = 'it-IT';
                    window.speechSynthesis.speak(utterance);
                  }}
                >
                  Leggi capitolo
                </button>
              </div>

              <div className="paragraph-stack">
                {currentChapter?.paragraphs.map((paragraph, index) => (
                  <article className="paragraph-card" key={index}>
                    <div className="paragraph-number">{index + 1}</div>
                    <p>{paragraph}</p>
                    <div className="future-tag">Riassunto AI · DSA · punti chiave — prossimo step</div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </>
      )}

      {!documentData && (
        <section className="empty-state panel">
          <h2>La base del progetto è pronta</h2>
          <p>
            Carica un documento per verificare estrazione testo, riconoscimento capitoli e suddivisione in paragrafi.
          </p>
        </section>
      )}
    </main>
  );
}
