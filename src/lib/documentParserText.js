import JSZip from 'jszip';
import {
  readSourceFile as readLegacySourceFile,
  splitIntoParagraphs,
} from './documentParser.js';

function clean(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseXml(text, mime = 'application/xml') {
  const doc = new DOMParser().parseFromString(text, mime);
  if ([...doc.getElementsByTagName('*')].some((node) => node.localName === 'parsererror')) {
    throw new Error('Documento interno non leggibile.');
  }
  return doc;
}

function byLocalName(root, name) {
  return [...(root?.getElementsByTagName?.('*') || [])].filter((node) => node.localName === name);
}

function firstByLocalName(root, name) {
  return byLocalName(root, name)[0] || null;
}

function attr(node, ...names) {
  for (const name of names) {
    const value = node?.getAttribute?.(name);
    if (value != null && value !== '') return value;
  }
  return '';
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

function makeStructure(chapters, pageCount = 0) {
  return {
    pageCount,
    chapterCount: chapters.length,
    sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
    paragraphCount: chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0),
    textFirst: true,
  };
}

function newChapter(title) {
  return {
    title: clean(title) || 'Documento',
    pageStart: null,
    pageEnd: null,
    sections: [],
    paragraphs: [],
    paragraphMeta: [],
  };
}

function addParagraph(chapter, text, currentSection, sourcePart = '') {
  splitIntoParagraphs(clean(text)).forEach((paragraph) => {
    if (!paragraph) return;
    chapter.paragraphs.push(paragraph);
    chapter.paragraphMeta.push({
      pageStart: null,
      pageEnd: null,
      sectionTitle: currentSection?.title || null,
      sectionLevel: currentSection?.level || null,
      sectionPath: currentSection?.path || [],
      sourcePart: sourcePart || null,
    });
  });
}

function buildChaptersFromBlocks(blocks, fallbackTitle = 'Documento') {
  const chapters = [];
  let chapter = null;
  let sectionStack = [];

  const ensureChapter = () => {
    if (!chapter) {
      chapter = newChapter(fallbackTitle);
      chapters.push(chapter);
    }
    return chapter;
  };

  blocks.forEach((block) => {
    if (block.type === 'heading') {
      const level = Math.max(1, Math.min(6, Number(block.level || 1)));
      if (level === 1) {
        chapter = newChapter(block.text);
        chapters.push(chapter);
        sectionStack = [];
        return;
      }

      const current = ensureChapter();
      while (sectionStack.length && sectionStack.at(-1).level >= level) sectionStack.pop();
      const section = {
        title: clean(block.text),
        level,
        pageStart: null,
        pageEnd: null,
        parentTitle: sectionStack.at(-1)?.title || null,
        path: [...sectionStack.map((item) => item.title), clean(block.text)],
      };
      sectionStack.push(section);
      current.sections.push(section);
      return;
    }

    addParagraph(ensureChapter(), block.text, sectionStack.at(-1), block.sourcePart);
  });

  return chapters.filter((item) => item.paragraphs.length || item.sections.length);
}

function docxParagraphText(paragraph) {
  return clean(byLocalName(paragraph, 't').map((node) => node.textContent || '').join(' '));
}

function docxHeadingLevel(paragraph) {
  const style = firstByLocalName(firstByLocalName(paragraph, 'pPr'), 'pStyle');
  const value = attr(style, 'w:val', 'val');
  const match = value.match(/(?:heading|titolo)[ _-]*([1-6])/i);
  return match ? Number(match[1]) : 0;
}

function tableRows(table) {
  return byLocalName(table, 'tr')
    .map((row) => byLocalName(row, 'tc')
      .map((cell) => clean(byLocalName(cell, 't').map((node) => node.textContent || '').join(' ')))
      .filter(Boolean))
    .filter((row) => row.length);
}

function tableAsText(rows) {
  if (!rows.length) return '';
  return `Tabella. ${rows.map((row) => row.join(' | ')).join(' ; ')}`;
}

async function parseDocx(file, { onProgress } = {}) {
  onProgress?.({ phase: 'rich-open', format: 'DOCX' });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('DOCX non valido: manca il documento principale.');

  const xml = parseXml(await entry.async('string'));
  const body = firstByLocalName(xml, 'body');
  const blocks = [];

  [...(body?.childNodes || [])].forEach((node) => {
    if (node.nodeType !== 1) return;
    if (node.localName === 'p') {
      const text = docxParagraphText(node);
      if (!text) return;
      const level = docxHeadingLevel(node);
      blocks.push(level
        ? { type: 'heading', level, text, sourcePart: 'word/document.xml' }
        : { type: 'paragraph', text, sourcePart: 'word/document.xml' });
    } else if (node.localName === 'tbl') {
      const text = tableAsText(tableRows(node));
      if (text) blocks.push({ type: 'paragraph', text, sourcePart: 'word/document.xml' });
    }
  });

  const chapters = buildChaptersFromBlocks(blocks, file.name.replace(/\.docx$/i, ''));
  const fullText = chapters.flatMap((item) => item.paragraphs).join('\n\n');
  if (!fullText) throw new Error('DOCX letto, ma non contiene testo utilizzabile.');
  onProgress?.({ phase: 'complete', done: 1, total: 1 });

  return {
    fullText,
    pages: [],
    chapters,
    needsOcr: [],
    ocrApplied: [],
    removedRunningLines: [],
    sourceFormat: 'docx',
    sourceTitle: file.name.replace(/\.docx$/i, ''),
    structure: makeStructure(chapters, 0),
  };
}

function epubDocument(text) {
  let doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if ([...doc.getElementsByTagName('*')].some((node) => node.localName === 'parsererror')) {
    doc = new DOMParser().parseFromString(text, 'text/html');
  }
  return doc;
}

function epubRows(table) {
  return [...table.querySelectorAll('tr')]
    .map((row) => [...row.querySelectorAll('th,td')].map((cell) => clean(cell.textContent)).filter(Boolean))
    .filter((row) => row.length);
}

async function parseEpub(file, { onProgress } = {}) {
  onProgress?.({ phase: 'rich-open', format: 'EPUB' });
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) throw new Error('EPUB non valido: manca META-INF/container.xml.');

  const container = parseXml(await containerEntry.async('string'));
  const rootfile = firstByLocalName(container, 'rootfile');
  const opfPath = attr(rootfile, 'full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('EPUB non valido: indice principale non trovato.');

  const opf = parseXml(await zip.file(opfPath).async('string'));
  const manifest = new Map();
  byLocalName(opf, 'item').forEach((item) => {
    if (item.parentNode?.localName !== 'manifest') return;
    manifest.set(attr(item, 'id'), attr(item, 'href'));
  });
  const spine = byLocalName(opf, 'itemref')
    .filter((item) => item.parentNode?.localName === 'spine')
    .map((item) => attr(item, 'idref'))
    .filter(Boolean);
  const title = clean(firstByLocalName(opf, 'title')?.textContent || file.name.replace(/\.epub$/i, ''));
  const blocks = [];

  for (let index = 0; index < spine.length; index += 1) {
    const href = manifest.get(spine[index]);
    if (!href) continue;
    const partPath = resolvePath(opfPath, href);
    const entry = zip.file(partPath);
    if (!entry) continue;
    onProgress?.({ phase: 'rich-part', format: 'EPUB', done: index + 1, total: spine.length });
    const doc = epubDocument(await entry.async('string'));

    [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,table')].forEach((node) => {
      const tag = node.tagName?.toLowerCase();
      if (/^h[1-6]$/.test(tag)) {
        const text = clean(node.textContent);
        if (text) blocks.push({ type: 'heading', level: Number(tag.slice(1)), text, sourcePart: partPath });
      } else if (tag === 'p') {
        if (node.closest('table')) return;
        const text = clean(node.textContent);
        if (text) blocks.push({ type: 'paragraph', text, sourcePart: partPath });
      } else if (tag === 'table') {
        const text = tableAsText(epubRows(node));
        if (text) blocks.push({ type: 'paragraph', text, sourcePart: partPath });
      }
    });
  }

  const chapters = buildChaptersFromBlocks(blocks, title || 'Documento');
  const fullText = chapters.flatMap((item) => item.paragraphs).join('\n\n');
  if (!fullText) throw new Error('EPUB letto, ma non contiene testo utilizzabile.');
  onProgress?.({ phase: 'complete', done: spine.length, total: spine.length });

  return {
    fullText,
    pages: [],
    chapters,
    needsOcr: [],
    ocrApplied: [],
    removedRunningLines: [],
    sourceFormat: 'epub',
    sourceTitle: title,
    structure: makeStructure(chapters, 0),
  };
}

export async function readSourceFile(file, options = {}) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.docx')) return parseDocx(file, options);
  if (name.endsWith('.epub')) return parseEpub(file, options);

  const parsed = await readLegacySourceFile(file, options);
  const sourceFormat = name.endsWith('.pdf')
    ? 'pdf'
    : name.endsWith('.txt')
      ? 'txt'
      : /\.(png|jpe?g|webp)$/i.test(name)
        ? 'image'
        : parsed.sourceFormat;

  return {
    ...parsed,
    sourceFormat,
    structure: makeStructure(parsed.chapters || [], parsed.structure?.pageCount || parsed.pages?.length || 0),
  };
}
