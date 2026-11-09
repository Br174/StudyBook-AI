// StudyBook LAB92 offline no-provider tests: arithmetic invariants, fractional line space, historical baselines.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {budget,evaluate,largest,wrap,letters,AVG,WIDTH,sum} from './lab92-stop-complete-engine.mjs';
const fixture=JSON.parse(readFileSync('audit/test-fixtures/lab89-semantic-concepts.json','utf8')).sources;
const old89=JSON.parse(readFileSync('audit/reports/lab89-proportional-real-gemini.json','utf8'));
const old90=JSON.parse(readFileSync('audit/reports/lab90-fluid-useful-elaboration-real.json','utf8'));
const levels=[10,20,30,40,50,65];
const checks=[],errors=[];
for(const s of fixture)for(const level of levels){
 const p=budget(s,level);
 try{
  if(sum(p.goalPerConcept.map(x=>x.softTargetLetters))!==p.targetLetters)throw Error('sum targets');
  if(p.targetCap!== (p.short?5:Math.ceil(p.targetLetters/AVG.letters)))throw Error('target cap');
  if(p.goalPerConcept.length!==s.concepts.length)throw Error('concept count');
  if(p.band.low>p.targetLetters||p.band.high<p.targetLetters)throw Error('letter band');
  if(p.toleranceCap<p.targetCap)throw Error('tolerance cap');
 }catch(e){errors.push({source:s.id,level,error:String(e)})}
 checks.push({source:s.id,level,originalLetters:p.originalLetters,originalRows:p.originalRows,
   short:p.short,targetLetters:p.targetLetters,lineEquivalents:p.lineEquivalents,
   targetCap:p.targetCap,toleranceCap:p.toleranceCap,allocations:p.goalPerConcept.map(x=>x.softTargetLetters)});
}
let seed=921137;
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
let randomCount=0,infeasible=0;
for(let n=0;n<24000;n++){
 const count=1+Math.floor(rand()*16);
 const concepts=Array.from({length:count},()=> 'concetto '.repeat(2+Math.floor(Math.pow(rand(),2)*100)).trim());
 const src={id:'random_'+n,concepts,importance:concepts.map(()=>0.5+rand()*2),keyPoints:concepts.map(()=>[])};
 const level=levels[n%6];
 try{
  const p=budget(src,level);randomCount++;
  const shares=p.goalPerConcept.map(x=>x.softTargetLetters);
  if(sum(shares)!==p.targetLetters)throw Error('shares sum');
  if(p.targetCap<1||p.toleranceCap<p.targetCap)throw Error('caps');
  if(shares.some(x=>x<0))throw Error('negative share');
  // no model output is silently declared semantically correct
  const sameSource=src.concepts.map((text,i)=>({id:'C'+(i+1),text}));
  const ev=evaluate(src,p,sameSource);
  if(!ev.valid)throw Error('valid source should parse');
  if(ev.letters!==p.originalLetters)throw Error('letters changed in join');
  if(ev.rows!==p.originalRows)throw Error('rows changed in join');
 }catch(e){errors.push({n,error:String(e)});if(errors.length>=10)break}
}
const replays=[];
for(const item of [
 ...old89.records.filter(x=>x.textReturned&&x.validation?.structurallyValid).map(x=>({lab:'LAB89',source:x.source,level:x.level,sections:x.sections,previousPct:x.validation.actualReduction})),
 ...old90.records.filter(x=>x.validJson&&x.validation?.structural).map(x=>({lab:'LAB90',source:x.source,level:x.level,sections:x.rawSections,previousPct:x.validation.actualReduction}))
]){
 const src=fixture.find(x=>x.id===item.source),p=budget(src,item.level),ev=evaluate(src,p,item.sections);
 if(!ev.valid){errors.push({id:item.lab+':'+item.source+':'+item.level,error:ev.error});continue}
 if(Math.abs(ev.reduction-item.previousPct)>.011)errors.push({id:item.lab+':'+item.source+':'+item.level,error:'percentage changed'});
 replays.push({lab:item.lab,source:item.source,level:item.level,percent:ev.reduction,strictBand:ev.strictBand,strictCombined:ev.strictCombined,toleranceCombined:ev.toleranceCombined,
  rows:ev.rows,limit:p.targetCap,letterDiff:ev.letters-p.targetLetters,short:p.short,smallShortfall:ev.smallShortfall,
  appropriateNote:'Comparative replay only, not a new model generation, no semantic certificate'});
}
const report={study:'LAB92 no-padding fractional grid/letter accounting deterministic stress',
 date:new Date().toISOString(),modelCalls:0,
 method:'24k deterministic random cases + 30 fixtures and replay of all completed LAB89/LAB90 model texts; never infer semantic completeness from math.',
 overview:{fixtureChecks:checks.length,randomChecks:randomCount,errors:errors.length,
  historicalReplays:replays.length,old89:replays.filter(x=>x.lab==='LAB89').length,old90:replays.filter(x=>x.lab==='LAB90').length,
  previous89Combined:replays.filter(x=>x.lab==='LAB89'&&x.strictCombined).length,
  previous90Combined:replays.filter(x=>x.lab==='LAB90'&&x.strictCombined).length,
  historicalSmallShortfall:replays.filter(x=>x.smallShortfall).length},
 calibration:AVG,width:WIDTH,fixtures:checks,history:replays,errors};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab92-offline-stop-complete.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB92_OFFLINE_RESULT',JSON.stringify(report.overview));
if(errors.length)process.exitCode=1;
