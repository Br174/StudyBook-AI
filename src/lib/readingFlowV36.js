// LAB36: a PDF's single line breaks are layout, not prose paragraphs.
// Do not preserve soft wraps in the study reader or printable PDF.
// Only a blank line or an actual separate paragraph object creates a new paragraph.
export function normalizeStudyParagraphFlow(value=''){
  return String(value||'')
    .replace(/\r\n?/g,'\n')
    .replace(/\u00ad/g,'')
    .replace(/([\p{L}])-\s*\n\s*([\p{Ll}])/gu,'$1$2')
    .replace(/[ \t]*\n[ \t]*(?!\n)/g,' ')
    .replace(/[ \t]{2,}/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
export function toUnbrokenDisplayText(value=''){
  return normalizeStudyParagraphFlow(value);
}
export function countRenderedWords(value=''){
  return (normalizeStudyParagraphFlow(value).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)||[]).length;
}
export function countRenderedLetters(value=''){
  return (normalizeStudyParagraphFlow(value).match(/\p{L}/gu)||[]).length;
}
