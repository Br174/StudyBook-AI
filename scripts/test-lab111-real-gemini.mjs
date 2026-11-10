// LAB111: 2 capped free Gemini calls through the ACTUAL StudyBook Worker.
// Synthetic, previously published fixture only. NEVER use private user PDFs.
// No multi-call planning, no automatic retry and no paid fallback.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import handler from '../api/editionsBulkV51.js';
import {STUDY_DRAFT_PROTOCOL_V74} from '../src/lib/studyDraftProtocolV74.js';
import {STUDY_GEOMETRY_V78} from '../src/lib/studyGeometryV78.js';
import {buildUnitBudgetsV71} from '../src/lib/studyDraftProtocolV71.js';
import {pageLetterBudgetsV74} from '../src/lib/studyPageBudgetsV74.js';
import {studyLetters} from '../src/lib/studyPillarV38.js';
import {STUDY_LEAN_PERCENT_V111} from '../src/lib/studyLeanPercentV111.js';
import {inspectBestOfV76} from '../src/lib/studyBestOfV76.js';

const KEY=process.env.AI_TEST_KEY||'';
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab109-worker-source.json','utf8'));
const examples=[{sourceId:'scienze',level:'10'},{sourceId:'procedura',level:'50'}];
const PATH='audit/reports/lab111-real-two-levels.json';
const report={lab:'LAB111',runType:'real Gemini through actual Worker handler',
 sources:'synthetic public test fixtures only',privateBookUsed:false,
 date:new Date().toISOString(),model:'gemini-3.5-flash-lite',approvedForApp:false,
 maxCalls:2,providerRequestsAttempted:0,providerResponses:0,
 freeTierOnly:true,noPaidFallback:true,automaticRetries:0,
 results:[],errors:[],semanticCertified:false};
const save=()=>{mkdirSync('audit/reports',{recursive:true});writeFileSync(PATH,JSON.stringify(report,null,2)+'\n')};
save();
if(!KEY){report.errors.push({error:'PREEXISTING_FREE_KEY_MISSING'});save();process.exit(2)}
for(const v of examples){
 const source=fixture.sources.find(x=>x.id===v.sourceId)?.text;
 const units=[{id:'1:1',source,pageStart:1,pageEnd:1,chapterTitle:'Test'}];
 const budget=pageLetterBudgetsV74(units,v.level)[0];
 const req={method:'POST',headers:{},env:{
  AI_API_KEY:KEY,AI_MODEL:report.model,STUDYBOOK_LEAN_PERCENT_V111:'1'},
  body:{level:v.level,phase:'draft-v74',draftProtocol:STUDY_DRAFT_PROTOCOL_V74,
   geometryPolicyV78:STUDY_GEOMETRY_V78,experimentV111:STUDY_LEAN_PERCENT_V111,
   bookTitle:'LAB111 synthetic study',units,
   unitBudgets:buildUnitBudgetsV71(units,v.level),
   pageBudgetsV74:pageLetterBudgetsV74(units,v.level),
   targetLetters:v.level==='summary'?null:budget.targetLetters,
   summaryCapLetters:v.level==='summary'?budget.targetLetters:null,
   maxOutputTokens:5000,timeoutMs:100000}};
 const res={code:200,jsonBody:null,headers:{},
  status(n){this.code=n;return this},json(j){this.jsonBody=j;return this},setHeader(k,v){this.headers[k]=v;return this}};
 report.providerRequestsAttempted++;
 try{
  await handler(req,res);
  if(res.code!==200){
   report.errors.push({sourceId:v.sourceId,level:v.level,http:res.code,code:res.jsonBody?.code});
   save();if([429,503].includes(res.code))break;continue;
  }
  const data=res.jsonBody,output=data.parts?.find(x=>x.id==='1:1')?.text;
  if(!output){report.errors.push({sourceId:v.sourceId,level:v.level,error:'NO_COMPLETE_PART'});save();continue}
  const k=inspectBestOfV76(source,output,v.level);
  report.providerResponses++;
  report.results.push({sourceId:v.sourceId,level:v.level,
   sourceSha256:createHash('sha256').update(source).digest('hex'),
   sourceLetters:studyLetters(source),outputLetters:studyLetters(output),
   targetLetters:budget.targetLetters,minLetters:budget.minLetters,maxLetters:budget.maxLetters,
   actualReduction:k.actualReductionPercent,
   numericBand:k.withinBand,gridPass:k.gridFits,rows:k.rows,rowCap:k.rowCap,
   numericAndVirtualGrid:k.numericAndVirtualGrid,
   semanticAdvisories:k.semanticAdvisories,semanticCertified:false,
   countedBy:data.countedBy,
   responseProvenance:data.leanPercentPilotV111,
   finishReason:data.finishReason,approvedForApp:false,
   outputText:output});
  save();
 }catch(e){report.errors.push({sourceId:v.sourceId,level:v.level,type:String(e?.name||'UNKNOWN')});save()}
}
report.complete=report.providerResponses===2;
report.numericAndGridPass=report.results.filter(x=>x.numericAndVirtualGrid).length;
report.finishedAt=new Date().toISOString();save();
console.log(JSON.stringify({lab:report.lab,requests:report.providerRequestsAttempted,
 responses:report.providerResponses,numericAndGridPass:report.numericAndGridPass,
 reductions:report.results.map(x=>({level:x.level,p:x.actualReductionPercent,
  row:x.rows,max:x.rowCap,notes:x.semanticAdvisories.length})),
 approvedForApp:false}));
if(!report.complete)process.exitCode=2;
