// LAB78: marker interval and VERIFIED external checkpoint safety contract.
import assert from 'node:assert/strict';
import handler from '../api/editionsBulkV51.js';
import {MARKER_MODES_V78,validCheckpointV78,markerSpacingAuditV78,
 markerInstructionV78,MARKER_PROBE_PROTOCOL_V78} from '../src/lib/studyMarkerExperimentsV78.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {stripNumberMarkersV77} from '../src/lib/studyNumberingExperimentV77.js';

assert.deepEqual(MARKER_MODES_V78,['fixed5','fixed10','fixed20','progressive','verified-checkpoint']);
for(const mode of MARKER_MODES_V78){
 const instruction=markerInstructionV78(mode,300,150,135,165,{count:0});
 assert.match(instruction,/135–165/);
}
const marked='Art. 12: Una stella⟦9⟧ brilla.⟦15⟧';
assert.equal(stripNumberMarkersV77(marked),'Art. 12: Una stella brilla.');
const audit=markerSpacingAuditV78(marked,'fixed5');
assert.equal(audit.markerCount,2);
assert.equal(audit.sequenceErrors,2);
assert.equal(validCheckpointV78(undefined,'verified-checkpoint').count,0);
assert.equal(validCheckpointV78({previous:'È pronta.',claimedLetters:7},'verified-checkpoint').ok,true);
assert.equal(validCheckpointV78({previous:'È pronta.',claimedLetters:8},'verified-checkpoint').ok,false);
assert.equal(validCheckpointV78({previous:'Auto⟦4⟧',claimedLetters:4},'verified-checkpoint').ok,false);

const units=[{id:'0:0',source:'La stella emette energia luminosa e calore. '.repeat(9),
 pageStart:1,pageEnd:1}];
const originalLetters=studyLetters(units[0].source);
const pageBudgetsV74=pageLetterBudgetsV74(units,'50');
const reqBase={phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
 level:'50',units,unitBudgets:buildUnitBudgetsV71(units,'50'),
 targetLetters:pageBudgetsV74[0].targetLetters,pageBudgetsV74,
 bookTitle:'Prova locale LAB78',maxOutputTokens:4096,timeoutMs:55000};
const env={AI_API_KEY:'FAKE_LOCAL_KEY',AI_MODEL:'gemini-3.5-flash-lite',
 STUDYBOOK_MARKER_PROBE_V78:'enabled'};
function respond(){return {statusCode:200,payload:null,headers:{},
 setHeader(k,v){this.headers[k]=v;return this},
 status(s){this.statusCode=s;return this},json(d){this.payload=d;return this}}}
const priorFetch=globalThis.fetch;
let providerCalls=0;
try{
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('countTokens'))
   return new Response(JSON.stringify({totalTokens:400}),{status:200});
  providerCalls++;
  const data=JSON.parse(options.body),instruction=data.messages[0].content;
  if(data.messages[1].content.includes('checkedPreviousV78'))
   assert.match(instruction,/VERIFICA ESTERNA/);
  return new Response(JSON.stringify({choices:[{finish_reason:'stop',
   message:{content:JSON.stringify({parts:[{id:'0:0',text:'La stella emette luce e calore.'}]})}}],
   usage:{completion_tokens:35}}),{status:200});
 };
 const first=respond();
 await handler({method:'POST',env,body:{...reqBase,markerModeV78:'fixed10'}},first);
 assert.equal(first.statusCode,200,JSON.stringify(first.payload));
 assert.equal(first.headers['X-StudyBook-Marker-Probe'],MARKER_PROBE_PROTOCOL_V78);
 assert.equal(providerCalls,1);
 const invalid=respond();
 await handler({method:'POST',env,body:{...reqBase,markerModeV78:'verified-checkpoint',
  checkpointV78:{previous:'La stella emette luce.',claimedLetters:999}}},invalid);
 assert.equal(invalid.statusCode,400);
 assert.equal(invalid.payload.code,'AI_MARKER_CHECKPOINT_INVALID');
 assert.equal(providerCalls,1,'A forged checkpoint must not reach Gemini');
 const second=respond();
 const previous='La stella emette luce.';
 await handler({method:'POST',env,body:{...reqBase,markerModeV78:'verified-checkpoint',
  checkpointV78:{previous,claimedLetters:studyLetters(previous)}}},second);
 assert.equal(second.statusCode,200,JSON.stringify(second.payload));
 assert.equal(providerCalls,2);
 const disabled=respond();
 await handler({method:'POST',env:{...env,STUDYBOOK_MARKER_PROBE_V78:'disabled'},
  body:{...reqBase,markerModeV78:'fixed5'}},disabled);
 assert.equal(disabled.statusCode,403);
 assert.equal(providerCalls,2);
 console.log('LAB78_OFFLINE_PASS',JSON.stringify({
  methods:MARKER_MODES_V78.length,unicodeLetters:studyLetters('È pronta.'),
  sourceDatesPreserved:true,forgedCheckpointRejected:true,
  QAOnlyFlagEnforced:true,providerCalls,
  previousLAB74Compatible:true}));
}finally{globalThis.fetch=priorFetch}
