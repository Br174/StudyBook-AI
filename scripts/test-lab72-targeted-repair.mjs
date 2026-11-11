// LAB72: deterministic source-grounded plan + exact Worker path. NO Gemini API calls.
import assert from 'node:assert/strict';
import handler,{editionTargetedRepairInstructionV72}
 from '../api/editionsBulkV51.js';
import {planTargetedRepairV72,targetedRepairSummaryV72}
 from '../src/lib/studyTargetedRepairV72.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V72} from '../src/lib/studyDraftProtocolV72.js';
import {studyLetters,exactRetained} from '../src/lib/studyPillarV38.js';
import {STUDY_TARGET_V67} from '../src/lib/studyRebalancePolicyV67.js';

const source=[
 'La Luna non produce luce propria: la superficie lunare riflette quella del Sole.',
 'Le fasi lunari dipendono dalla posizione geometrica della Luna rispetto alla Terra e al Sole.',
 'La gravità sulla superficie della Luna è inferiore a quella che osserviamo sulla Terra.',
 'Le eclissi lunari si verificano soltanto quando i tre corpi sono allineati in modo opportuno.',
 'La distanza tra Luna e Terra varia perché la sua orbita non è perfettamente circolare.',
 'Le osservazioni della Luna aiutano a comprendere i crateri e la storia degli impatti.'
].join('\n\n');
const draft=source.split('\n\n')[0]+' '+source.split('\n\n')[1];
const original=source;
const p=planTargetedRepairV72(source,draft,'10');
assert.equal(p.direction,'expand');
assert.ok(p.gapLetters>0);
assert.ok(p.sourceContexts.length>0,'Must identify actual source contexts');
assert.ok(p.sourceContexts.every(x=>source.includes(x)),'Hints only from exact original');
assert.match(targetedRepairSummaryV72(p),/Recupera SOLO spiegazioni/);
assert.equal(source,original,'Planner must not edit source');
assert.equal(draft,source.split('\n\n')[0]+' '+source.split('\n\n')[1],
 'Planner must not edit draft');
const oversized=source+'\n\n'+source+'\n\n'+source;
const condense=planTargetedRepairV72(source,oversized,'10');
assert.equal(condense.direction,'condense');
assert.ok(condense.gapLetters<0);
assert.ok(condense.sourceContexts.length===0,'Do not instruct additions to an oversized draft');
assert.equal(planTargetedRepairV72(source,source.slice(0,source.length-35),'10').evidenceStatus,
 'lexical-clues-only-not-semantic-proof');
const prompt=editionTargetedRepairInstructionV72('10',studyLetters(source));
assert.match(prompt,/Lavora sulla BOZZA PRECEDENTE/);
assert.match(prompt,/EXPAND:/);
assert.match(prompt,/CONDENSE:/);
assert.match(prompt,/le fasce/i);

const originalFetch=globalThis.fetch;
const fake=()=>({statusCode:200,payload:null,setHeader(){return this},
 status(value){this.statusCode=value;return this},json(x){this.payload=x;return this}});
let actualModelCalls=0;
try{
 const units=[{id:'0:0',source,pageStart:1,pageEnd:1}];
 const letterCount=studyLetters(source),wanted=exactRetained(letterCount,STUDY_TARGET_V67['10'].target);
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes(':countTokens'))
   return new Response(JSON.stringify({totalTokens:512}),{status:200});
  actualModelCalls++;
  const json=JSON.parse(opts.body);
  const payload=JSON.parse(json.messages[1].content);
  assert.match(json.messages[0].content,/Lavora sulla BOZZA PRECEDENTE/);
  assert.equal(payload.units[0].source,source);
  assert.equal(payload.units[0].previousDraft,draft);
  assert.equal(payload.units[0].targetedRepairV72.direction,'expand');
  assert.equal(payload.units[0].targetedRepairV72.observedLetters,studyLetters(draft));
  assert.ok(payload.units[0].targetedRepairV72.sourceContexts.length>0);
  assert.ok(payload.units[0].targetedRepairV72.sourceContexts.every(t=>source.includes(t)));
  const plan=payload.units[0].targetedRepairV72;
  assert.equal(plan.localEdit.action,'expand');
  assert.ok(draft.includes(plan.localEdit.originalSpan));
  const matches=[...source.matchAll(/\p{L}/gu)];
  const needed=plan.localEdit.desiredReplacementLetters;
  const text=source.slice(0,matches[Math.max(0,needed-1)].index+1);
  const sourceLetters=[...source.matchAll(/\p{L}/gu)];
  const shorten=n=>source.slice(0,sourceLetters[Math.max(0,n-1)].index+1);
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({parts:[{id:'0:0',
     short:shorten(Math.max(1,needed-24)),
     balanced:text,
     detailed:shorten(Math.min(sourceLetters.length,needed+24))
   }]})}}],
   usage:{completion_tokens:350}}),{status:200});
 };
 const response=fake();
 await handler({method:'POST',env:{AI_API_KEY:'MOCK_ONLY',AI_MODEL:'gemini-3.5-flash-lite'},
  body:{phase:'repair-v72',draftProtocol:STUDY_DRAFT_PROTOCOL_V72,
   level:'10',bookTitle:'Test didattico',units,
   repairDrafts:[{id:'0:0',text:draft}],
   unitBudgets:buildUnitBudgetsV71(units,'10'),
   targetLetters:wanted,maxOutputTokens:6000}},response);
 assert.equal(response.statusCode,200);
 assert.equal(response.payload.draftProtocol,STUDY_DRAFT_PROTOCOL_V72);
 assert.equal(response.payload.lengthReview.withinBand,true);
 assert.notEqual(response.payload.parts[0].text,draft);
 assert.ok(response.payload.parts[0].text.endsWith(draft.slice(draft.indexOf(' '+source.split('\n\n')[1]))));
 assert.equal(actualModelCalls,1);
 console.log('LAB72 TARGETED REPAIR PASS: source-only omitted contexts, draft preserved, both length directions, one bounded repair, no real Gemini tokens');
}finally{globalThis.fetch=originalFetch}
