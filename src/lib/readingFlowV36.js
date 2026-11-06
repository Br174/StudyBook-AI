// LAB36: single PDF line breaks are typography, blank lines are paragraphs.
export function normalizeStudyParagraphFlow(value='') {
  return String(value ?? '').replace(/\r\n?/g,'\n').replace(/\u00ad/g,'')
    .split(/[ \t]*\n[ \t]*\n+/g).map(p=>p
      .replace(/([\p{L}])-[ \t]*\n[ \t]*([\p{Ll}])/gu,'$1$2')
      .replace(/[ \t]*\n[ \t]*/g,' ')
      .replace(/[ \t]{2,}/g,' ')
      .trim()).filter(Boolean).join('\n\n');
}
export const toUnbrokenDisplayText=normalizeStudyParagraphFlow;
export function countRenderedWords(value='') {
  return (normalizeStudyParagraphFlow(value).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
}
export function countRenderedLetters(value='') {
  return (normalizeStudyParagraphFlow(value).match(/\p{L}/gu)||[]).length;
}
