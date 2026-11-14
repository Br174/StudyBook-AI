import { useEffect, useMemo, useRef, useState } from 'react';
import MirrorReaderV35 from './MirrorReaderV35.jsx';
import { askStudyAssistant, STUDY_ACTIONS } from '../lib/studyAssistant.js';
import {buildStudyToolSourceV130,studyToolCacheKeyV130,savedStudyToolsV130,
 saveStudyToolsV130,generateStudyToolsV130} from '../lib/studyToolsOnDemandV130.js';
import { readerCssVariables } from '../lib/accessibility.js';
import { editorialParagraphText } from '../lib/editorialModel.js';
import { countLetters } from '../lib/studyQualityGuard.js';
import {approximateStudyLinesV68} from '../lib/libroSpecchioV35.js';
import { filterGlossaryEntries } from '../lib/glossaryQuality.js';
import { buildUniversalGlossary, splitUniversalText } from '../lib/universalGlossary.js';
import { speakStudyText, stopStudySpeech, installItalianSpeechVoice } from '../lib/studySpeech.js';
import { StudyBackIcon, StudySoundIcon, StudyIcon } from './StudyUiIcons.jsx';
import '../studyMode.css';
import '../studyTools.css';
import '../studyContinuous.css';

function cleanGlossary(entries = []) {
  return filterGlossaryEntries(entries, { limit: 24 }).map((entry) => ({
    ...entry,
    placement: 'inline',
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

function InteractiveText({ text, glossary, chapterTerms, onPick }) {
  const ref = useRef(null);
  const glossaryEntries = useMemo(
    () => buildUniversalGlossary(text, cleanGlossary(glossary), chapterTerms),
    [text, glossary, chapterTerms],
  );
  const segments = useMemo(() => splitUniversalText(text, glossaryEntries), [text, glossaryEntries]);

  function useSelection() {
    const selection = window.getSelection?.();
    const value = selection?.toString?.().trim();
    if (!value || value.length > 1400 || !ref.current) return;
    const anchor = selection.anchorNode, focus = selection.focusNode;
    if ((anchor && ref.current.contains(anchor)) || (focus && ref.current.contains(focus))) onPick(value, null);
  }

  return (
    <p ref={ref} className="study-interactive-text" style={{ whiteSpace: 'pre-line' }}
       onMouseUp={useSelection} onTouchEnd={() => window.setTimeout(useSelection, 0)}>
      {segments.map(({ text: segment, entry }, index) => entry ? (
        <button type="button" className="study-legal-term sb-lab10-glossary-term"
          key={index} title={entry.definition ? 'Apri la spiegazione' : 'Chiedi il significato nel contesto'}
          aria-label={'Glossario: ' + segment} onClick={() => onPick(segment, entry)}>
          <strong>{segment}</strong>
        </button>
      ) : <span key={index}>{segment}</span>)}
    </p>
  );
}

function EmptyTool({ children }) {
  return <div className="study-tool-empty">{children}</div>;
}

export default function StudyMode({ book, sourceBook = book, originalFile = null, bookTitle, bookId='', initialMode = 'reader', chapterIndex, onChapterChange, dsaMode, accessibility, onClose, onRead }) {
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
  // LAB49: a monotonically increasing token is one deliberate tap, not a generated book edition.
  const [simpleRequestToken, setSimpleRequestToken] = useState(0);
  const [studyScope, setStudyScope] = useState('page');
  const [studyParagraphIndex,setStudyParagraphIndex] = useState(0);
  const [toolDeck,setToolDeck] = useState({key:'',items:[],sampled:false});
  const [toolLoading,setToolLoading] = useState(false);
  const [toolError,setToolError] = useState('');
  const toolAbortRef=useRef(null);
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
    paragraphs: (book?.chapters || []).flatMap((item, cIndex) =>
      item?.precisionChapter?.sourceReady === false ? [] : (item.paragraphs || []).map((paragraph) => ({
        ...paragraph,
        sourceSection: [item.title, paragraph.sourceSection].filter(Boolean).join(' · '),
        sourceChapterIndex: cIndex,
      }))),
  }), [book]);
  const studySource = studyScope === 'book' ? wholeBookChapter :
    chapter?.precisionChapter?.sourceReady === false ? { title:chapter.title, paragraphs:[] } : (chapter || {});
  const studyToolSource=useMemo(()=>buildStudyToolSourceV130(book,{
   scope:studyScope,chapterIndex,paragraphIndex:studyParagraphIndex
  }),[book,studyScope,chapterIndex,studyParagraphIndex]);
  const studyToolKey=useMemo(()=>studyToolCacheKeyV130(bookId,tool,studyScope,
   studyToolSource.passages),[bookId,tool,studyScope,studyToolSource]);
  const activeDeck=toolDeck.key===studyToolKey?toolDeck.items:[];
  const flashcards=tool==='flashcards'?activeDeck:[];
  const quiz=tool==='quiz'?activeDeck:[];
  const oralQuestions=tool==='oral'?activeDeck:[];
  const conceptMap=tool==='map'?activeDeck:[];
  useEffect(()=>{
   if(isReader)return;
   let active=true;
   toolAbortRef.current?.abort();
   setToolLoading(false);setToolError('');
   setToolDeck({key:'',items:[],sampled:false});
   savedStudyToolsV130(studyToolKey).then(saved=>{
    if(active&&saved?.tool===tool){
     setToolDeck({key:studyToolKey,items:saved.items,sampled:saved.sampled});
    }
   }).catch(()=>{});
   return ()=>{active=false;toolAbortRef.current?.abort();};
  },[studyToolKey,isReader,tool]);
  async function generateToolDeck(){
   if(toolLoading||isReader||!studyToolSource.passages.length)return;
   const controller=new AbortController();
   toolAbortRef.current?.abort();toolAbortRef.current=controller;
   setToolLoading(true);setToolError('');
   try{
    const generated=await generateStudyToolsV130({
     tool,scope:studyScope,chapterTitle:studyToolSource.title,
     passages:studyToolSource.passages,sampled:studyToolSource.sampled,
     signal:controller.signal
    });
    if(controller.signal.aborted)return;
    await saveStudyToolsV130(studyToolKey,generated);
    if(!controller.signal.aborted){
     setToolDeck({key:studyToolKey,items:generated.items,
      sampled:generated.sampled});
     setToolIndex(0);setQuizChoice(null);setQuizScore(0);
     setFlashRevealed(false);setOralRevealed(false);
    }
   }catch(error){
    if(!controller.signal.aborted){
     const wait=Number(error?.retryAfterSeconds)||0;
     setToolError((error?.message||'Gemini non disponibile.')+
      (wait>0?' Riprova tra almeno '+Math.ceil(wait/60)+' minuti.':''));
    }
   }finally{
    if(toolAbortRef.current===controller){
     toolAbortRef.current=null;setToolLoading(false);
    }
   }
  }
  const glossary = useMemo(() => chapterGlossary(chapter || {}), [chapter]);
  const numberIt = (value) => Number(value || 0).toLocaleString('it-IT');
  const chapterLetterStats = useMemo(() => {
    const paragraphs = chapter?.paragraphs || [];
    const original=paragraphs.reduce((sum,p)=>sum+countLetters(p.original || ''),0);
    const current=paragraphs.reduce((sum,p)=>
      sum+countLetters(editorialParagraphText(p,{variant:readingVariant,dsaMode})),0);
    const originalText=paragraphs.map(p=>p.original||'').join('\n');
    const currentText=paragraphs.map(p=>
      editorialParagraphText(p,{variant:readingVariant,dsaMode})).join('\n');
    return {
      original, current,
      linesSaved:approximateStudyLinesV68(originalText)-
        approximateStudyLinesV68(currentText),
      achieved:original?Math.round((1-current/original)*1000)/10:0,
      sourceWarnings:paragraphs.filter(p=>p.precisionAudit?.sourceNeedsReview).length,
      sourceReady:chapter?.precisionChapter?.sourceReady !== false,
      target:chapter?.precisionChapter?.targetPercent ?? null,
      incomplete:chapter?.precisionChapter?.outputAudit?.issues || [],
    };
  }, [chapter,readingVariant,dsaMode]);
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
    if (!isReader){setStudyScope('page');setStudyParagraphIndex(0);}
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
  }, [chapterIndex, tool, studyScope,studyParagraphIndex]);

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
    setAnswer(glossaryEntry?.definition ? {
      answer: glossaryEntry.definition,
      label: glossaryEntry.kind === 'reference' ? 'Riferimento' : 'Glossario',
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
    // No precomputed simpleSummary is ever shown as the Gemini live result.
    return editorialParagraphText(paragraph, { variant: 'study', dsaMode });
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
        {!isReader&&typeof onRead==='function'&&
          <button type="button" className="sb-lab129-reader-link"
            onClick={onRead}>Leggi</button>}
        <button type="button" className={`sb-lab06-audio${ttsSpeaking ? ' playing' : ''}`} onClick={ttsSpeaking ? stopReading : listenToCurrentContent} aria-label={ttsSpeaking ? 'Ferma la lettura vocale' : isReader ? 'Ascolta il capitolo' : 'Ascolta il contenuto di studio'} title={ttsSpeaking ? 'Ferma audio' : 'Ascolta'}><StudySoundIcon /></button>
      </header>
      {ttsError && <div className="sb-lab05-tts-error" role="alert">{ttsError} <button type="button" onClick={() => { void installItalianSpeechVoice().catch(error => setTtsError(error?.message || 'Controlla la sintesi vocale Android.')); }}>Installa voce italiana</button></div>}

      {(!isReader || !book?.canonicalBookMap) && <nav className="study-chapter-nav sb-lab05-chapter-nav sb-lab06-chapter-nav" aria-label="Navigazione tra i capitoli">
        <button type="button" onClick={() => changeChapter(chapterIndex - 1)} disabled={chapterIndex <= 0} aria-label="Capitolo precedente">←</button>
        <label className="sb-lab06-chapter-center">
          <span className="sb-lab06-chapter-counter">CAPITOLO <b>{chapterIndex + 1} / {chapterCount}</b></span>
          <span className="sb-lab06-chapter-full-title">{chapter.title}<span className="sb-lab06-dropdown" aria-hidden="true">⌄</span></span>
          <select aria-label="Scegli un capitolo dalla lista" value={chapterIndex} onChange={(event) => changeChapter(Number(event.target.value))}>
            {book.chapters.map((item, index) => <option value={index} key={`${item.title}-${index}`}>{index + 1}. {item.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => changeChapter(chapterIndex + 1)} disabled={chapterIndex >= chapterCount - 1} aria-label="Capitolo successivo">→</button>
      </nav>}

      {!isReader && <nav className="study-tool-tabs sb-lab05-study-tabs" aria-label="Metodi di studio">
        {[
          ['flashcards', 'Flashcard', 'flashcards'],
          ['quiz', 'Quiz', 'quiz'],
          ['map', 'Mappa', 'map'],
          ['oral', 'Interrogazione', 'oral'],
        ].map(([id, label, icon]) => (
          <button type="button" key={id} className={tool === id ? 'active' : ''} onClick={() => setTool(id)}>
            <StudyIcon name={icon} size={23} /><span>{label}</span>
          </button>
        ))}
      </nav>}

      {!isReader && <>
        <div className="study-scope-switch sb-v130-scopes" aria-label="Origine delle nuove attività di studio">
          <button type="button" className={studyScope==='page'?'active':''}
           onClick={()=>setStudyScope('page')}>Paragrafo</button>
          <button type="button" className={studyScope==='chapter'?'active':''}
           onClick={()=>setStudyScope('chapter')}>Capitolo</button>
          <button type="button" className={studyScope==='book'?'active':''}
           onClick={()=>setStudyScope('book')}>Intero libro</button>
        </div>
        {studyScope==='page'&&(chapter?.paragraphs?.length||0)>1&&
          <label className="sb-v130-paragraph-picker">Testo da studiare
            <select value={studyParagraphIndex}
             onChange={e=>setStudyParagraphIndex(Number(e.target.value))}>
              {(chapter.paragraphs||[]).map((p,i)=>
               <option value={i} key={i}>Paragrafo {i+1}
                {p.sourcePageStart?' · Pagina '+p.sourcePageStart:''}</option>)}
            </select>
          </label>}
        <section className="sb-v130-create" aria-label="Generazione Gemini su richiesta">
          <div>
            <strong>{tool==='flashcards'?'Flashcard':tool==='quiz'?'Quiz':
              tool==='map'?'Mappa concettuale':'Interrogazione'} con Gemini</strong>
            <small>
              {studyToolSource.passages.length?
                (studyToolSource.sampled?'Campione selezionato dal testo originale. ':
                 'Fonte originale selezionata. ')+
                (activeDeck.length?activeDeck.length+' attività conservate.':
                 'Nessuna chiamata Gemini eseguita per questa attività.'):
                'Nessun paragrafo originale sufficientemente completo.'}
            </small>
          </div>
          <button type="button" disabled={toolLoading||!studyToolSource.passages.length}
           onClick={()=>void generateToolDeck()}>
           {toolLoading?'Gemini sta preparando…':
            activeDeck.length?'Rigenera':'Crea '+(tool==='flashcards'?'flashcard':
             tool==='quiz'?'quiz':tool==='map'?'mappa':'interrogazione')}
          </button>
          {toolError&&<p role="alert">{toolError}</p>}
        </section>
      </>}

      {isReader && (
        <>
          <div className="study-reading-variant" aria-label="Versione del testo">
            <button type="button" className={readingVariant === 'study' ? 'active' : ''} onClick={() => setReadingVariant('study')}>Testo di studio</button>
            <button type="button" className={readingVariant === 'simple' ? 'active' : ''}
              onClick={() => {setReadingVariant('simple');setSimpleRequestToken(n=>n+1);}}
              disabled={!book?.canonicalBookMap}
              title={!book?.canonicalBookMap?'Serve la mappa delle pagine originali':'Chiedi ora a Gemini una spiegazione della pagina aperta'}>
              In parole semplici
            </button>
          </div>
          <div className="study-mode-tip">
            {readingVariant === 'study'
              ? 'Versione rigorosa e concentrata: conserva le informazioni utili allo studio.'
              : 'La spiegazione resta su questa pagina. Solo una nuova richiesta la sostituisce dopo il salvataggio.'}
          </div>
        </>
      )}

      {isReader && book?.canonicalBookMap && (
        <MirrorReaderV35 book={book} originalFile={originalFile} chapterIndex={chapterIndex}
          variant={readingVariant} simpleRequestToken={simpleRequestToken}
          bookTitle={bookTitle} bookId={bookId}/>
      )}
      {isReader && !book?.canonicalBookMap && (
        <main className="study-mode-pages" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <article className="study-continuous-sheet">
            <div className="study-continuous-main">
              <header className="study-continuous-chapter-head">
                <small>CAPITOLO {chapterIndex + 1}</small>
                <h1>{chapter.title}</h1>
                <p className="sb-lab10-hint">Tocca i termini in grassetto per scoprirne il significato, oppure seleziona qualsiasi parola.</p>
              </header>

              {(() => {
                // Group source chunks by their REAL section marker. The document
                // parser may split one long paragraph into several internal
                // units; those units must not become visible book page breaks.
                const sections = [];
                const chapterTitle = normalizedSection(chapter.title).toLocaleLowerCase('it-IT');
                (chapter.paragraphs || []).forEach((paragraph,index) => {
                  const sectionTitle = normalizedSection(paragraph.sourceSection);
                  const previous = sections[sections.length - 1];
                  if (!previous || previous.sectionTitle !== sectionTitle)
                    sections.push({sectionTitle,parts:[]});
                  sections[sections.length - 1].parts.push({paragraph,index});
                });
                return sections.map((section,sectionIndex) => (
                  <section className="study-source-section" key={chapterIndex+'-'+sectionIndex}>
                    {section.sectionTitle && section.sectionTitle.toLocaleLowerCase('it-IT') !== chapterTitle &&
                      <h3 className="study-flow-section-title">{section.sectionTitle}</h3>}
                    <div className="study-flow-narrative">
                      {section.parts.map(({paragraph,index}) => (
                        <div className="study-flow-fragment" key={chapterIndex+'-'+index}>
                          <InteractiveText
                            text={paragraphReadingText(paragraph)}
                            glossary={cleanGlossary(paragraph.glossary || [])}
                            chapterTerms={glossary}
                            onPick={(selection, glossaryEntry) => openTarget(selection, paragraph, glossaryEntry)}
                          />{' '}
                        </div>
                      ))}
                    </div>
                  </section>
                ));
              })()}
              <footer className="study-chapter-letter-count" aria-label="Conteggio lettere del capitolo">
                <span>Lettere risparmiate: {numberIt(chapterLetterStats.original - chapterLetterStats.current)}</span>
                <span>Righe risparmiate: {numberIt(chapterLetterStats.linesSaved)}</span>
                {!chapterLetterStats.sourceReady ? (
                  <p className="study-source-review-warning" role="alert">
                    Capitolo non pronto per lo studio: il controllo ha rilevato frasi interrotte, un confine incerto o una parte senza contesto. La versione ridotta è stata sospesa e il testo sorgente disponibile è stato mantenuto. Verificare le pagine originali e usare «Rielabora libro» se la fonte è completa. Nessuna parte mancante è stata inventata.
                  </p>
                ) : chapterLetterStats.sourceWarnings > 0 ? (
                  <p className="study-source-review-warning" role="status">
                    Fonte da verificare: alcuni frammenti o confini originali potrebbero richiedere il confronto con il PDF. La percentuale mostrata misura soltanto le lettere del capitolo, non certifica la correttezza del testo.
                  </p>
                ) : null}
              </footer>
            </div>
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
          ) : <EmptyTool>Premi «Crea flashcard» per prepararle con Gemini dal testo scelto.</EmptyTool>}
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
          ) : <EmptyTool>Premi «Crea quiz» per generare domande fondate sul testo scelto.</EmptyTool>}
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
          ) : <EmptyTool>Premi «Crea mappa» per collegare i concetti del testo scelto.</EmptyTool>}
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
          ) : <EmptyTool>Premi «Crea interrogazione» per avere domande originali su richiesta.</EmptyTool>}
        </main>
      )}

      {isReader && target && (
        <>
        <button type="button" className="sb-lab10-glossary-backdrop" aria-label="Chiudi glossario" onClick={() => setTarget(null)} />
        <section className="study-assistant-sheet sb-lab10-glossary-sheet" role="dialog" aria-modal="true" aria-label="Glossario intelligente" aria-live="polite">
          <div className="study-assistant-grip" />
          <div className="study-assistant-head">
            <div>
              <small>GLOSSARIO INTELLIGENTE</small>
              <strong>{target.selection}</strong>
            </div>
            <button type="button" onClick={() => setTarget(null)} aria-label="Chiudi spiegazione">×</button>
          </div>


          {!answer && !assistantBusy && <div className="sb-lab10-unverified">
            <p>{target.glossaryEntry?.kind === 'reference'
              ? 'Riferimento rilevato nel testo. Per conoscere il contenuto e la sua eventuale versione vigente serve una verifica della fonte.'
              : 'La definizione non è presente nel glossario disponibile. Puoi chiedere una spiegazione riferita a questo libro.'}</p>
            <button type="button" onClick={() => runAction('meaning')}>Che significa?</button>
          </div>}
          <details className="sb-lab10-more-actions"><summary>Altre spiegazioni e domande</summary>
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

          </details>
          {assistantBusy && <div className="study-assistant-loading">Sto preparando la spiegazione…</div>}
          {assistantError && <div className="study-assistant-error">{assistantError}</div>}
          {answer && (
            <div className="study-answer">
              {answer.basis === 'general' && <div className="study-answer-basis">Definizione generale · non è testo dell’autore</div>}
              {answer.fallback && <div className="sb-lab10-source-warning">Spiegazione ricavata dal contesto disponibile, non una definizione verificata.</div>}
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
        </>
      )}
    </div>
  );
}
