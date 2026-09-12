import fs from 'node:fs';

function replaceOnce(input, from, to, label) {
  if (!input.includes(from)) throw new Error(`Patch v0.14 non applicabile: ${label}`);
  return input.replace(from, to);
}

let app = fs.readFileSync('src/AppV11.jsx', 'utf8');

app = replaceOnce(
  app,
  "import { detectChaptersFromPages, readSourceFile } from './lib/documentParserV09.js';",
  "import { detectChaptersFromPages, readSourceFile } from './lib/documentParserV11.js';",
  'parser V11',
);
app = replaceOnce(
  app,
  "import { buildStudyBook, refineParagraphWithAi, summaryLevels } from './lib/studyEngineV09.js';",
  "import { buildStudyBook, refineParagraphWithAi, summaryLevels } from './lib/studyEngineV10.js';",
  'study engine V10',
);
app = replaceOnce(
  app,
  "import StudyMode from './components/StudyMode.jsx';\nimport './v11.css';",
  `import StudyMode from './components/StudyMode.jsx';
import {
  clearScannerSessionStore,
  deleteScannerPage as deleteScannerPageRecord,
  loadScannerSession,
  saveScannerMeta,
  saveScannerPage as saveScannerPageRecord,
} from './lib/scannerSessionStore.js';
import './v11.css';`,
  'scanner store imports',
);
app = replaceOnce(app, 'export default function AppV11() {', 'export default function AppV14() {', 'component name');
app = replaceOnce(
  app,
  "  const [scannerResultReady, setScannerResultReady] = useState(false);",
  "  const [scannerResultReady, setScannerResultReady] = useState(false);\n  const [scannerStoreReady, setScannerStoreReady] = useState(false);",
  'scanner store state',
);
app = replaceOnce(
  app,
  '  const scanPagesRef = useRef([]);',
  `  const scanPagesRef = useRef([]);
  const scanPersistTimersRef = useRef(new Map());
  const scannerRestoreStartedRef = useRef(false);`,
  'scanner refs',
);
app = replaceOnce(
  app,
  '  const progressPercent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;\n',
  `  const progressPercent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  function setScanPagesNow(updater) {
    const current = scanPagesRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    scanPagesRef.current = next;
    setScanPages(next);
    return next;
  }

  function scheduleScannerPageSave(page, delay = 0) {
    if (!page?.id || !page?.file) return;
    const timers = scanPersistTimersRef.current;
    const previous = timers.get(page.id);
    if (previous) clearTimeout(previous);

    const persist = () => {
      timers.delete(page.id);
      saveScannerPageRecord(page);
    };

    if (delay > 0) timers.set(page.id, setTimeout(persist, delay));
    else persist();
  }
`,
  'scanner helpers',
);
app = replaceOnce(
  app,
  `  useEffect(() => { scanPagesRef.current = scanPages; }, [scanPages]);
  useEffect(() => { refreshLibrary(); }, []);`,
  `  useEffect(() => { scanPagesRef.current = scanPages; }, [scanPages]);
  useEffect(() => { refreshLibrary(); }, []);
  useEffect(() => {
    if (scannerRestoreStartedRef.current) return undefined;
    scannerRestoreStartedRef.current = true;
    let cancelled = false;

    (async () => {
      const restored = await loadScannerSession();
      if (cancelled) return;
      if (restored?.pages?.length) {
        const restoredPages = restored.pages.map((page) => ({
          ...page,
          previewUrl: URL.createObjectURL(page.file),
        }));
        scanPagesRef.current = restoredPages;
        setScanPages(restoredPages);
        setScanSessionName(restored.name || 'Appunti fotografati');
        const interrupted = restoredPages.filter((page) => page.status === 'error').length;
        setStatus(\`Raccolta scanner ripristinata · \${restoredPages.length} pagine\${interrupted ? \` · \${interrupted} da riprendere\` : ''}\`);
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
  }, [scannerStoreReady, scanSessionName, scanPages]);`,
  'scanner restore effects',
);
app = replaceOnce(
  app,
  `  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
  }, []);`,
  `  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
    scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
  }, []);`,
  'scanner cleanup',
);
app = replaceOnce(
  app,
  `  function patchScanPage(id, patch) {
    setScanPages((pages) => pages.map((page) => page.id === id ? { ...page, ...patch } : page));
  }`,
  `  function patchScanPage(id, patch, { persistDelay = 0 } = {}) {
    const nextPages = setScanPagesNow((pages) => pages.map((page) => page.id === id ? { ...page, ...patch } : page));
    const nextPage = nextPages.find((page) => page.id === id);
    if (nextPage) scheduleScannerPageSave(nextPage, persistDelay);
  }`,
  'patch scan page',
);
app = replaceOnce(
  app,
  '      setStatus(`Pagina ${pageNumber} pronta · controlla oppure aggiungi la successiva`);',
  '      setStatus(`Pagina ${pageNumber} pronta · salvata automaticamente`);',
  'OCR ready status',
);
app = replaceOnce(
  app,
  `  async function addScanPage(file) {
    if (!file || scanProcessing) return;
    const id = scanId();
    const pageNumber = scanPages.length + 1;
    const previewUrl = URL.createObjectURL(file);
    setScannerResultReady(false);
    setScanPages((pages) => [...pages, { id, file, previewUrl, status: 'processing', text: '', error: '' }]);
    await recognizeScanPage(id, file, pageNumber);
  }`,
  `  async function addScanPage(file) {
    if (!file || scanProcessing) return;
    const id = scanId();
    const pageNumber = scanPagesRef.current.length + 1;
    const previewUrl = URL.createObjectURL(file);
    const page = { id, file, previewUrl, status: 'processing', text: '', error: '' };
    setScannerResultReady(false);
    setScanPagesNow((pages) => [...pages, page]);
    scheduleScannerPageSave(page);
    await recognizeScanPage(id, file, pageNumber);
  }`,
  'add scan page',
);
app = replaceOnce(
  app,
  `  function moveScanPage(index, direction) {
    if (scanProcessing) return;
    setScanPages((pages) => {
      const target = index + direction;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }`,
  `  function moveScanPage(index, direction) {
    if (scanProcessing) return;
    setScanPagesNow((pages) => {
      const target = index + direction;
      if (target < 0 || target >= pages.length) return pages;
      const next = [...pages];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }`,
  'move scan page',
);
app = replaceOnce(
  app,
  `  function removeScanPage(id) {
    if (scanProcessing || generating) return;
    setScanPages((pages) => {
      const page = pages.find((item) => item.id === id);
      if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
      return pages.filter((item) => item.id !== id);
    });
  }`,
  `  function removeScanPage(id) {
    if (scanProcessing || generating) return;
    const page = scanPagesRef.current.find((item) => item.id === id);
    if (page?.previewUrl) URL.revokeObjectURL(page.previewUrl);
    const timer = scanPersistTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    scanPersistTimersRef.current.delete(id);
    setScanPagesNow((pages) => pages.filter((item) => item.id !== id));
    deleteScannerPageRecord(id);
  }`,
  'remove scan page',
);
app = replaceOnce(
  app,
  `  function clearScanSession() {
    if (scanProcessing || generating) return;
    scanPages.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
    setScanPages([]);
    setScannerResultReady(false);
    setStatus('Raccolta scansioni svuotata');
  }`,
  `  function clearScanSession() {
    if (scanProcessing || generating) return;
    scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
    scanPersistTimersRef.current.clear();
    scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
    setScanPagesNow([]);
    clearScannerSessionStore();
    setScannerResultReady(false);
    setStatus('Raccolta scansioni svuotata');
  }`,
  'clear scan session',
);
app = replaceOnce(
  app,
  'onChange={(event) => patchScanPage(page.id, { text: event.target.value })}',
  'onChange={(event) => patchScanPage(page.id, { text: event.target.value }, { persistDelay: 600 })}',
  'OCR textarea persistence',
);
app = app.replace('STUDYBOOK AI · v0.11', 'STUDYBOOK AI · v0.14');
app = app.replace(
  'PDF, DOCX, EPUB, TXT e fotografie. Le immagini servono solo come sorgente OCR: non vengono conservate nel libro di studio.',
  'PDF, DOCX, EPUB, TXT e fotografie. Le foto restano localmente solo mentre una raccolta scanner è incompleta; non vengono inserite nel libro di studio.',
);
app = app.replace(
  'Le foto sono temporanee: dopo l’OCR il progetto conserva il testo, non le immagini.',
  'Salvataggio automatico locale: foto, ordine e testo OCR della raccolta incompleta restano sul dispositivo per poter riprendere anche dopo la chiusura dell’app.',
);
app = app.replace(
  'La foto viene usata per l’OCR e resta solo nella raccolta temporanea. Nel libro di studio salviamo il testo.',
  'La foto viene salvata localmente nella raccolta scanner finché il lavoro è incompleto. Nel libro di studio finale salviamo il testo, non la foto.',
);

fs.writeFileSync('src/AppV14.jsx', app);

let main = fs.readFileSync('src/main.jsx', 'utf8');
main = main.replace("import AppV11 from './AppV11.jsx';", "import AppV14 from './AppV14.jsx';");
main = main.replace('<AppV11 />', '<AppV14 />');
fs.writeFileSync('src/main.jsx', main);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '0.14.0';
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

let workflow = fs.readFileSync('.github/workflows/build.yml', 'utf8');
if (!workflow.includes('Test scanner session persistence')) {
  workflow = workflow.replace(
    '      - name: Stress test 600-page text pipeline',
    '      - name: Test scanner session persistence\n        run: node scripts/test-scanner-session-store.mjs\n      - name: Stress test 600-page text pipeline',
  );
}
fs.writeFileSync('.github/workflows/build.yml', workflow);

const readmePath = 'README.md';
let readme = fs.readFileSync(readmePath, 'utf8');
if (!readme.includes('Scanner persistente v0.14')) {
  readme += `\n\n### Scanner persistente v0.14\n\nLe raccolte scanner multipagina incomplete vengono salvate localmente in IndexedDB: foto sorgente, ordine delle pagine e testo OCR possono essere ripristinati dopo la chiusura dell'app. Le foto servono solo a completare l'OCR della raccolta e non vengono incorporate nel libro di studio finale. Le sessioni scanner locali scadono dopo 30 giorni.\n`;
}
fs.writeFileSync(readmePath, readme);

console.log('StudyBook AI v0.14 integration applied.');
