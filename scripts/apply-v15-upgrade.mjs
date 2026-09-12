import fs from 'node:fs';

function replaceOnce(input, from, to, label) {
  if (!input.includes(from)) throw new Error(`Patch v0.15 non applicabile: ${label}`);
  return input.replace(from, to);
}

function replaceRegex(input, regex, to, label) {
  if (!regex.test(input)) throw new Error(`Patch v0.15 non applicabile: ${label}`);
  regex.lastIndex = 0;
  return input.replace(regex, to);
}

let app = fs.readFileSync('src/AppV14.jsx', 'utf8');

app = replaceOnce(
  app,
  "import './v11.css';",
  "import { compressScannerImage, estimateScannerStorage, formatStorageBytes, requestScannerPersistence } from './lib/scannerStorage.js';\nimport './v11.css';\nimport './scanner-storage.css';",
  'import storage guard',
);

app = replaceOnce(
  app,
  "  const [scannerStoreReady, setScannerStoreReady] = useState(false);",
  "  const [scannerStoreReady, setScannerStoreReady] = useState(false);\n  const [scannerStorageInfo, setScannerStorageInfo] = useState(null);\n  const [scannerOptimizing, setScannerOptimizing] = useState(false);",
  'scanner storage state',
);

app = replaceOnce(
  app,
  "  function scheduleScannerPageSave(page, delay = 0) {",
  `  async function refreshScannerStorage(extraBytes = 0) {
    const info = await estimateScannerStorage(extraBytes);
    setScannerStorageInfo(info);
    return info;
  }

  function scheduleScannerPageSave(page, delay = 0) {`,
  'storage refresh helper',
);

app = replaceOnce(
  app,
  `    const persist = () => {
      timers.delete(page.id);
      saveScannerPageRecord(page);
    };`,
  `    const persist = async () => {
      timers.delete(page.id);
      await saveScannerPageRecord(page);
      refreshScannerStorage();
    };`,
  'scanner page persistence refresh',
);

app = replaceOnce(
  app,
  "  useEffect(() => { refreshLibrary(); }, []);",
  "  useEffect(() => { refreshLibrary(); refreshScannerStorage(); }, []);",
  'initial storage estimate',
);

app = replaceOnce(
  app,
  `      const saved = await persistBook(result, sourceData, sourceName, libraryId);
      setScannerResultReady(fromScanner);`,
  `      const saved = await persistBook(result, sourceData, sourceName, libraryId);
      setScannerResultReady(fromScanner);
      if (fromScanner && saved) {
        scanPersistTimersRef.current.forEach((timer) => clearTimeout(timer));
        scanPersistTimersRef.current.clear();
        scanPagesRef.current.forEach((page) => page.previewUrl && URL.revokeObjectURL(page.previewUrl));
        setScanPagesNow([]);
        await clearScannerSessionStore();
        await refreshScannerStorage();
      }`,
  'release completed scanner images',
);

app = replaceRegex(
  app,
  /  async function addScanPage\(file\) \{[\s\S]*?\n  \}\n\n  async function capturePhoto/,
  `  async function addScanPage(file) {
    if (!file || scanProcessing || scannerOptimizing) return;
    setScannerOptimizing(true);
    setError('');
    try {
      setStatus('Ottimizzo la foto per OCR e spazio locale…');
      if (!scanPagesRef.current.length) requestScannerPersistence();
      const optimizedFile = await compressScannerImage(file);
      const storage = await refreshScannerStorage(optimizedFile.size);
      if (storage?.risk === 'blocked') {
        throw new Error('Spazio locale insufficiente per aggiungere un’altra pagina in sicurezza. Completa o svuota la raccolta prima di continuare.');
      }

      const id = scanId();
      const pageNumber = scanPagesRef.current.length + 1;
      const previewUrl = URL.createObjectURL(optimizedFile);
      const page = {
        id,
        file: optimizedFile,
        previewUrl,
        status: 'processing',
        text: '',
        error: '',
        originalBytes: Number(file.size || optimizedFile.size || 0),
        storedBytes: Number(optimizedFile.size || 0),
        optimized: Number(optimizedFile.size || 0) < Number(file.size || 0) * 0.98,
      };
      setScannerResultReady(false);
      setScanPagesNow((pages) => [...pages, page]);
      scheduleScannerPageSave(page);
      await recognizeScanPage(id, optimizedFile, pageNumber);
      await refreshScannerStorage();
    } catch (err) {
      setError(err.message || 'Non riesco ad aggiungere questa pagina.');
      setStatus('Pagina non aggiunta');
    } finally {
      setScannerOptimizing(false);
    }
  }

  async function capturePhoto`,
  'optimized add scan page',
);

app = replaceOnce(
  app,
  "    deleteScannerPageRecord(id);",
  "    deleteScannerPageRecord(id).finally(() => refreshScannerStorage());",
  'refresh storage after delete',
);

app = replaceOnce(
  app,
  "    clearScannerSessionStore();\n    setScannerResultReady(false);",
  "    clearScannerSessionStore().finally(() => refreshScannerStorage());\n    setScannerResultReady(false);",
  'refresh storage after clear',
);

app = app.replaceAll('v0.14', 'v0.15');
app = app.replaceAll(
  'disabled={importing || generating || scanProcessing}',
  'disabled={importing || generating || scanProcessing || scannerOptimizing}',
);
app = app.replaceAll(
  "📷 {scanPages.length ? 'Aggiungi pagina' : 'Scanner'}",
  "📷 {scannerOptimizing ? 'Ottimizzo foto…' : (scanPages.length ? 'Aggiungi pagina' : 'Scanner')}",
);

app = replaceOnce(
  app,
  '<p>PDF, DOCX, EPUB, TXT e fotografie. Le foto restano localmente solo mentre una raccolta scanner è incompleta; non vengono inserite nel libro di studio.</p>',
  '<p>PDF, DOCX, EPUB, TXT e fotografie. Le foto scanner vengono ottimizzate per ridurre lo spazio, restano locali solo mentre la raccolta è incompleta e non entrano nel libro di studio.</p>',
  'import panel storage copy',
);

app = replaceOnce(
  app,
  '<div><span className="eyebrow dark">SCANSIONI</span><h2>{scanPages.length} {scanPages.length === 1 ? \'pagina\' : \'pagine\'} · {scanReadyCount} pronte</h2><p>Salvataggio automatico locale: foto, ordine e testo OCR della raccolta incompleta restano sul dispositivo per poter riprendere anche dopo la chiusura dell’app.</p></div>',
  '<div><span className="eyebrow dark">SCANSIONI</span><h2>{scanPages.length} {scanPages.length === 1 ? \'pagina\' : \'pagine\'} · {scanReadyCount} pronte</h2><p>Salvataggio automatico locale: le foto vengono compresse in modo conservativo per l’OCR e vengono eliminate dall’archivio scanner appena il libro è creato e salvato in Libreria.</p></div>',
  'scanner basket copy',
);

app = replaceOnce(
  app,
  '          <div className="scan-page-grid">',
  `          {scannerStorageInfo && (
            <div className={\`scanner-storage-meter \${scannerStorageInfo.risk || 'unknown'}\`}>
              <div className="scanner-storage-head">
                <strong>Protezione spazio scanner</strong>
                <span>{scannerStorageInfo.supported && scannerStorageInfo.quota
                  ? \`Quota locale: \${formatStorageBytes(scannerStorageInfo.usage)} / \${formatStorageBytes(scannerStorageInfo.quota)}\`
                  : 'Stima quota locale non disponibile'}</span>
              </div>
              {scannerStorageInfo.ratio != null && <div className="scanner-storage-track" aria-label="Uso spazio locale"><span style={{ width: \`\${Math.min(100, Math.max(1, Math.round(scannerStorageInfo.ratio * 100)))}%\` }} /></div>}
              <small>{scannerStorageInfo.risk === 'blocked'
                ? 'Spazio quasi esaurito: nuove pagine vengono bloccate per evitare una raccolta incompleta o corrotta.'
                : scannerStorageInfo.risk === 'critical'
                  ? 'Spazio molto ridotto: conviene completare presto questa raccolta.'
                  : scannerStorageInfo.risk === 'warning'
                    ? 'Lo spazio locale sta diminuendo; StudyBook AI continua a comprimere le nuove foto.'
                    : 'Le nuove foto vengono ridimensionate e compresse senza abbassare intenzionalmente la leggibilità OCR.'}</small>
            </div>
          )}
          <div className="scan-page-grid">`,
  'storage meter UI',
);

app = replaceOnce(
  app,
  '<div className="scan-page-title"><strong>Pagina {index + 1}</strong><span className={`scan-status ${page.status}`}>{page.status === \'ready\' ? \'Pronta\' : page.status === \'error\' ? \'Da rifare\' : \'OCR…\'}</span></div>',
  '<div className="scan-page-title"><strong>Pagina {index + 1}</strong><span className={`scan-status ${page.status}`}>{page.status === \'ready\' ? \'Pronta\' : page.status === \'error\' ? \'Da rifare\' : \'OCR…\'}</span></div>{page.storedBytes > 0 && <small className="scan-file-size">{formatStorageBytes(page.storedBytes)}{page.optimized && page.originalBytes > page.storedBytes ? ` · ottimizzata da ${formatStorageBytes(page.originalBytes)}` : \'\'}</small>}',
  'per-page optimized size',
);

app = replaceOnce(
  app,
  '<button type="button" className="scanner-button" onClick={openScanner} disabled={scanProcessing || generating}>📷 Aggiungi pagina</button>',
  '<button type="button" className="scanner-button" onClick={openScanner} disabled={scanProcessing || generating || scannerOptimizing}>📷 {scannerOptimizing ? \'Ottimizzo foto…\' : \'Aggiungi pagina\'}</button>',
  'scanner basket optimize state',
);

fs.writeFileSync('src/AppV15.jsx', app);

let main = fs.readFileSync('src/main.jsx', 'utf8');
main = replaceOnce(main, "import AppV14 from './AppV14.jsx';", "import AppV15 from './AppV15.jsx';", 'main import');
main = replaceOnce(main, '<AppV14 />', '<AppV15 />', 'main component');
fs.writeFileSync('src/main.jsx', main);

let pkg = fs.readFileSync('package.json', 'utf8');
pkg = replaceOnce(pkg, '"version": "0.14.0"', '"version": "0.15.0"', 'package version');
fs.writeFileSync('package.json', pkg);

let readme = fs.readFileSync('README.md', 'utf8');
readme = readme.replace('## Stato attuale · v0.11', '## Stato attuale · v0.15');
if (!readme.includes('### Protezione spazio scanner v0.15')) {
  readme += `\n\n### Protezione spazio scanner v0.15\n\nLe fotografie delle raccolte scanner vengono ottimizzate prima del salvataggio locale: StudyBook AI riduce in modo conservativo la risoluzione e usa JPEG ad alta qualità quando questo produce un risparmio reale, mantenendo una dimensione adatta all’OCR. L’app controlla inoltre la quota di archiviazione concessa dal browser/app, segnala i livelli di attenzione e blocca una nuova pagina solo quando manca il margine minimo necessario per salvarla in sicurezza.\n\nQuando una raccolta scanner è stata trasformata con successo in un libro e il libro è stato salvato nella Libreria, le fotografie temporanee della raccolta vengono cancellate automaticamente; nel libro finale resta il testo, non l’archivio fotografico.\n`;
}
fs.writeFileSync('README.md', readme);

console.log('StudyBook AI v0.15 integration applied.');
