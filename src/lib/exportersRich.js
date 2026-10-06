import JSZip from 'jszip';
import { buildEditorialDocument, editorialVariantLabel } from './editorialModel.js';
import { deliverBlob } from './fileDelivery.js';

function safeName(name = 'studybook') {
  return String(name || 'studybook').replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_') || 'studybook';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function normalizeOptions(value = false) {
  if (typeof value === 'boolean') return { dsaMode: value, variant: 'study', accessibility: null };
  return {
    dsaMode: Boolean(value?.dsaMode),
    variant: ['study','simple','both'].includes(value?.variant) ? value.variant : 'study',
    accessibility: value?.accessibility || null,
  };
}

function variantSuffix(variant) {
  if (variant === 'simple') return '_semplice';
  if (variant === 'both') return '_completo';
  return '_studio';
}

function editorialText(book, options, { markdown = false } = {}) {
  const doc = buildEditorialDocument(book, options);
  const lines = ['StudyBook AI', ''];
  for (const variant of doc.variants) {
    if (doc.variants.length > 1) {
      lines.push(markdown ? `# ${variant.label}` : variant.label.toUpperCase(), '');
    }
    for (const chapter of variant.chapters) {
      lines.push(markdown ? `## ${chapter.title}` : chapter.title.toUpperCase(), '');
      for (const block of chapter.blocks) {
        if (block.sectionTitle) lines.push(markdown ? `### ${block.sectionTitle}` : block.sectionTitle, '');
        lines.push(block.text, '');
      }
      if (chapter.glossary.length) {
        lines.push(markdown ? '### Terminologia' : 'TERMINOLOGIA', '');
        for (const entry of chapter.glossary) {
          lines.push(markdown ? `- **${entry.term}**: ${entry.definition}` : `- ${entry.term}: ${entry.definition}`);
        }
        lines.push('');
      }
    }
  }
  return lines.join('\n').trim() + '\n';
}

function rtfEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/[{}]/g, '\\$&').replace(/\n/g, '\\par\n')
    .replace(/[^\x00-\x7F]/g, (char) => {
      const code = char.charCodeAt(0);
      return `\\u${code > 32767 ? code - 65536 : code}?`;
    });
}

export async function exportMarkdown(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const text = editorialText(book, options, { markdown: true });
  await deliverBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${safeName(fileName)}${variantSuffix(options.variant)}.md`);
}

export async function exportRtf(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const text = editorialText(book, options);
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs22 ${rtfEscape(text)}}`;
  await deliverBlob(new Blob([rtf], { type: 'application/rtf' }), `${safeName(fileName)}${variantSuffix(options.variant)}.rtf`);
}

export async function exportOdt(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const doc = buildEditorialDocument(book, options);
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });

  const body = [];
  for (const variant of doc.variants) {
    if (doc.variants.length > 1) body.push(`<text:h text:outline-level="1">${escapeXml(variant.label)}</text:h>`);
    for (const chapter of variant.chapters) {
      body.push(`<text:h text:outline-level="1">${escapeXml(chapter.title)}</text:h>`);
      for (const block of chapter.blocks) {
        if (block.sectionTitle) body.push(`<text:h text:outline-level="2">${escapeXml(block.sectionTitle)}</text:h>`);
        body.push(`<text:p>${escapeXml(block.text)}</text:p>`);
      }
      if (chapter.glossary.length) {
        body.push('<text:h text:outline-level="2">Terminologia</text:h>');
        chapter.glossary.forEach((entry) => body.push(`<text:p>${escapeXml(entry.term)}: ${escapeXml(entry.definition)}</text:p>`));
      }
    }
  }

  zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3">
<office:body><office:text>${body.join('\n')}</office:text></office:body></office:document-content>`);
  zip.file('styles.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.3"/>');
  zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`);

  const blob = await zip.generateAsync({ type:'blob', mimeType:'application/vnd.oasis.opendocument.text', compression:'DEFLATE' });
  await deliverBlob(blob, `${safeName(fileName)}${variantSuffix(options.variant)}.odt`);
}

export async function exportEpub(book, fileName, rawOptions = false) {
  const options = normalizeOptions(rawOptions);
  const doc = buildEditorialDocument(book, options);
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression:'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  const manifest = [];
  const spine = [];
  const navItems = [];
  let counter = 0;
  for (const variant of doc.variants) {
    for (const chapter of variant.chapters) {
      counter += 1;
      const id = `c${counter}`;
      const href = `${id}.xhtml`;
      manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
      spine.push(`<itemref idref="${id}"/>`);
      navItems.push(`<li><a href="${href}">${escapeXml(doc.variants.length > 1 ? `${variant.label} · ${chapter.title}` : chapter.title)}</a></li>`);
      const blocks = chapter.blocks.map((block) => `${block.sectionTitle ? `<h2>${escapeXml(block.sectionTitle)}</h2>` : ''}<p>${escapeXml(block.text)}</p>`).join('');
      const glossary = chapter.glossary.length
        ? `<aside><h2>Terminologia</h2>${chapter.glossary.map((entry) => `<p><strong>${escapeXml(entry.term)}</strong>: ${escapeXml(entry.definition)}</p>`).join('')}</aside>`
        : '';
      zip.file(`OEBPS/${href}`, `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" href="styles.css"/></head>
<body><header><small>${escapeXml(editorialVariantLabel(variant.id))}</small><h1>${escapeXml(chapter.title)}</h1></header>${blocks}${glossary}</body></html>`);
    }
  }
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Indice</title></head><body>
<nav epub:type="toc"><h1>Indice</h1><ol>${navItems.join('')}</ol></nav></body></html>`);
  zip.file('OEBPS/styles.css', 'body{font-family:system-ui,sans-serif;line-height:1.65;margin:6%;color:#1f2937}h1,h2{line-height:1.2}aside{border-left:3px solid #dbeafe;padding-left:1em;color:#475569}');
  manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  manifest.push('<item id="css" href="styles.css" media-type="text/css"/>');

  const title = safeName(fileName).replace(/_/g,' ');
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:studybook:${Date.now()}</dc:identifier><dc:title>${escapeXml(title)}</dc:title><dc:language>it</dc:language></metadata>
<manifest>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`);

  const blob = await zip.generateAsync({ type:'blob', mimeType:'application/epub+zip', compression:'DEFLATE' });
  await deliverBlob(blob, `${safeName(fileName)}${variantSuffix(options.variant)}.epub`);
}
