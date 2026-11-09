// MotorLab LAB91: deterministic gate for source-grounded expansion vs compression.
// NEVER calls Gemini; exercises all real LAB89/90 outputs and 20k synthetic budgets.
// This is a gate/plan test, not evidence that Gemini can obey it.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const a=JSON.parse(readFileSync('audit/reports/lab89-proportional-real-gemini.json','utf8'));
const b=JSON.parse(readFileSync('audit/reports/lab90-fluid-useful-elaboration-real.json','utf8'));
const L=46.346,WIDTH=60;
const sum=a=>a.reduce((x,y)=>x+y,0);
function choose({original,level,letters,rows,maxRows,semanticsClear=false}){
 if(!Number.isFinite(original)||original<=0||!Number.isFinite(letters)||letters<0)throw Error('invalid letters');
 if(![10,20,30,40,50,65].includes(level))throw Error('invalid level');
 const lower=Math.ceil(original*(1-(level+5)/100)),upper=Math.floor(original*(1-(level-5)/100));
 const desired=Math.round(original*(1-level/100));
 const spareRows=Math.max(0,maxRows-rows);
 // No expansion if it is already within the band, or semantically finished.
 let action;
 if(letters>upper)action='SHORTEN_WITHOUT_LOSING_ESSENTIALS';
 else if(letters<lower){
  action=(spareRows>0&&!semanticsClear)?'EXPAND_ONLY_FROM_UNEXPRESSED_SOURCE_DETAILS':'REPHRASE_WITH_FULL_SEMANTIC_GUARD';
 }else action='DO_NOT_EXPAND';
 return{action,desired,lower,upper,delta:desired-letters,spareRows};
}
const actual=[];
for(const r of a.records.filter(x=>x.textReturned&&x.validation?.structurallyValid&&!x.plan.short)){
 const q=choose({original:r.plan.totalLetters,level:r.level,letters:r.validation.actualLetters,
  rows:r.validation.geometry.reduce((n,x)=>n+x.rows,0),maxRows:r.plan.maxRows});
 actual.push({source:'LAB89',case:r.source+':'+r.level,...q});
}
for(const r of b.records.filter(x=>x.validJson&&rTruthy(x.validation)&&!x.plan.short)){
 const q=choose({original:r.plan.originalLetters,level:r.level,letters:r.validation.actualLetters,
  rows:r.validation.actualPhysicalRows,maxRows:r.plan.physicalMaxRows});
 actual.push({source:'LAB90',case:r.source+':'+r.level,...q});
}
function rTruthy(x){return x&&x.structural}
let seed=991007,errors=[];
const rand=()=>((seed=(Math.imul(seed,1103515245)+12345)>>>0)/4294967296);
for(let i=0;i<20000;i++){
 const original=100+Math.floor(rand()*10000);
 const level=[10,20,30,40,50,65][i%6];
 const desired=Math.round(original*(1-level/100));
 const actualLetters=Math.max(0,desired+Math.floor((rand()-0.5)*Math.max(30,original*0.5)));
 const rows=Math.max(1,Math.ceil(actualLetters/L));
 const maxRows=Math.max(1,Math.ceil(desired/L));
 const output=choose({original,level,letters:actualLetters,rows,maxRows,semanticsClear:false});
 try{
  if(actualLetters>output.upper&&output.action!=='SHORTEN_WITHOUT_LOSING_ESSENTIALS')throw Error('overshoot elaboration');
  if(actualLetters>=output.lower&&actualLetters<=output.upper&&output.action!=='DO_NOT_EXPAND')throw Error('expand inside band');
  if(output.action==='EXPAND_ONLY_FROM_UNEXPRESSED_SOURCE_DETAILS'&&(actualLetters>=output.lower||rows>=maxRows))throw Error('expand without space');
 }catch(e){errors.push({i,error:String(e),output});if(errors.length>=10)break}
}
const aggregate={realCases:actual.length,lab90Cases:actual.filter(x=>x.source==='LAB90').length,
 lab90Shorten:actual.filter(x=>x.source==='LAB90'&&x.action==='SHORTEN_WITHOUT_LOSING_ESSENTIALS').length,
 lab90Expand:actual.filter(x=>x.source==='LAB90'&&x.action==='EXPAND_ONLY_FROM_UNEXPRESSED_SOURCE_DETAILS').length,
 lab89Expand:actual.filter(x=>x.source==='LAB89'&&x.action==='EXPAND_ONLY_FROM_UNEXPRESSED_SOURCE_DETAILS').length,
 lab89Shorten:actual.filter(x=>x.source==='LAB89'&&x.action==='SHORTEN_WITHOUT_LOSING_ESSENTIALS').length,
 randomCases:20000,failed:errors.length};
const output={date:'2026-11-09',experiment:'LAB91 conditional deficit gate for useful elaboration',
 status:'offline guard only; no model called; no application production changes',
 rules:'May expand source-grounded content only when text is BELOW the letter band and free grid capacity exists, and only if concepts require elaboration. Above band must shorten without losing semantic essentials; inside band do not expand. Short original pages use separate didactic simplification policy.',
 limitation:'This controller cannot revise live Gemini output during a single completion without model streaming/control APIs. It is a preflight/postflight gate and next-prompt blueprint, not a real-time interaction with the model.',
 aggregate,realObservations:actual,errors};
mkdirSync('audit/reports',{recursive:true});writeFileSync('audit/reports/lab91-conditional-elaboration-guard.json',JSON.stringify(output,null,2)+'\n');
console.log('LAB91_OFFLINE_RESULT',JSON.stringify(aggregate));
if(errors.length||aggregate.lab90Shorten!==aggregate.lab90Cases)process.exitCode=1;
