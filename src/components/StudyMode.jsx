import { useMemo, useRef, useState } from 'react';
import { askStudyAssistant, STUDY_ACTIONS } from '../lib/studyAssistant.js';
import '../studyMode.css';

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

export default function StudyMode({ book, chapterIndex, onChapterChange, dsaMode, onClose }) {
  const [target, setTarget] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState('');
  const [question, setQuestion] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem('studybook:auto-speak-help') === '1'; } catch { return false; }
  });

  const chapter = book?.chapters?.[chapterIndex];
  const chapterCount = book?.chapters?.length || 0;

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

  if (!chapter) return null;

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

      <div className="study-mode-tip">Tocca una parola oppure seleziona una frase. Le parole chiave sono in grassetto; le definizioni brevi compaiono tra parentesi.</div>

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
                {answer.cached && <span>Risposta già pronta</span>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
