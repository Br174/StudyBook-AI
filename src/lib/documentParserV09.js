import {
  readSourceFile as readTextSourceFile,
} from './documentParserText.js';

const MAX_HEADING_LENGTH = 140;
const MAX_DEPTH = 6;

function clean(value) {
  return String(value || '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function titleWords(value) {
  return clean(value).split(/\s+/).filter(Boolean);
}

function looksLikeSentence(value) {
  const text = clean(value);
  if (!text) return false;
  if (text.length > 95 && /[.!?]$/.test(text)) return true;
  if (text.length > 115 && /[,;:]/.test(text)) return true;
  return false;
}

function titleCaseRatio(value) {
  const words = titleWords(value).filter((word) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(word));
  if (!words.length) return 0;
  const titled = words.filter((word) => /^[A-ZÀ-ÖØ-Ý]/.test(word)).length;
  return titled / words.length;
}

function classifyHeading(line, { surrounded = false } = {}) {
  const value = clean(line);
  if (!value || value.length > MAX_HEADING_LENGTH) return null;
  if (/^(?:pag(?:ina)?\.?\s*)?\d{1,4}$/i.test(value)) return null;
  if (/^[•·\-–—_=*]+$/.test(value)) return null;
  if (/\.{3,}\s*\d{1,4}$/.test(value)) return null;

  let match = value.match(/^(parte|libro|unità|unita|modulo|tomo)\s+([\divxlcdm]+)(?:\s*[-–—:.]\s*(.+))?$/i);
  if (match) {
    return { family: 'container', depth: 0, title: value, explicit: true, score: 100 };
  }

  match = value.match(/^(?:capitolo|chapter|cap\.)\s+([\divxlcdm]+)(?:\s*[-–—:.]\s*(.+))?$/i);
  if (match) {
    return {
      family: 'chapter', depth: 1, title: value, explicit: true, score: 120,
      bare: !clean(match[2]),
    };
  }

  match = value.match(/^(?:sezione|section)\s+([\divxlcdm]+)(?:\s*[-–—:.]\s*(.+))?$/i);
  if (match) return { family: 'section', depth: 2, title: value, explicit: true, score: 105 };

  match = value.match(/^(?:paragrafo|paragraph|§)\s*([\divxlcdm.]+)(?:\s*[-–—:.]\s*(.+))?$/i);
  if (match) return { family: 'section', depth: 3, title: value, explicit: true, score: 100 };

  match = value.match(/^(\d+(?:\.\d+){0,5})(?:[.)])?\s+(.{2,})$/);
  if (match && !looksLikeSentence(value)) {
    const parts = match[1].split('.');
    const tail = clean(match[2]);
    if (!/^\d+(?:[.,]\d+)?(?:\s|$)/.test(tail)) {
      return {
        family: 'numbered',
        depth: Math.min(MAX_DEPTH, parts.length),
        title: value,
        number: match[1],
        explicit: true,
        score: 95 - parts.length,
      };
    }
  }

  match = value.match(/^([IVXLCDM]{1,8})[.)]\s+(.{2,})$/i);
  if (match && !looksLikeSentence(value)) {
    return { family: 'numbered', depth: 1, title: value, number: match[1], explicit: true, score: 88 };
  }

  match = value.match(/^([A-Z])[.)]\s+(.{2,})$/);
  if (match && !looksLikeSentence(value)) {
    return { family: 'numbered', depth: 2, title: value, number: match[1], explicit: true, score: 75 };
  }

  if (/^(introduzione|premessa|prefazione|prologo|conclusioni?|epilogo|appendice|glossario|bibliografia|riepilogo)(?:\s|$)/i.test(value)) {
    return { family: 'named', depth: 1, title: value, explicit: true, score: 85 };
  }

  const words = titleWords(value);
  const uppercase = /^[A-ZÀ-ÖØ-Ý0-9][A-ZÀ-ÖØ-Ý0-9 '\-–—,:()/&]+$/.test(value);
  if (uppercase && value.length <= 90 && words.length <= 12 && !/[.!?]$/.test(value)) {
    return { family: 'visual', depth: 1, title: value, explicit: false, score: 62 };
  }

  if (surrounded && value.length <= 78 && words.length <= 10 && titleCaseRatio(value) >= 0.6 && !/[.!?;]$/.test(value)) {
    return { family: 'visual', depth: 2, title: value, explicit: false, score: 48 };
  }

  return null;
}

function looksLikeIndexPage(text, pageNumber) {
  const lines = String(text || '').split('\n').map(clean).filter(Boolean);
  if (lines.length < 5) return false;
  const heading = lines.slice(0, 5).join(' ').toLocaleLowerCase('it-IT');
  const named = /\b(indice|sommario|contents)\b/.test(heading);
  const pageTailCount = lines.filter((line) => /(?:\.{2,}|\s{2,}|\t)\s*\d{1,4}$/.test(line) || /^\d+(?:\.\d+)*\s+.+\s+\d{1,4}$/.test(line)).length;
  const dense = pageTailCount >= Math.max(4, Math.ceil(lines.length * 0.35));
  return named || (Number(pageNumber || 0) <= 30 && dense);
}

function splitStudyParagraphs(text) {
  const source = clean(text);
  if (!source) return [];

  const blocks = source.split(/\n\s*\n/).map(clean).filter(Boolean);
  const seed = blocks.length > 1 ? blocks : [source];
  const result = [];

  for (const block of seed) {
    if (block.length <= 1800) {
      result.push(block);
      continue;
    }

    const sentences = block.match(/[^.!?]+(?:[.!?]+|$)/g)?.map(clean).filter(Boolean) || [block];
    let current = '';
    for (const sentence of sentences) {
      const proposed = current ? `${current} ${sentence}` : sentence;
      if (current && proposed.length > 1350) {
        result.push(current);
        current = sentence;
      } else {
        current = proposed;
      }
    }
    if (current) result.push(current);
  }

  return result.filter(Boolean);
}

function pageLines(page) {
  const raw = String(page?.text || '').replace(/\r/g, '');
  return raw.split('\n');
}

function collectCandidates(pages) {
  const candidates = [];
  pages.forEach((page, pageIndex) => {
    if (looksLikeIndexPage(page.text, page.pageNumber || pageIndex + 1)) return;
    const lines = pageLines(page);
    lines.forEach((line, lineIndex) => {
      const prevBlank = !clean(lines[lineIndex - 1] || '');
      const nextBlank = !clean(lines[lineIndex + 1] || '');
      const heading = classifyHeading(line, { surrounded: prevBlank || nextBlank });
      if (heading) candidates.push({ ...heading, pageNumber: page.pageNumber || pageIndex + 1, lineIndex });
    });
  });
  return candidates;
}

function chooseRootStrategy(candidates) {
  const chapters = candidates.filter((item) => item.family === 'chapter');
  if (chapters.length >= 2) return { mode: 'chapter' };

  const containers = candidates.filter((item) => item.family === 'container');
  if (containers.length >= 2) return { mode: 'container' };

  const numbered = candidates.filter((item) => item.family === 'numbered');
  if (numbered.length) {
    const counts = new Map();
    numbered.forEach((item) => counts.set(item.depth, (counts.get(item.depth) || 0) + 1));
    const depths = [...counts.entries()].filter(([, count]) => count >= 2).map(([depth]) => depth).sort((a, b) => a - b);
    if (depths.length) return { mode: 'numbered', depth: depths[0] };
  }

  const named = candidates.filter((item) => item.family === 'named');
  if (named.length >= 2) return { mode: 'named' };

  const visuals = candidates.filter((item) => item.family === 'visual' && item.depth === 1);
  if (visuals.length >= 2) return { mode: 'visual' };

  return { mode: 'document' };
}

function isRootHeading(heading, strategy) {
  if (!heading) return false;
  if (strategy.mode === 'chapter') return heading.family === 'chapter' || heading.family === 'named';
  if (strategy.mode === 'container') return heading.family === 'container' || heading.family === 'named';
  if (strategy.mode === 'numbered') return heading.family === 'numbered' && heading.depth === strategy.depth;
  if (strategy.mode === 'named') return heading.family === 'named';
  if (strategy.mode === 'visual') return heading.family === 'visual' && heading.depth === 1;
  return false;
}

function sectionLevel(heading, strategy) {
  if (!heading) return 2;
  if (heading.family === 'section') return Math.max(2, heading.depth);
  if (heading.family === 'numbered') {
    const rootDepth = strategy.mode === 'numbered' ? strategy.depth : 1;
    return Math.max(2, heading.depth - rootDepth + 2);
  }
  if (heading.family === 'visual') return 2;
  if (heading.family === 'container') return 2;
  return 2;
}

function newChapter(title, pageNumber, extra = {}) {
  return {
    title: clean(title) || 'Capitolo',
    pageStart: Number.isFinite(pageNumber) ? pageNumber : null,
    pageEnd: Number.isFinite(pageNumber) ? pageNumber : null,
    sections: [],
    paragraphs: [],
    paragraphMeta: [],
    ...extra,
  };
}

function addBody(chapter, text, pageNumber, sectionStack, containerTitle) {
  const paragraphs = splitStudyParagraphs(text);
  const deepest = sectionStack.length ? sectionStack[sectionStack.length - 1] : null;
  const sectionPath = sectionStack.map((item) => item.title);
  paragraphs.forEach((paragraph) => {
    chapter.paragraphs.push(paragraph);
    chapter.paragraphMeta.push({
      pageStart: Number.isFinite(pageNumber) ? pageNumber : null,
      pageEnd: Number.isFinite(pageNumber) ? pageNumber : null,
      sectionTitle: deepest?.title || null,
      sectionLevel: deepest?.level || null,
      sectionPath,
      containerTitle: containerTitle || null,
    });
  });
}

function finalize(chapters) {
  const useful = chapters.filter((chapter) => chapter.paragraphs.length || chapter.sections.length);
  useful.forEach((chapter, index) => {
    const pages = chapter.paragraphMeta.flatMap((meta) => [meta.pageStart, meta.pageEnd]).filter(Number.isFinite);
    if (pages.length) {
      chapter.pageStart = chapter.pageStart ?? Math.min(...pages);
      chapter.pageEnd = Math.max(chapter.pageEnd || 0, ...pages);
    }
    const next = useful[index + 1];
    if (next && Number.isFinite(next.pageStart) && Number.isFinite(chapter.pageStart)) {
      chapter.pageEnd = Math.max(chapter.pageStart, Math.min(chapter.pageEnd || next.pageStart - 1, next.pageStart - 1));
    }
    chapter.sections.forEach((section, sectionIndex) => {
      const nextSection = chapter.sections[sectionIndex + 1];
      if (!Number.isFinite(section.pageEnd)) {
        section.pageEnd = Number.isFinite(nextSection?.pageStart)
          ? Math.max(section.pageStart || nextSection.pageStart, nextSection.pageStart - 1)
          : chapter.pageEnd;
      }
    });
  });
  return useful;
}

export function detectChaptersFromPages(inputPages = []) {
  const pages = inputPages.map((page, index) => ({
    ...page,
    pageNumber: Number.isFinite(page?.pageNumber) ? page.pageNumber : index + 1,
    text: clean(page?.text),
  })).filter((page) => page.text);

  if (!pages.length) return [];
  const candidates = collectCandidates(pages);
  const strategy = chooseRootStrategy(candidates);
  const chapters = [];
  let currentChapter = null;
  let currentContainer = '';
  let sectionStack = [];

  const ensureChapter = (pageNumber) => {
    if (!currentChapter) {
      currentChapter = newChapter(chapters.length ? 'Documento' : 'Introduzione', pageNumber, { containerTitle: currentContainer || null });
      chapters.push(currentChapter);
    }
    return currentChapter;
  };

  pages.forEach((page) => {
    const isIndex = looksLikeIndexPage(page.text, page.pageNumber);
    const lines = pageLines(page);
    let buffer = [];

    const flush = () => {
      const body = clean(buffer.join('\n'));
      buffer = [];
      if (!body) return;
      const chapter = ensureChapter(page.pageNumber);
      addBody(chapter, body, page.pageNumber, sectionStack, currentContainer);
      chapter.pageEnd = page.pageNumber;
    };

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const prevBlank = !clean(lines[i - 1] || '');
      const nextBlank = !clean(lines[i + 1] || '');
      const heading = isIndex ? null : classifyHeading(line, { surrounded: prevBlank || nextBlank });
      if (!heading) {
        buffer.push(line);
        continue;
      }

      flush();

      if (heading.family === 'container' && strategy.mode === 'chapter') {
        currentContainer = heading.title;
        sectionStack = [];
        continue;
      }

      if (isRootHeading(heading, strategy)) {
        let title = heading.title;
        if (heading.family === 'chapter' && heading.bare) {
          const nextLine = clean(lines[i + 1] || '');
          if (nextLine && nextLine.length <= 90 && !looksLikeSentence(nextLine)) {
            const nextHeading = classifyHeading(nextLine, { surrounded: true });
            if (!nextHeading || nextHeading.family === 'visual') {
              title = `${title} — ${nextLine}`;
              i += 1;
            }
          }
        }
        currentChapter = newChapter(title, page.pageNumber, {
          numbering: heading.number || null,
          containerTitle: currentContainer || null,
        });
        chapters.push(currentChapter);
        sectionStack = [];
        continue;
      }

      const current = ensureChapter(page.pageNumber);
      const level = Math.min(MAX_DEPTH, sectionLevel(heading, strategy));
      while (sectionStack.length && sectionStack[sectionStack.length - 1].level >= level) sectionStack.pop();
      const section = {
        title: heading.title,
        level,
        numbering: heading.number || null,
        pageStart: page.pageNumber,
        pageEnd: null,
        parentTitle: sectionStack.at(-1)?.title || null,
        path: [...sectionStack.map((item) => item.title), heading.title],
      };
      sectionStack.push(section);
      current.sections.push(section);
    }

    flush();
  });

  const finalized = finalize(chapters);
  if (finalized.length) return finalized;

  const fallback = newChapter('Documento', pages[0].pageNumber);
  pages.forEach((page) => addBody(fallback, page.text, page.pageNumber, [], ''));
  fallback.pageEnd = pages.at(-1).pageNumber;
  return [fallback];
}

export function detectChapters(text) {
  return detectChaptersFromPages([{ pageNumber: 1, text }]);
}

function structureStats(chapters, pages, previous = {}) {
  return {
    ...previous,
    pageCount: pages?.length || previous.pageCount || 0,
    chapterCount: chapters.length,
    sectionCount: chapters.reduce((total, chapter) => total + (chapter.sections?.length || 0), 0),
    paragraphCount: chapters.reduce((total, chapter) => total + (chapter.paragraphs?.length || 0), 0),
    maxSectionDepth: chapters.reduce((max, chapter) => Math.max(max, ...(chapter.sections || []).map((section) => section.level || 0), 0), 0),
    hierarchyEngine: 'v11-text',
  };
}

export async function readSourceFile(file, options = {}) {
  const parsed = await readTextSourceFile(file, options);
  const pages = Array.isArray(parsed.pages) ? parsed.pages.filter((page) => clean(page?.text)) : [];

  let chapters = parsed.chapters || [];
  const shouldRebuild = pages.length > 0 || !chapters.length || (chapters.length === 1 && /^documento$/i.test(chapters[0]?.title || ''));

  if (shouldRebuild) {
    const sourcePages = pages.length ? pages : [{ pageNumber: 1, text: parsed.fullText || '' }];
    const rebuilt = detectChaptersFromPages(sourcePages);
    if (rebuilt.length) chapters = rebuilt;
  }

  return {
    ...parsed,
    chapters,
    structure: structureStats(chapters, pages, parsed.structure || {}),
  };
}
