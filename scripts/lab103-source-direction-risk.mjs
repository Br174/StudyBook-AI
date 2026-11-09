// StudyBook AI / MotorLab LAB103: one targeted directional meaning safeguard.
// Advisory only, source-anchored. Never modifies generated text or approves study.
export function oxygenDirectionRisk(sourceId,sourceText,outputText){
 const src=String(sourceText||'').normalize('NFC');
 const txt=String(outputText||'').normalize('NFC').replace(/\s+/gu,' ');
 const relevant=sourceId==='medicina'&&/ossigeno passa dall['’]aria al sangue/iu.test(src);
 if(!relevant)return{relevant:false,directionReversal:false,sourceSupportedDirection:false,requiresReview:false,semanticCertified:false};
 const explicitReversal=/(?:ossigeno.{0,45}(?:passa|va|fluisce|si sposta).{0,35}(?:dal sangue|sangue).{0,35}(?:all['’]aria|nell['’]aria)|(?:dal sangue).{0,30}(?:all['’]aria).{0,35}ossigeno)/iu.test(txt);
 const originalDirection=/(?:ossigeno.{0,65}(?:dall['’]aria al sangue|dagli alveoli al sangue|dall['’]aria nel sangue|dai polmoni al sangue)|ossigeno.{0,50}(?:entra|arriva).{0,30}nel sangue)/iu.test(txt);
 return{
  relevant:true,directionReversal:explicitReversal,
  sourceSupportedDirection:originalDirection&&!explicitReversal,
  requiresReview:explicitReversal||!originalDirection,
  risk:explicitReversal?'OXYGEN_DIRECTION_INVERTED':!originalDirection?'OXYGEN_DIRECTION_NOT_CLEAR':null,
  semanticCertified:false,
  limitations:'Narrow direction test. Other mechanisms and valid scientific paraphrases require separate review; this is not general semantic reasoning.'
 };
}
