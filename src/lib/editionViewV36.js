// LAB36: a view of one genuinely generated edition, never an additional compression.
import { countWords, countLetters } from './studyQualityGuard.js';
import { explainInSimpleWords } from './simpleLanguage.js';
import { normalizeStudyParagraphFlow } from './readingFlowV36.js';
import { buildVerifiedFragmentPreviewV45 } from './studyPreviewV45.js';

const PENDING='Testo rielaborato non ancora verificato per questa pagina.';
const labels={10:'Pulizia leggera',20:'Testo diretto',30:'Studio sintetico',
  40:'Studio essenziale',50:'Studio schematico',summary:'Riassunto'};
export function buildGeminiEditionViewV36(book,reduction){
  if(!book?.editionsV36)return null;
  const id=String(reduction);
  if(!Object.hasOwn(labels,id))return null;
  const source=book.editionsV36;
  let sourceLetters=0,outputLetters=0,sourceWords=0,outputWords=0,valid=0,total=0;
  let readablePartialParagraphs=0,verifiedPreviewFragments=0;
  const chapters=(book.chapters||[]).map((chapter,ci)=>({
    ...chapter,
    paragraphs:(chapter.paragraphs||[]).map((p,pi)=>{
      const paragraph=source.rows?.[ci]?.[pi];
      const verified=paragraph?.verified?.[id]===true&&typeof paragraph?.editions?.[id]==='string'&&paragraph.editions[id].trim();
      const fragmentPreview=verified?null:buildVerifiedFragmentPreviewV45(paragraph?.partialFragments?.[id]);
      const text=verified?normalizeStudyParagraphFlow(paragraph.editions[id]):
        (fragmentPreview?.text||PENDING);
      const original=String(p.original||'');
      sourceLetters+=countLetters(original);sourceWords+=countWords(original);
      total++;
      if(verified){valid++;outputLetters+=countLetters(text);outputWords+=countWords(text);}
      if(fragmentPreview){
        readablePartialParagraphs++;
        verifiedPreviewFragments+=fragmentPreview.verifiedFragments;
      }
      return {
        ...p,summary:text,dsaSummary:text,
        simpleSummary:verified?explainInSimpleWords(text):(fragmentPreview?.text||PENDING),
        editionPending:!verified,
        editionPreviewOnly:!verified,
        editionPreviewFragments:fragmentPreview?.verifiedFragments||0,
        editionSource:'gemini-v36-original',
        precisionAudit:{...(p.precisionAudit||{}),sourceNeedsReview:!verified,
          coherent:Boolean(verified),fallbackOriginal:false,
          reasons:verified?[]:(paragraph?.issues?.[id]||['not-verified'])},
      };
    }),
  }));
  const pillar=book?.studyPillarV38==='studybook-progressive-v38-1';
  // A completed single edition is independently studiable/exportable while other levels run.
  const complete=total>0&&valid===total&&
    (!pillar||source.version==='lab38-progressive-editions-v1');
  const achievedLettersPercent=sourceLetters&&complete
    ?Math.round((1-outputLetters/sourceLetters)*1000)/10:null;
  const targetPercent=id==='summary'?null:Number(id);
  const editionReadiness={
    complete,partial:!complete,verifiedParagraphs:valid,totalParagraphs:total,
    readableParagraphs:valid+readablePartialParagraphs,
    verifiedPreviewFragments,
    source:'gemini-v36',level:id,
    status:complete?'complete':'preview-only',
  };
  return {...book,chapters,editionReadiness,
    precisionEdition:{
      level:reduction,label:labels[id],targetPercent,
      achievedPercent:achievedLettersPercent,
      achievedLettersPercent,
      achievedWordsPercent:complete&&sourceWords?Math.round((1-outputWords/sourceWords)*1000)/10:null,
      originalLetters:sourceLetters,resultingLetters:complete?outputLetters:null,
      targetReached:complete&&(targetPercent===null||(
        // The generator has certified EACH integer chunk budget. A book with
        // N letters can differ by at most half a letter from the ideal real value.
        Math.abs(outputLetters-Math.round(sourceLetters*(1-targetPercent/100)))===0
      )),
      qualityGuard:{status:complete?'ai-generated-verified':'preview-only',
        issueCount:total-valid,semanticCertification:false,
        originalFallbackParagraphs:0},
    }};
}
export function mayPublishGeminiEdition(book){
  return !book?.editionsV36||book?.precisionEdition?.level===0||book?.editionReadiness?.complete===true;
}
