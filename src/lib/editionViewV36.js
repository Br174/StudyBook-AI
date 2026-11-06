// LAB36: a view of one genuinely generated edition, never an additional compression.
import { countWords, countLetters } from './studyQualityGuard.js';
import { explainInSimpleWords } from './simpleLanguage.js';
import { normalizeStudyParagraphFlow } from './readingFlowV36.js';

const PENDING='Testo rielaborato non ancora verificato per questa pagina.';
const labels={10:'Pulizia leggera',20:'Testo diretto',30:'Studio sintetico',
  40:'Studio essenziale',50:'Studio schematico',summary:'Riassunto'};
export function buildGeminiEditionViewV36(book,reduction){
  if(!book?.editionsV36)return null;
  const id=String(reduction);
  if(!Object.hasOwn(labels,id))return null;
  const source=book.editionsV36;
  let sourceLetters=0,outputLetters=0,sourceWords=0,outputWords=0,valid=0,total=0;
  const chapters=(book.chapters||[]).map((chapter,ci)=>({
    ...chapter,
    paragraphs:(chapter.paragraphs||[]).map((p,pi)=>{
      const paragraph=source.rows?.[ci]?.[pi];
      const verified=paragraph?.verified?.[id]===true&&typeof paragraph?.editions?.[id]==='string'&&paragraph.editions[id].trim();
      const text=verified?normalizeStudyParagraphFlow(paragraph.editions[id]):PENDING;
      const original=String(p.original||'');
      sourceLetters+=countLetters(original);sourceWords+=countWords(original);
      total++;
      if(verified){valid++;outputLetters+=countLetters(text);outputWords+=countWords(text);}
      return {
        ...p,summary:text,dsaSummary:text,
        simpleSummary:verified?explainInSimpleWords(text):PENDING,
        editionPending:!verified,
        editionSource:'gemini-v36-original',
        precisionAudit:{...(p.precisionAudit||{}),sourceNeedsReview:!verified,
          coherent:Boolean(verified),fallbackOriginal:false,
          reasons:verified?[]:(paragraph?.issues?.[id]||['not-verified'])},
      };
    }),
  }));
  const complete=source.complete===true && total>0&&valid===total;
  const achievedLettersPercent=sourceLetters&&complete
    ?Math.round((1-outputLetters/sourceLetters)*1000)/10:null;
  const targetPercent=id==='summary'?null:Number(id);
  const editionReadiness={
    complete,partial:!complete,verifiedParagraphs:valid,totalParagraphs:total,
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
      targetReached:complete&&(targetPercent===null||achievedLettersPercent+0.5>=targetPercent),
      qualityGuard:{status:complete?'ai-generated-verified':'preview-only',
        issueCount:total-valid,semanticCertification:false,
        originalFallbackParagraphs:0},
    }};
}
export function mayPublishGeminiEdition(book){
  return !book?.editionsV36||book?.editionReadiness?.complete===true;
}
