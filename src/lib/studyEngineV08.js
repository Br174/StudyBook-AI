import {
  buildStudyBook as buildBaseStudyBook,
  refineParagraphWithAi,
  summaryLevels,
} from './studyEngine.js';

function attachSourceParts(book, documentData) {
  const chapters = (book.chapters || []).map((chapter, chapterIndex) => ({
    ...chapter,
    paragraphs: (chapter.paragraphs || []).map((paragraph, paragraphIndex) => {
      const meta = documentData?.chapters?.[chapterIndex]?.paragraphMeta?.[paragraphIndex] || null;
      return {
        ...paragraph,
        sourcePart: meta?.sourcePart || paragraph.sourcePart || null,
      };
    }),
  }));
  return { ...book, chapters };
}

export async function buildStudyBook(documentData, options = {}) {
  const baseBook = await buildBaseStudyBook(documentData, options);
  const book = attachSourceParts(baseBook, documentData);
  const sourceAssets = Array.isArray(documentData?.assets) ? documentData.assets : [];
  return {
    ...book,
    version: Math.max(Number(book.version || 0), 5),
    sourceFormat: documentData?.sourceFormat || null,
    sourceTitle: documentData?.sourceTitle || null,
    sourceAssets,
    sourceAssetStats: {
      total: sourceAssets.length,
      images: sourceAssets.filter((item) => item.type === 'image').length,
      tables: sourceAssets.filter((item) => item.type === 'table').length,
      truncated: Number(documentData?.assetsTruncated || 0),
    },
  };
}

export { refineParagraphWithAi, summaryLevels };
