import { useEffect, useMemo, useRef, useState } from 'react';
import { askStudyAssistant, STUDY_ACTIONS } from '../lib/studyAssistant.js';
import { buildConceptMap, buildFlashcards, buildOralQuestions, buildQuiz } from '../lib/studyTools.js';
import '../studyMode.css';
import '../studyTools.css';

function pageRange(start, end) {
  if (!Number.isFinite(start)) return '';
  if (!Number.isFinite(end) || end === start) return `p. ${start}`;
  return `pp. ${start}–${end}`;
}

function speak(text) {
  const value = String(text || '').trim();
  if (!value || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = 'it-IT';
  window.speechSynthesis.speak(utterance);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordWords(keywords = []) {
  const set = new Set();
  keywords.forEach((keyword) => {
    String(keyword || '').split(/[^\p{L}\p{N}]+/u).forEach((part) => {
      const word = part.trim().toLocaleLowerCase('it-IT');
      if (word.length >= 4) set.add(word);
    });
  });
  return set;
}

function cleanGlossary(entries = []) {
  const seen = new Set();
  const output = [];
  for (const entry of entries || []) {
    const term = String(entry?.term || '').trim();
    const definition = String(entry?.definition || '').trim();
    if (!term || !definition) continue;
    const key = term.toLocaleLowerCase('it-IT');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      term,
      definition,
      placement: entry?.placement === 'inline' ? 'inline' : 'side',
      basis: entry?.basis || 'source',
    });
  }
  return output;
}

function InteractiveText({ text, keywords, glossary, onPick }) {
  const ref = useRef(null);
  const strongWords = useMemo(() => keywordWords(keywords), [keywords]);
  const glossaryEntries = useMemo(() => cleanGlossary(glossary), [glossary]);
  const glossaryMap = useMemo(
    () => new Map(glossaryEntries.map((entry) => [entry.term.toLocaleLowerCase('it-IT'), entry])),
    [glossaryEntries],
  );
  const segments = useMemo(() => {
    const value = String(text || '');
    if (!glossaryEntries.length) return [value];
    const terms = glossaryEntries
      .map((entry) => entry.term)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    if (!terms.length) return [value];
    return value.split(new RegExp(`(${terms.join('|')})`, 'giu'));
  }, [text, glossaryEntries]);

  function useSelection() {
    const selection = window.getSelection?.();
    const value = selection?.toString?.().trim();
    if (!value || value.length > 1400 || !ref.current) return;
    const anchor = selection.anchorNode;
    const focus = selection.focusNode;
    if ((anchor && ref.current.contains(anchor)) || (focus && ref.current.contains(focus))) {
      onPick(value, null);
    }
  }

  const shownInline = new Set();

  function renderPlainSegment(value, segmentIndex) {
    const chunks = String(value || '').split(/(\p{L}[\p{L}\p{M}\p{N}'’\-]*|\p{N}+(?:[.,]\p{N}+)*)/gu);
    return chunks.map((chunk, index) => {
      if (!chunk) return null;
      const isWord = /^[\p{L}\p{N}]/u.test(chunk);
      if (!isWord) return <span key={`${segmentIndex}-plain-${index}`}>{chunk}</span>;
      const emphasized = strongWords.has(chunk.toLocaleLowerCase('it-IT'));
      return (
        <button
          type="button"
          className={emphasized ? 'study-word emphasized' : 'study-word'}
          key={`${segmentIndex}-${chunk}-${index}`}
          onClick={() => onPick(chunk, null)}
        >
          {chunk}
        </button>
      );
    });
  }

  return (
    <p
      ref={ref}
      className="study-interactive-text"
      onMouseUp={useSelection}
      onTouchEnd={() => window.setTimeout(useSelection, 0)}
    >
      {segments.map((segment, segmentIndex) => {
        const entry = glossaryMap.get(String(segment || '').toLocaleLowerCase('it-IT'));
        if (!entry) return renderPlainSegment(segment, segmentIndex);

        const key = entry.term.toLocaleLowerCase('it-IT');
        const showInline = entry.placement === 'inline' && !shownInline.has(key);
        if (showInline) shownInline.add(key);
        const emphasized = strongWords.has(key) || entry.term.split(/\s+/).some((word) => strongWords.has(word.toLocaleLowerCase('it-IT')));

        return (
          <span className="study-glossary-inline-wrap" key={`${entry.term}-${segmentIndex}`}>
            <button
              type="button"
              className={`study-word glossary-term${emphasized ? ' emphasized' : ''}`}
              onClick={() => onPick(segment, entry)}
            >
              {segment}
            </button>
            {showInline && <span className="study-inline-definition"> ({entry.definition})</span>}
          </span>
        );
      })}
    </p>
  );
}

function EmptyTool({ children }) {
  return <div className="study-tool-empty">{children}</div>;
}

export default function StudyMode({ book, chapterIndex, onChapterChange, dsaMode, onClose }) {
  const [target, setTarget] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [question, setQuestion] = useState('');
  const [tool, setTool] = useState('reader');
  const [toolIndex, setToolIndex] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [quizChoice, setQuizChoice] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [oralRevealed, setOralRevealed] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem('studybook:auto-speak-help') === '1'; } catch { return false; }
  });

  const chapter = book?.chapters?.[chapterIndex];
  const chapterCount = book?.chapters?.length || 0;
  const flashcards = useMemo(() => buildFlashcards(chapter || {}), [chapter]);
  const quiz = useMemo(() => buildQuiz(chapter || {}), [chapter]);
  const oralQuestions = useMemo(() => buildOralQuestions(chapter || {}), [chapter]);
  const conceptMap = useMemo(() => buildConceptMap(chapter || {}), [chapter]);

  useEffect(() => {
    setToolIndex(0);
    setFlashRevealed(false);
    setQuizChoice(null);
    setQuizScore(0);
    setOralRevealed(false);
    setTarget(null);
  }, [chapterIndex, tool]);

  function openTarget(selection, paragraph, glossaryEntry = null) {
    const value = String(selection || '').trim();
    if (!value) return;
    setTarget({
      selection: value.slice(0, 1400),
      sourceText: paragraph.original || '',
      summary: paragraph.summary || '',
      chapterTitle: chapter?.title || '',
      sectionTitle: paragraph.sourceSection || '',
      glossaryEntry,
    });
    setAnswer(glossaryEntry ? {
      answer: glossaryEntry.definition,
      label: glossaryEntry.placement === 'inline' ? 'Significato breve' : 'Definizione contestuale',
      basis: glossaryEntry.basis || 'source',
      glossary: true,
    } : null);
    setAssistantError('');
    setQuestion('');
  }

  async function runAction(action) {
    if (!target || assistantBusy) return;
    setAssistantBusy(true);
    setAssistantError('');
    setAnswer(null);
    try {
      const result = await askStudyAssistant({
        action,
        selection: target.selection,
        sourceText: target.sourceText,
        summary: target.summary,
        chapterTitle: target.chapterTitle,
        sectionTitle: target.sectionTitle,
        question: action === 'custom' ? question.trim() : '',
      });
      setAnswer(result);
      if (autoSpeak) speak(result.answer);
    } catch (error) {
      setAssistantError(error.message || 'Spiegazione non disponibile.');
    } finally {
      setAssistantBusy(false);
    }
  }

  function toggleAutoSpeak(event) {
    const enabled = event.target.checked;
    setAutoSpeak(enabled);
    try { localStorage.setItem('studybook:auto-speak-help', enabled ? '1' : '0'); } catch { /* noop */ }
  }

  function speakChapter() {
    const text = chapter?.paragraphs?.map((paragraph) => (
      dsaMode ? (paragraph.dsaSummary || paragraph.summary) : paragraph.summary
    )).join(' ');
    speak(text);
  }

  function chooseQuizOption(index) {
    if (quizChoice !== null) return;
    setQuizChoice(index);
    if (index === quiz[toolIndex]?.correctIndex) setQuizScore((score) => score + 1);
  }

  function nextQuiz() {
    if (!quiz.length) return;
    if (toolIndex >= quiz.length - 1) {
      setToolIndex(0);
      setQuizChoice(null);
      setQuizScore(0);
      return;
    }
    setToolIndex((index) => index + 1);
    setQuizChoice(null);
  }

  if (!chapter) return null;

  const flashcard = flashcards[toolIndex];
  const quizQuestion = quiz[toolIndex];
  const oralQuestion = oralQuestions[toolIndex];

  return (
    <div className="study-mode" role="dialog" aria-modal="true" aria-label="Modalità Studio">
      <header className="study-mode-header">
        <div>
          <span>MODALITÀ STUDIO</span>
          <strong>{chapter.title}</strong>
        </div>
        <div className="study-mode-header-actions">
          <button type="button" onClick={speakChapter}>🔊 Capitolo</button>
          <button type="button" className="study-close" onClick={onClose} aria-label="Chiudi modalità studio">×</button>
        </div>
      </header>

      <div className="study-chapter-nav">
        <button type="button" onClick={() => onChapterChange(Math.max(0, chapterIndex - 1))} disabled={chapterIndex <= 0}>←</button>
        <select value={chapterIndex} onChange={(event) => onChapterChange(Number(event.target.value))}>
          {book.chapters.map((item, index) => <option value={index} key={`${item.title}-${index}`}>{index + 1}. {item.title}</option>)}
        </select>
        <button type="button" onClick={() => onChapterChange(Math.min(chapterCount - 1, chapterIndex + 1))} disabled={chapterIndex >= chapterCount - 1}>→</button>
      </div>

      <nav className="study-tool-tabs" aria-label="Strumenti di studio">
        {[
          ['reader', 'Testo'],
          ['flashcards', 'Flashcard'],
          ['quiz', 'Quiz'],
          ['map', 'Mappa'],
          ['oral', 'Interrogazione'],
        ].map(([id, label]) => (
          <button type="button" key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}>{label}</button>
        ))}
      </nav>

      {tool === 'reader' && <div className="study-mode-tip">Tocca una parola oppure seleziona una frase. Le parole chiave sono in grassetto; le definizioni brevi compaiono tra parentesi.</div>}

      {tool === 'reader' && (
        <main className="study-mode-pages">
          {chapter.paragraphs.map((paragraph, index) => {
            const text = dsaMode ? (paragraph.dsaSummary || paragraph.summary) : paragraph.summary;
            const glossary = cleanGlossary(paragraph.glossary || []);
            const sideGlossary = glossary.filter((entry) => entry.placement === 'side');
            return (
              <article className={sideGlossary.length ? 'study-sheet has-glossary' : 'study-sheet'} key={`${chapterIndex}-${index}`}>
                <div className="study-sheet-main">
                  <div className="study-sheet-meta">
                    <span>{index + 1}</span>
                    {paragraph.sourceSection && <small>§ {paragraph.sourceSection}</small>}
                    {pageRange(paragraph.sourcePageStart, paragraph.sourcePageEnd) && <small>{pageRange(paragraph.sourcePageStart, paragraph.sourcePageEnd)}</small>}
                  </div>
                  <InteractiveText
                    text={text}
                    keywords={paragraph.keywords}
                    glossary={glossary}
                    onPick={(selection, glossaryEntry) => openTarget(selection, paragraph, glossaryEntry)}
                  />
                </div>

                {sideGlossary.length > 0 && (
                  <aside className="study-margin-glossary" aria-label="Glossario del passaggio">
                    <small>TERMINI DEL PASSAGGIO</small>
                    {sideGlossary.map((entry) => (
                      <button type="button" key={entry.term} onClick={() => openTarget(entry.term, paragraph, entry)}>
                        <strong>{entry.term}</strong>
                        <span>{entry.definition}</span>
                      </button>
                    ))}
                  </aside>
                )}
              </article>
            );
          })}
        </main>
      )}

      {tool === 'flashcards' && (
        <main className="study-tool-stage">
          {flashcard ? (
            <section className="study-flashcard-wrap">
              <div className="study-tool-counter">{toolIndex + 1} / {flashcards.length}</div>
              <button type="button" className={`study-flashcard${flashRevealed ? ' revealed' : ''}`} onClick={() => setFlashRevealed((value) => !value)}>
                <small>{flashRevealed ? 'RISPOSTA' : 'DOMANDA'}</small>
                <strong>{flashRevealed ? flashcard.back : flashcard.front}</strong>
                <span>{flashRevealed ? 'Tocca per tornare alla domanda' : 'Tocca per mostrare la risposta'}</span>
              </button>
              <div className="study-tool-nav">
                <button type="button" onClick={() => { setToolIndex(Math.max(0, toolIndex - 1)); setFlashRevealed(false); }} disabled={toolIndex <= 0}>← Precedente</button>
                <button type="button" onClick={() => { setToolIndex(Math.min(flashcards.length - 1, toolIndex + 1)); setFlashRevealed(false); }} disabled={toolIndex >= flashcards.length - 1}>Successiva →</button>
              </div>
            </section>
          ) : <EmptyTool>Non ci sono ancora abbastanza punti chiave o definizioni per creare flashcard in questo capitolo.</EmptyTool>}
        </main>
      )}

      {tool === 'quiz' && (
        <main className="study-tool-stage">
          {quizQuestion ? (
            <section className="study-quiz-card">
              <div className="study-tool-counter">Domanda {toolIndex + 1} / {quiz.length} · corrette {quizScore}</div>
              <h3>{quizQuestion.question}</h3>
              <div className="study-quiz-options">
                {quizQuestion.options.map((option, index) => {
                  const selected = quizChoice === index;
                  const correct = quizChoice !== null && index === quizQuestion.correctIndex;
                  const wrong = selected && quizChoice !== quizQuestion.correctIndex;
                  return <button type="button" key={`${option}-${index}`} className={`${selected ? 'selected ' : ''}${correct ? 'correct ' : ''}${wrong ? 'wrong' : ''}`.trim()} onClick={() => chooseQuizOption(index)} disabled={quizChoice !== null}>{option}</button>;
                })}
              </div>
              {quizChoice !== null && (
                <div className="study-quiz-feedback">
                  <strong>{quizChoice === quizQuestion.correctIndex ? 'Corretto.' : 'Da ripassare.'}</strong>
                  <span>{quizQuestion.explanation}</span>
                  <button type="button" onClick={nextQuiz}>{toolIndex >= quiz.length - 1 ? 'Ricomincia quiz' : 'Domanda successiva'}</button>
                </div>
              )}
            </section>
          ) : <EmptyTool>Per il quiz servono almeno alcuni concetti o definizioni distinti nel capitolo.</EmptyTool>}
        </main>
      )}

      {tool === 'map' && (
        <main className="study-tool-stage">
          {conceptMap.length ? (
            <section className="study-map">
              <div className="study-map-root">{chapter.title}</div>
              {conceptMap.map((node) => (
                <article key={`${node.title}-${node.paragraphIndex}`}>
                  <strong>{node.title}</strong>
                  {node.keywords.length > 0 && <div className="study-map-keywords">{node.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div>}
                  {node.points.length > 0 && <ul>{node.points.map((point) => <li key={point}>{point}</li>)}</ul>}
                </article>
              ))}
            </section>
          ) : <EmptyTool>La mappa comparirà quando il capitolo contiene parole chiave o punti da ricordare.</EmptyTool>}
        </main>
      )}

      {tool === 'oral' && (
        <main className="study-tool-stage">
          {oralQuestion ? (
            <section className="study-oral-card">
              <div className="study-tool-counter">{toolIndex + 1} / {oralQuestions.length}</div>
              <small>SIMULAZIONE ORALE</small>
              <h3>{oralQuestion.question}</h3>
              <div className="study-oral-actions">
                <button type="button" onClick={() => speak(oralQuestion.question)}>🔊 Ascolta domanda</button>
                <button type="button" onClick={() => setOralRevealed((value) => !value)}>{oralRevealed ? 'Nascondi traccia' : 'Mostra traccia risposta'}</button>
              </div>
              {oralRevealed && <div className="study-oral-answer">{oralQuestion.answer}</div>}
              <div className="study-tool-nav">
                <button type="button" onClick={() => { setToolIndex(Math.max(0, toolIndex - 1)); setOralRevealed(false); }} disabled={toolIndex <= 0}>← Precedente</button>
                <button type="button" onClick={() => { setToolIndex(Math.min(oralQuestions.length - 1, toolIndex + 1)); setOralRevealed(false); }} disabled={toolIndex >= oralQuestions.length - 1}>Successiva →</button>
              </div>
            </section>
          ) : <EmptyTool>Non ci sono ancora abbastanza elementi per simulare l’interrogazione in questo capitolo.</EmptyTool>}
        </main>
      )}

      {target && (
        <section className="study-assistant-sheet" aria-live="polite">
          <div className="study-assistant-grip" />
          <div className="study-assistant-head">
            <div>
              <small>STAI CHIEDENDO DI</small>
              <strong>{target.selection}</strong>
            </div>
            <button type="button" onClick={() => setTarget(null)} aria-label="Chiudi spiegazione">×</button>
          </div>

          <div className="study-action-grid">
            {STUDY_ACTIONS.map((action) => (
              <button type="button" key={action.id} disabled={assistantBusy} onClick={() => runAction(action.id)}>{action.label}</button>
            ))}
          </div>

          <div className="study-custom-question">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Chiedi altro su questo punto…"
              maxLength={600}
            />
            <button type="button" disabled={!question.trim() || assistantBusy} onClick={() => runAction('custom')}>Chiedi</button>
          </div>

          <label className="study-auto-speak">
            <input type="checkbox" checked={autoSpeak} onChange={toggleAutoSpeak} />
            Leggi automaticamente le spiegazioni
          </label>

          {assistantBusy && <div className="study-assistant-loading">Sto preparando la spiegazione…</div>}
          {assistantError && <div className="study-assistant-error">{assistantError}</div>}
          {answer && (
            <div className="study-answer">
              {answer.basis === 'general' && <div className="study-answer-basis">Spiegazione aggiuntiva · non è testo dell’autore</div>}
              {answer.glossary && answer.basis === 'source' && <div className="study-answer-basis source">Definizione ricavata dal testo del libro</div>}
              {answer.label && <strong>{answer.label}</strong>}
              <p>{answer.answer}</p>
              <div className="study-answer-actions">
                <button type="button" onClick={() => speak(answer.answer)}>🔊 Ascolta</button>
                {answer.cached && <span>{answer.persisted ? 'Risposta salvata sul dispositivo' : 'Risposta già pronta'}</span>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
