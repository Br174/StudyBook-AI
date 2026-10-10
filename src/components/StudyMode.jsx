import { useEffect, useMemo, useRef, useState } from 'react';
import { askStudyAssistant, STUDY_ACTIONS } from '../lib/studyAssistant.js';
import { buildConceptMap, buildFlashcards, buildOralQuestions, buildQuiz } from '../lib/studyTools.js';
import { readerCssVariables } from '../lib/accessibility.js';
import { editorialParagraphText } from '../lib/editorialModel.js';
import { filterGlossaryEntries } from '../lib/glossaryQuality.js';
import { speakStudyText, stopStudySpeech, installItalianSpeechVoice } from '../lib/studySpeech.js';
import { StudyBackIcon, StudySoundIcon } from './StudyUiIcons.jsx';
import '../studyMode.css';
import '../studyTools.css';
import '../studyContinuous.css';

// LAB05: definizioni verificate per abbreviazioni ricorrenti, solo se effettivamente presenti nel capitolo.
const STANDARD_ABBREVIATIONS = {
  TFR: 'Trattamento di fine rapporto: somma maturata durante il rapporto di lavoro, corrisposta quando termina.',
  INPS: 'Istituto Nazionale della Previdenza Sociale.',
  INAIL: 'Istituto Nazionale per l’Assicurazione contro gli Infortuni sul Lavoro.',
  CCNL: 'Contratto Collettivo Nazionale di Lavoro.',
  IRPEF: 'Imposta sul Reddito delle Persone Fisiche.',
};
function withChapterAbbreviations(entries, chapter) {
  const text = (chapter?.paragraphs || []).map(p => [p.original, p.summary, p.simpleSummary].filter(Boolean).join(' ')).join(' ');
  const result = [...entries];
  const existing = new Set(result.map(e => e.term.toLocaleUpperCase('it-IT')));
  for (const [term, definition] of Object.entries(STANDARD_ABBREVIATIONS)) {
    if (!existing.has(term) && new RegExp('\\b' + term + '\\b', 'i').test(text)) {
      result.push({ term, definition, basis: 'general', paragraphIndex: 0 });
    }
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanGlossary(entries = []) {
  return filterGlossaryEntries(entries, { limit: 24 }).map((entry) => ({
    ...entry,
    placement: 'side',
    basis: entry?.basis || 'source',
    paragraphIndex: Number.isInteger(entry?.paragraphIndex) ? entry.paragraphIndex : null,
  }));
}

function chapterGlossary(chapter = {}) {
  const entries = [];
  const seen = new Set();
  (chapter.paragraphs || []).forEach((paragraph, paragraphIndex) => {
    cleanGlossary(paragraph.glossary || []).forEach((entry) => {
      const key = entry.term.toLocaleLowerCase('it-IT');
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ ...entry, paragraphIndex });
    });
  });
  return entries.slice(0, 24);
}

function modeLabel(level) {
  if (level === 'ripasso') return 'Riassunto';
  if (level === 'approfondito') return 'Approfondimento';
  return 'Metodo di studio';
}

function normalizedSection(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function InteractiveText({ text, glossary, onPick }) {
  const ref = useRef(null);
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
    if ((anchor && ref.current.contains(anchor)) || (focus && ref.current.contains(focus))) onPick(value, null);
  }

  return (
    <p
      ref={ref}
      className="study-interactive-text"
      onMouseUp={useSelection}
      onTouchEnd={() => window.setTimeout(useSelection, 0)}
    >
      {segments.map((segment, index) => {
        const entry = glossaryMap.get(String(segment || '').toLocaleLowerCase('it-IT'));
        if (!entry) return <span key={`plain-${index}`}>{segment}</span>;
        return (
          <button
            type="button"
            className="study-legal-term"
            key={`${entry.term}-${index}`}
            onClick={() => onPick(segment, entry)}
          >
            <strong>{segment}</strong>
          </button>
        );
      })}
    </p>
  );
}

function EmptyTool({ children }) {
  return <div className="study-tool-empty">{children}</div>;
}

export default function StudyMode({ book, bookTitle, initialMode = 'reader', chapterIndex, onChapterChange, dsaMode, accessibility, onClose }) {
  const [target, setTarget] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [question, setQuestion] = useState('');
  const isReader = initialMode !== 'study';
  const [tool, setTool] = useState(isReader ? 'reader' : 'flashcards');
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState('');
  const [readingVariant, setReadingVariant] = useState('study');
  const [studyScope, setStudyScope] = useState('chapter');
  const [toolIndex, setToolIndex] = useState(0);
  const swipeStart = useRef(null);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [quizChoice, setQuizChoice] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [oralRevealed, setOralRevealed] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem('studybook:auto-speak-help') === '1'; } catch { return false; }
  });

  const chapter = book?.chapters?.[chapterIndex];
  const chapterCount = book?.chapters?.length || 0;
  const wholeBookChapter = useMemo(() => ({
    title: 'Intero libro',
    paragraphs: (book?.chapters || []).flatMap((item, cIndex) => (item.paragraphs || []).map((paragraph) => ({
      ...paragraph,
      sourceSection: [item.title, paragraph.sourceSection].filter(Boolean).join(' · '),
      sourceChapterIndex: cIndex,
    }))),
  }), [book]);
  const studySource = studyScope === 'book' ? wholeBookChapter : (chapter || {});
  const flashcards = useMemo(() => buildFlashcards(studySource, studyScope === 'book' ? 60 : 36), [studySource, studyScope]);
  const quiz = useMemo(() => buildQuiz(studySource, studyScope === 'book' ? 30 : 18), [studySource, studyScope]);
  const oralQuestions = useMemo(() => buildOralQuestions(studySource, studyScope === 'book' ? 36 : 24), [studySource, studyScope]);
  const conceptMap = useMemo(() => buildConceptMap(studySource, studyScope === 'book' ? 60 : 24), [studySource, studyScope]);
  const glossary = useMemo(() => withChapterAbbreviations(chapterGlossary(chapter || {}), chapter), [chapter]);
  useEffect(() => () => { void stopStudySpeech(); }, []);
  useEffect(() => { void stopStudySpeech(); setTtsSpeaking(false); setTtsError(''); }, [chapterIndex]);
  function readAloud(text) {
    setTtsError('');
    void speakStudyText(text, {
      onStart: () => setTtsSpeaking(true),
      onEnd: () => setTtsSpeaking(false),
      onError: message => { setTtsSpeaking(false); setTtsError(message); },
    });
  }
  function stopReading() { void stopStudySpeech(); setTtsSpeaking(false); setTtsError(''); }
  function closeReader() { void stopStudySpeech(); onClose(); }
  function changeChapter(nextIndex) {
    if (nextIndex < 0 || nextIndex >= chapterCount || nextIndex === chapterIndex) return;
    onChapterChange(nextIndex);
    // LAB06: quando si sfoglia un nuovo capitolo, le domande seguono quel capitolo.
    if (!isReader) setStudyScope('chapter');
  }
  function listenToCurrentContent() {
    if (isReader) { speakChapter(); return; }
    const text = tool === 'flashcards'
      ? (flashRevealed ? flashcards[toolIndex]?.back : flashcards[toolIndex]?.front)
      : tool === 'quiz' ? quiz[toolIndex]?.question
        : tool === 'oral' ? oralQuestions[toolIndex]?.question
          : [chapter?.title, ...(conceptMap || []).map(node => node.title)].filter(Boolean).join('. ');
    readAloud(text || '');
  }

  useEffect(() => {
    setToolIndex(0);
    setFlashRevealed(false);
    setQuizChoice(null);
    setQuizScore(0);
    setOralRevealed(false);
    setTarget(null);
  }, [chapterIndex, tool, studyScope]);

  function openTarget(selection, paragraph, glossaryEntry = null) {
    const value = String(selection || '').trim();
    if (!value || !paragraph) return;
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
      label: 'Terminologia',
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
      if (autoSpeak) readAloud(result.answer);
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

  function paragraphReadingText(paragraph) {
    return editorialParagraphText(paragraph, { variant: readingVariant, dsaMode });
  }

  function speakChapter() {
    const text = chapter?.paragraphs?.map(paragraphReadingText).join(' ');
    readAloud(text);
  }

  // LAB05: swipe orizzontale alternativo alle frecce, senza bloccare lo scorrimento verticale.
  function onSwipeStart(event) {
    const p = event.touches?.[0];
    if (p) swipeStart.current = { x: p.clientX, y: p.clientY };
  }
  function onSwipeEnd(event) {
    const p = event.changedTouches?.[0], start = swipeStart.current;
    swipeStart.current = null;
    if (!p || !start) return;
    const dx = p.clientX - start.x, dy = p.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const direction = dx < 0 ? 1 : -1;
    if (isReader || tool === 'map') {
      changeChapter(Math.min(chapterCount - 1, Math.max(0, chapterIndex + direction)));
      return;
    }
    const length = tool === 'flashcards' ? flashcards.length : tool === 'quiz' ? quiz.length : oralQuestions.length;
    setToolIndex(index => Math.min(Math.max(length - 1, 0), Math.max(0, index + direction)));
    setFlashRevealed(false);
    setOralRevealed(false);
    setQuizChoice(null);
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
    <div className={`study-mode ${accessibility?.enabled ? 'accessibility-on' : ''} ${accessibility?.phone?.readingGuide ? 'reading-guide-on' : ''}`} style={readerCssVariables(accessibility)} role="dialog" aria-modal="true" aria-label="Modalità Studio">
      <header className="study-mode-header sb-lab06-compact-header">
        <button type="button" className="sb-lab06-back" onClick={closeReader} aria-label="Torna alla pagina del libro" title="Torna alla pagina del libro"><StudyBackIcon /></button>
        <strong className="sb-lab06-brand">StudyBook <span>AI</span></strong>
        <button type="button" className={`sb-lab06-audio${ttsSpeaking ? ' playing' : ''}`} onClick={ttsSpeaking ? stopReading : listenToCurrentContent} aria-label={ttsSpeaking ? 'Ferma la lettura vocale' : isReader ? 'Ascolta il capitolo' : 'Ascolta il contenuto di studio'} title={ttsSpeaking ? 'Ferma audio' : 'Ascolta'}><StudySoundIcon /></button>
      </header>
      {ttsError && <div className="sb-lab05-tts-error" role="alert">{ttsError} <button type="button" onClick={() => { void installItalianSpeechVoice().catch(error => setTtsError(error?.message || 'Controlla la sintesi vocale Android.')); }}>Installa voce italiana</button></div>}

      <nav className="study-chapter-nav sb-lab05-chapter-nav sb-lab06-chapter-nav" aria-label="Navigazione tra i capitoli">
        <button type="button" onClick={() => changeChapter(chapterIndex - 1)} disabled={chapterIndex <= 0} aria-label="Capitolo precedente">←</button>
        <label className="sb-lab06-chapter-center">
          <span className="sb-lab06-chapter-counter">CAPITOLO <b>{chapterIndex + 1} / {chapterCount}</b></span>
          <span className="sb-lab06-chapter-full-title">{chapter.title}<span className="sb-lab06-dropdown" aria-hidden="true">⌄</span></span>
          <select aria-label="Scegli un capitolo dalla lista" value={chapterIndex} onChange={(event) => changeChapter(Number(event.target.value))}>
            {book.chapters.map((item, index) => <option value={index} key={`${item.title}-${index}`}>{index + 1}. {item.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => changeChapter(chapterIndex + 1)} disabled={chapterIndex >= chapterCount - 1} aria-label="Capitolo successivo">→</button>
      </nav>

      {!isReader && <nav className="study-tool-tabs sb-lab05-study-tabs" aria-label="Metodi di studio">
        {[
          ['flashcards', 'Flashcard'],
          ['quiz', 'Quiz'],
          ['map', 'Mappa'],
          ['oral', 'Interrogazione'],
        ].map(([id, label]) => (
          <button type="button" key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}>{label}</button>
        ))}
      </nav>}

      {!isReader && (
        <div className="study-scope-switch" aria-label="Ambito strumenti di studio">
          <button type="button" className={studyScope === 'book' ? 'active' : ''} onClick={() => setStudyScope('book')}>Intero libro</button>
          <button type="button" className={studyScope === 'chapter' ? 'active' : ''} onClick={() => setStudyScope('chapter')}>Solo capitolo</button>
        </div>
      )}

      {isReader && (
        <>
          <div className="study-reading-variant" aria-label="Versione del testo">
            <button type="button" className={readingVariant === 'study' ? 'active' : ''} onClick={() => setReadingVariant('study')}>Testo di studio</button>
            <button type="button" className={readingVariant === 'simple' ? 'active' : ''} onClick={() => setReadingVariant('simple')}>In parole semplici</button>
          </div>
          <div className="study-mode-tip">
            {readingVariant === 'study'
              ? 'Versione rigorosa e concentrata: conserva le informazioni utili allo studio.'
              : 'Versione breve e accessibile per capire rapidamente il significato prima di approfondire.'}
          </div>
        </>
      )}

      {isReader && (
        <main className="study-mode-pages" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <article className="study-continuous-sheet">
            <div className="study-continuous-main">
              <header className="study-continuous-chapter-head">
                <small>CAPITOLO {chapterIndex + 1}</small>
                <h1>{chapter.title}</h1>
              </header>

              {chapter.paragraphs.map((paragraph, index) => {
                const text = paragraphReadingText(paragraph);
                const localGlossary = cleanGlossary(paragraph.glossary || []);
                const sectionTitle = normalizedSection(paragraph.sourceSection);
                const previousSection = index > 0 ? normalizedSection(chapter.paragraphs[index - 1]?.sourceSection) : '';
                const chapterTitle = normalizedSection(chapter.title).toLocaleLowerCase('it-IT');
                const showSectionTitle = Boolean(
                  sectionTitle
                  && sectionTitle !== previousSection
                  && sectionTitle.toLocaleLowerCase('it-IT') !== chapterTitle,
                );

                return (
                  <section className="study-flow-paragraph" key={`${chapterIndex}-${index}`}>
                    {showSectionTitle && <h3 className="study-flow-section-title">{sectionTitle}</h3>}
                    <InteractiveText
                      text={text}
                      glossary={localGlossary}
                      onPick={(selection, glossaryEntry) => openTarget(selection, paragraph, glossaryEntry)}
                    />
                  </section>
                );
              })}
            </div>

            <aside className="study-chapter-glossary" aria-label="Terminologia del capitolo">
              <small>TERMINOLOGIA</small>
              {glossary.length ? glossary.map((entry) => {
                const paragraph = chapter.paragraphs[entry.paragraphIndex] || chapter.paragraphs[0];
                return (
                  <button type="button" key={entry.term} onClick={() => openTarget(entry.term, paragraph, entry)}>
                    <strong>{entry.term}</strong>
                    <span>{entry.definition}</span>
                  </button>
                );
              }) : <span className="study-tool-empty">Nessun termine specialistico da spiegare in questo capitolo.</span>}
            </aside>
          </article>
        </main>
      )}

      {!isReader && tool === 'flashcards' && (
        <main className="study-tool-stage" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          {flashcard ? (
            <section className="study-flashcard-wrap">
              <div className="study-tool-counter">FLASHCARD {toolIndex + 1} / {flashcards.length} · Tocca per svelare la risposta</div>
              <button type="button" className={`study-flashcard${flashRevealed ? ' revealed' : ''}`} onClick={() => setFlashRevealed((value) => !value)}>
                <small>{flashRevealed ? 'RISPOSTA' : 'DOMANDA'}</small>
                <strong>{flashRevealed ? flashcard.back : flashcard.front}</strong>
                <span>{flashRevealed ? 'Tocca per tornare alla domanda' : 'Tocca per mostrare la risposta'}</span>
              </button>
              <div className="study-tool-nav">
                <button type="button" onClick={() => { setToolIndex(Math.max(0, toolIndex - 1)); setFlashRevealed(false); }} disabled={toolIndex <= 0}>← Scheda precedente</button>
                <span className="sb-lab05-item-count">{toolIndex + 1} / {flashcards.length}</span>
                <button type="button" onClick={() => { setToolIndex(Math.min(flashcards.length - 1, toolIndex + 1)); setFlashRevealed(false); }} disabled={toolIndex >= flashcards.length - 1}>Scheda successiva →</button>
              </div>
            </section>
          ) : <EmptyTool>Non ci sono ancora elementi sufficienti per creare flashcard in questo capitolo.</EmptyTool>}
        </main>
      )}

      {!isReader && tool === 'quiz' && (
        <main className="study-tool-stage" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
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
              <div className="study-tool-nav">
                <button type="button" onClick={() => { setToolIndex(i => Math.max(0, i - 1)); setQuizChoice(null); }} disabled={toolIndex <= 0}>← Domanda precedente</button>
                <span className="sb-lab05-item-count">{toolIndex + 1} / {quiz.length}</span>
                <button type="button" onClick={() => { setToolIndex(i => Math.min(quiz.length - 1, i + 1)); setQuizChoice(null); }} disabled={toolIndex >= quiz.length - 1}>Domanda successiva →</button>
              </div>
              {quizChoice !== null && (
                <div className="study-quiz-feedback">
                  <strong>{quizChoice === quizQuestion.correctIndex ? 'Corretto.' : 'Da ripassare.'}</strong>
                  <span>{quizQuestion.explanation}</span>
                  <button type="button" onClick={nextQuiz}>{toolIndex >= quiz.length - 1 ? 'Ricomincia quiz' : 'Domanda successiva'}</button>
                </div>
              )}
            </section>
          ) : <EmptyTool>Non riesco a costruire un quiz affidabile da questo capitolo.</EmptyTool>}
        </main>
      )}

      {!isReader && tool === 'map' && (
        <main className="study-tool-stage" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
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
          ) : <EmptyTool>La mappa comparirà quando il capitolo contiene concetti utili da collegare.</EmptyTool>}
        </main>
      )}

      {!isReader && tool === 'oral' && (
        <main className="study-tool-stage" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          {oralQuestion ? (
            <section className="study-oral-card">
              <div className="study-tool-counter">{toolIndex + 1} / {oralQuestions.length}</div>
              <small>SIMULAZIONE ORALE</small>
              <h3>{oralQuestion.question}</h3>
              <div className="study-oral-actions">
                <button type="button" className="sb-lab06-listen" onClick={() => readAloud(oralQuestion.question)}><StudySoundIcon size={21} /> Ascolta domanda</button>
                <button type="button" onClick={() => setOralRevealed((value) => !value)}>{oralRevealed ? 'Nascondi traccia' : 'Mostra traccia risposta'}</button>
              </div>
              {oralRevealed && <div className="study-oral-answer">{oralQuestion.answer}</div>}
              <div className="study-tool-nav">
                <button type="button" onClick={() => { setToolIndex(Math.max(0, toolIndex - 1)); setOralRevealed(false); }} disabled={toolIndex <= 0}>← Domanda precedente</button>
                <span className="sb-lab05-item-count">{toolIndex + 1} / {oralQuestions.length}</span>
                <button type="button" onClick={() => { setToolIndex(Math.min(oralQuestions.length - 1, toolIndex + 1)); setOralRevealed(false); }} disabled={toolIndex >= oralQuestions.length - 1}>Domanda successiva →</button>
              </div>
            </section>
          ) : <EmptyTool>Non ci sono ancora abbastanza elementi per simulare l’interrogazione.</EmptyTool>}
        </main>
      )}

      {isReader && target && (
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
                <button type="button" className="sb-lab06-listen" onClick={() => readAloud(answer.answer)}><StudySoundIcon size={21} /> Ascolta</button>
                {answer.cached && <span>{answer.persisted ? 'Risposta salvata sul dispositivo' : 'Risposta già pronta'}</span>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
