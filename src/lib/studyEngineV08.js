import {
  buildStudyBook as buildBaseStudyBook,
  refineParagraphWithAi,
  summaryLevels,
} from './studyEngine.js';

export async function buildStudyBook(documentData, options = {}) {
  const book = await buildBaseStudyBook(documentData, options);
  const sourceAssets = Array.isArray(documentData?.assets) ? documentData.assets : [];
  return {
    ...book,
    version: Math.max(Number(book.version || 0), 4),
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
