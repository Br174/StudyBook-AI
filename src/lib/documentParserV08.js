import JSZip from 'jszip';
import {
  detectChaptersFromPages,
  readSourceFile as readLegacySourceFile,
  splitIntoParagraphs,
} from './documentParser.js';

const MAX_MEDIA_ITEMS = 40;
const MAX_SINGLE_MEDIA_BASE64 = 5_500_000;
const MAX_TOTAL_MEDIA_BASE64 = 24_000_000;

function cleanText(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseXml(text, mime = 'application/xml') {
  const doc = new DOMParser().parseFromString(text, mime);
  if (doc.querySelector('parsererror')) throw new Error('Documento interno non leggibile.');
  return doc;
}

function attr(node, ...names) {
  for (const name of names) {
    const value = node?.getAttribute?.(name);
    if (value != null && value !== '') return value;
  }
  return '';
}

function mimeFromPath(path = '') {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  return 'application/octet-stream';
}

function normalizePath(path) {
  const out = [];
  String(path || '').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') out.pop();
    else out.push(part);
  });
  return out.join('/');
}

function resolvePath(baseFile, relative) {
  if (!relative) return '';
  if (/^[a-z]+:/i.test(relative)) return relative;
  const base = String(baseFile || '').split('/').slice(0, -1).join('/');
  return normalizePath(`${base}/${relative}`);
}

function makeStructure(chapters, assets = [], pageCount = 0) {
  return {
    pageCount,
    chapterCount: chapters.length,
    sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
    paragraphCount: chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0),
    assetCount: assets.length,
    imageCount: assets.filter((item) => item.type === 'image').length,
    tableCount: assets.filter((item) => item.type === 'table').length,
  };
}

function addParagraph(chapter, text, currentSection, sourcePart = '') {
  const paragraphs = splitIntoParagraphs(cleanText(text));
  paragraphs.forEach((paragraph) => {
    chapter.paragraphs.push(paragraph);
    chapter.paragraphMeta.push({
      pageStart: null,
      pageEnd: null,
      sectionTitle: currentSection?.title || null,
      sectionLevel: currentSection?.level || null,
      sourcePart: sourcePart || null,
    });
  });
}

function buildChaptersFromBlocks(blocks) {
  const chapters = [];
  let currentChapter = null;
  let currentSection = null;

  const ensureChapter = () => {
    if (!currentChapter) {
      currentChapter = {
        title: 'Documento',
        pageStart: null,
        pageEnd: null,
        sections: [],
        paragraphs: [],
        paragraphMeta: [],
      };
      chapters.push(currentChapter);
    }
    return currentChapter;
  };

  blocks.forEach((block) => {
    if (!block?.text && block?.type !== 'table') return;

    if (block.type === 'heading') {
      const level = Math.max(1, Math.min(6, Number(block.level || 1)));
      if (level === 1) {
        currentChapter = {
          title: cleanText(block.text) || `Capitolo ${chapters.length + 1}`,
          pageStart: null,
          pageEnd: null,
          sections: [],
          paragraphs: [],
          paragraphMeta: [],
        };
        chapters.push(currentChapter);
        currentSection = null;
      } else {
        const chapter = ensureChapter();
        currentSection = {
          title: cleanText(block.text),
          level,
          pageStart: null,
          pageEnd: null,
        };
        chapter.sections.push(currentSection);
      }
      return;
    }

    const chapter = ensureChapter();
    addParagraph(chapter, block.text, currentSection, block.sourcePart);
  });

  const useful = chapters.filter((chapter) => chapter.paragraphs.length || chapter.sections.length);
  return useful.length ? useful : [{
    title: 'Documento',
    pageStart: null,
    pageEnd: null,
    sections: [],
    paragraphs: [],
    paragraphMeta: [],
  }];
}

function docxParagraphText(paragraph) {
  const values = [];
  paragraph.childNodes.forEach((node) => {
    if (node.nodeType !== 1) return;
    const texts = node.getElementsByTagName?.('w:t') || [];
    for (const text of texts) values.push(text.textContent || '');
    if (node.nodeName === 'w:tab') values.push('\t');
    if (node.nodeName === 'w:br') values.push('\n');
  });
  if (!values.length) {
    const texts = paragraph.getElementsByTagName('w:t');
    for (const text of texts) values.push(text.textContent || '');
  }
  return cleanText(values.join(' '));
}

function docxHeadingLevel(paragraph) {
  const style = paragraph.getElementsByTagName('w:pStyle')?.[0];
  const value = attr(style, 'w:val', 'val');
  if (!value) return 0;
  const match = value.match(/(?:heading|titolo)[ _-]*([1-6])/i);
  if (match) return Number(match[1]);
  return 0;
}

function docxTableRows(table) {
  return [...table.getElementsByTagName('w:tr')]
    .map((row) => [...row.getElementsByTagName('w:tc')]
      .map((cell) => cleanText([...cell.getElementsByTagName('w:t')].map((node) => node.textContent || '').join(' ')))
      .filter(Boolean))
    .filter((row) => row.length);
}

function tableText(rows) {
  if (!rows.length) return '';
  return `Tabella. ${rows.map((row) => row.join(' | ')).join(' ; ')}`;
}

async function zipImageAsset(zipEntry, path, extra = {}) {
  if (!zipEntry) return null;
  const base64 = await zipEntry.async('base64');
  if (!base64 || base64.length > MAX_SINGLE_MEDIA_BASE64) return null;
  const mime = mimeFromPath(path);
  if (!mime.startsWith('image/')) return null;
  return {
    type: 'image',
    name: path.split('/').pop() || 'immagine',
    mime,
    dataUrl: `data:${mime};base64,${base64}`,
    sourcePath: path,
    ...extra,
  };
}

function trimAssets(assets) {
  let total = 0;
  const kept = [];
  for (const asset of assets) {
    const size = asset?.dataUrl?.length || JSON.stringify(asset?.rows || []).length;
    if (kept.length >= MAX_MEDIA_ITEMS) break;
    if (total + size > MAX_TOTAL_MEDIA_BASE64) break;
    total += size;
    kept.push(asset);
  }
  return kept;
}

async function parseDocx(file, { onProgress } = {}) {
  onProgress?.({ phase: 'rich-open', format: 'DOCX' });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('DOCX non valido: manca il documento principale.');

  const xml = parseXml(await documentEntry.async('string'));
  const body = xml.getElementsByTagName('w:body')?.[0];
  const blocks = [];
  const assets = [];
  let tableIndex = 0;

  [...(body?.childNodes || [])].forEach((node) => {
    if (node.nodeType !== 1) return;
    if (node.nodeName === 'w:p') {
      const text = docxParagraphText(node);
      if (!text) return;
      const level = docxHeadingLevel(node);
      blocks.push(level
        ? { type: 'heading', level, text, sourcePart: 'word/document.xml' }
        : { type: 'paragraph', text, sourcePart: 'word/document.xml' });
      return;
    }
    if (node.nodeName === 'w:tbl') {
      const rows = docxTableRows(node);
      if (!rows.length) return;
      tableIndex += 1;
      assets.push({ type: 'table', name: `Tabella ${tableIndex}`, rows, sourcePath: 'word/document.xml' });
      blocks.push({ type: 'table', text: tableText(rows), sourcePart: 'word/document.xml' });
    }
  });

  onProgress?.({ phase: 'rich-assets', format: 'DOCX' });
  const mediaEntries = Object.keys(zip.files)
    .filter((path) => /^word\/media\//i.test(path) && !zip.files[path].dir)
    .slice(0, MAX_MEDIA_ITEMS);

  for (const path of mediaEntries) {
    try {
      const asset = await zipImageAsset(zip.file(path), path, { sourcePart: 'DOCX' });
      if (asset) assets.push(asset);
    } catch {
      // Un'immagine corrotta non deve bloccare l'import del libro.
    }
  }

  const chapters = buildChaptersFromBlocks(blocks);
  const fullText = chapters.flatMap((chapter) => chapter.paragraphs).join('\n\n');
  const preservedAssets = trimAssets(assets);
  onProgress?.({ phase: 'complete', done: 1, total: 1 });

  return {
    fullText,
    pages: [],
    chapters,
    needsOcr: [],
    ocrApplied: [],
    removedRunningLines: [],
    sourceFormat: 'docx',
    assets: preservedAssets,
    assetsTruncated: Math.max(0, assets.length - preservedAssets.length),
    structure: makeStructure(chapters, preservedAssets, 0),
  };
}

function epubDocument(xmlText) {
  let doc = new DOMParser().parseFromString(xmlText, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) doc = new DOMParser().parseFromString(xmlText, 'text/html');
  return doc;
}

function epubTableRows(table) {
  return [...table.querySelectorAll('tr')]
    .map((row) => [...row.querySelectorAll('th,td')].map((cell) => cleanText(cell.textContent)).filter(Boolean))
    .filter((row) => row.length);
}

async function parseEpub(file, { onProgress } = {}) {
  onProgress?.({ phase: 'rich-open', format: 'EPUB' });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) throw new Error('EPUB non valido: manca META-INF/container.xml.');

  const container = parseXml(await containerEntry.async('string'));
  const rootfile = container.querySelector('rootfile');
  const opfPath = attr(rootfile, 'full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('EPUB non valido: indice principale non trovato.');

  const opf = parseXml(await zip.file(opfPath).async('string'));
  const manifest = new Map();
  [...opf.querySelectorAll('manifest > item')].forEach((item) => {
    manifest.set(attr(item, 'id'), {
      href: attr(item, 'href'),
      mediaType: attr(item, 'media-type'),
    });
  });
  const spineIds = [...opf.querySelectorAll('spine > itemref')].map((item) => attr(item, 'idref')).filter(Boolean);
  const titleNode = opf.querySelector('metadata > title, metadata > dc\\:title');
  const sourceTitle = cleanText(titleNode?.textContent || file.name.replace(/\.epub$/i, ''));

  const blocks = [];
  const assets = [];
  const seenImages = new Set();
  let tableIndex = 0;

  for (let index = 0; index < spineIds.length; index += 1) {
    const item = manifest.get(spineIds[index]);
    if (!item?.href) continue;
    const partPath = resolvePath(opfPath, item.href);
    const entry = zip.file(partPath);
    if (!entry) continue;
    onProgress?.({ phase: 'rich-part', format: 'EPUB', done: index + 1, total: spineIds.length });

    const doc = epubDocument(await entry.async('string'));
    const nodes = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,table,img')];
    for (const node of nodes) {
      const tag = node.tagName?.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = cleanText(node.textContent);
        if (text) blocks.push({ type: 'heading', level: Number(tag.slice(1)), text, sourcePart: partPath });
        continue;
      }
      if (tag === 'p') {
        if (node.closest('table')) continue;
        const text = cleanText(node.textContent);
        if (text) blocks.push({ type: 'paragraph', text, sourcePart: partPath });
        continue;
      }
      if (tag === 'table') {
        const rows = epubTableRows(node);
        if (!rows.length) continue;
        tableIndex += 1;
        assets.push({ type: 'table', name: `Tabella ${tableIndex}`, rows, sourcePath: partPath });
        blocks.push({ type: 'table', text: tableText(rows), sourcePart: partPath });
        continue;
      }
      if (tag === 'img') {
        const src = node.getAttribute('src');
        const imagePath = resolvePath(partPath, src);
        if (!imagePath || seenImages.has(imagePath) || assets.length >= MAX_MEDIA_ITEMS) continue;
        seenImages.add(imagePath);
        try {
          const asset = await zipImageAsset(zip.file(imagePath), imagePath, {
            sourcePart: partPath,
            alt: cleanText(node.getAttribute('alt') || ''),
          });
          if (asset) assets.push(asset);
        } catch {
          // Un'immagine mancante non deve bloccare l'EPUB.
        }
      }
    }
  }

  const chapters = buildChaptersFromBlocks(blocks);
  if (chapters.length === 1 && chapters[0].title === 'Documento' && sourceTitle) chapters[0].title = sourceTitle;
  const fullText = chapters.flatMap((chapter) => chapter.paragraphs).join('\n\n');
  if (!fullText) throw new Error('EPUB letto, ma non contiene testo utilizzabile.');

  const preservedAssets = trimAssets(assets);
  onProgress?.({ phase: 'complete', done: spineIds.length, total: spineIds.length });

  return {
    fullText,
    pages: [],
    chapters,
    needsOcr: [],
    ocrApplied: [],
    removedRunningLines: [],
    sourceFormat: 'epub',
    sourceTitle,
    assets: preservedAssets,
    assetsTruncated: Math.max(0, assets.length - preservedAssets.length),
    structure: makeStructure(chapters, preservedAssets, 0),
  };
}

async function enrichImageSource(file, options) {
  const parsed = await readLegacySourceFile(file, options);
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Immagine non leggibile.'));
      reader.readAsDataURL(file);
    });
    if (dataUrl.length <= MAX_SINGLE_MEDIA_BASE64) {
      parsed.assets = [{
        type: 'image',
        name: file.name,
        mime: file.type || mimeFromPath(file.name),
        dataUrl,
        sourcePath: file.name,
        sourcePart: 'immagine importata',
      }];
      parsed.structure = { ...(parsed.structure || {}), assetCount: 1, imageCount: 1, tableCount: 0 };
    }
  } catch {
    // L'OCR resta valido anche se la copia visuale non può essere conservata.
  }
  parsed.sourceFormat = 'image';
  return parsed;
}

export async function readSourceFile(file, options = {}) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.docx')) return parseDocx(file, options);
  if (name.endsWith('.epub')) return parseEpub(file, options);
  if (/\.(png|jpe?g|webp)$/i.test(name)) return enrichImageSource(file, options);
  const parsed = await readLegacySourceFile(file, options);
  return {
    ...parsed,
    sourceFormat: name.endsWith('.pdf') ? 'pdf' : name.endsWith('.txt') ? 'txt' : parsed.sourceFormat,
    assets: parsed.assets || [],
  };
}

export { detectChaptersFromPages };
