import { requireIntegrityForStudy } from './integrity360Core.js';
import {
  buildStudyBook as buildBaseStudyBook,
  refineParagraphWithAi,
  summaryLevels as baseSummaryLevels,
} from './studyEngineV11.js';
import {
  auditFidelity,
  removeExactCrossParagraphRedundancy,
  repairStudyText,
} from './fidelityEngine.js';

export const summaryLevels = {
  approfondito: { ...baseSummaryLevels.approfondito, label: 'Approfondimento' },
  studio: { ...baseSummaryLevels.studio, label: 'Testo di studio' },
  ripasso: { ...baseSummaryLevels.ripasso, label: 'Riassunto' },
};

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function dsaFromStudy(value) {
  return normalize(value)
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s*,\s*(mentre|poiché|perché|quindi|tuttavia|inoltre)\s+/gi, '. $1 ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n\n');
}

function auditParagraph(paragraph) {
  const firstAudit = auditFidelity(paragraph.original, paragraph.summary);
  const repair = repairStudyText(paragraph.original, paragraph.summary, firstAudit);
  const afterRepair = auditFidelity(paragraph.original, repair.text);
  const sourceFallback = !afterRepair.passed;
  const safeText = sourceFallback ? paragraph.original : repair.text;
  const finalAudit = auditFidelity(paragraph.original, safeText);
  const recovered = repair.recovered.length;

  return {
    ...paragraph,
    summary: safeText,
    dsaSummary: recovered || sourceFallback
      ? dsaFromStudy(safeText)
      : (paragraph.dsaSummary || dsaFromStudy(safeText)),
    fidelityRecovered: Number(paragraph.fidelityRecovered || 0) + recovered,
    fidelityGate: {
      passed: finalAudit.passed,
      coveragePercent: finalAudit.coveragePercent,
      compressionPercent: finalAudit.compressionPercent,
      conceptCount: finalAudit.conceptCount,
      protectedCount: finalAudit.protectedCount,
      missingHighValue: finalAudit.missingHighValue.length,
      missingProtected: finalAudit.missingProtected.length,
      recovered,
      sourceFallback,
      qualifierMismatches: finalAudit.qualifierMismatches?.length || 0,
    },
  };
}

export async function buildStudyBook(documentData, options = {}) {
  requireIntegrityForStudy(documentData);
  const baseBook = await buildBaseStudyBook(documentData, options);
  let totalConcepts = 0;
  let totalProtected = 0;
  let recoveredUnits = 0;
  let failedParagraphs = 0;
  let coverageSum = 0;
  let compressionSourceChars = 0;
  let compressionOutputChars = 0;
  let paragraphCount = 0;

  const chapters = (baseBook?.chapters || []).map((chapter, chapterIndex) => {
    const audited = (chapter.paragraphs || []).map((paragraph) => auditParagraph(paragraph));
    const coherent = removeExactCrossParagraphRedundancy(audited).map((paragraph) => {
      const postDedupAudit = auditFidelity(paragraph.original, paragraph.summary);
      const reverted = !postDedupAudit.passed;
      const safeParagraph = reverted ? { ...paragraph, summary: paragraph.original, dsaSummary: dsaFromStudy(paragraph.original) } : paragraph;
      const finalAudit = reverted ? auditFidelity(paragraph.original, paragraph.original) : postDedupAudit;
      const gate = { ...paragraph.fidelityGate,
        passed: finalAudit.passed,
        coveragePercent: finalAudit.coveragePercent,
        compressionPercent: finalAudit.compressionPercent,
        missingHighValue: finalAudit.missingHighValue.length,
        missingProtected: finalAudit.missingProtected.length,
      };
      paragraphCount += 1;
      totalConcepts += finalAudit.conceptCount;
      totalProtected += finalAudit.protectedCount;
      recoveredUnits += Number(gate.recovered || 0);
      coverageSum += finalAudit.coveragePercent;
      compressionSourceChars += finalAudit.sourceChars;
      compressionOutputChars += finalAudit.outputChars;
      if (!gate.passed) failedParagraphs += 1;
      return { ...safeParagraph, fidelityGate: { ...gate, sourceFallback: gate.sourceFallback || reverted } };
    });

    options.onProgress?.(
      baseBook?.quality?.paragraphs || paragraphCount,
      baseBook?.quality?.paragraphs || paragraphCount,
      'fidelity',
      {
        chaptersDone: chapterIndex + 1,
        chaptersTotal: baseBook?.chapters?.length || 0,
        failedParagraphs,
      },
    );

    return { ...chapter, paragraphs: coherent };
  });

  const compressionPercent = compressionSourceChars
    ? Math.max(0, Math.round((1 - (compressionOutputChars / compressionSourceChars)) * 1000) / 10)
    : 0;

  return {
    ...baseBook,
    version: Math.max(Number(baseBook?.version || 0), 9),
    chapters,
    quality: {
      ...(baseBook?.quality || {}),
      fidelityGate: {
        paragraphsChecked: paragraphCount,
        paragraphsPassed: paragraphCount - failedParagraphs,
        paragraphsFailed: failedParagraphs,
        conceptUnits: totalConcepts,
        protectedItems: totalProtected,
        recoveredUnits,
        averageCoveragePercent: paragraphCount ? Math.round((coverageSum / paragraphCount) * 10) / 10 : 100,
        compressionPercent,
        passed: failedParagraphs === 0,
      },
      chapterAudit: {
        chaptersAudited: chapters.length,
        chaptersWithRecovery: chapters.filter((chapter) => (chapter.paragraphs || []).some((paragraph) => Number(paragraph?.fidelityGate?.recovered || 0) > 0)).length,
        importantSentences: totalConcepts,
        recoveredSentences: recoveredUnits,
        cappedRecoveries: 0,
        averageCoverageBefore: null,
        averageCoverageAfter: paragraphCount ? (coverageSum / paragraphCount) / 100 : 1,
        supersededBy: 'fidelityGate-v1',
      },
    },
  };
}

export { refineParagraphWithAi };
