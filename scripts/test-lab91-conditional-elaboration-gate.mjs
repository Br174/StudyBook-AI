// MotorLab LAB91: deterministic STOP-ON-COMPLETE gate; no padding or expansion for letter budget.
// NEVER calls Gemini; checks no-padding decisions against real LAB89/90 outputs and 20k cases.
// This is a gate/plan test, not evidence that Gemini can obey it.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const a=JSON.parse(readFileSync('audit/reports/lab89-proportional-real-gemini.json','utf8'));
const b=JSON.parse(readFileSync('audit/reports/lab90-fluid-useful-elaboration-real.json','utf8'));
const L=46.346,WIDTH=60;
const sum=a=>a.reduce((x,y)=>x+y,0);
function choose({original,level,letters,rows,maxRows}){
 if(!Number.isFinite(original)||original<=0||!Number.isFinite(letters)||letters<0)throw Error('invalid letters');
 if(![10,20,30,40,50,65].includes(level))throw Error('invalid level');
 const lower=Math.ceil(original*(1-(level+5)/100)),upper=Math.floor(original*(1-(level-5)/100));
 const desired=Math.round(original*(1-level/100));
 const spareRows=Math.max(0,maxRows-rows), deficit=desired-letters;
 // Never increase text merely to fill the last row or letter gap.
 // A small shortfall outside ±5 points is flagged, not silently passed.
 let action;
 if(letters>upper)action='REVIEW_FOR_SAFE_SHORTENING';
 else if(letters>=lower)action='KEEP_COMPLETE_TEXT_NO_PADDING';
 else if(deficit<=Math.ceil(L))action='REVIEW_SMALL_SHORTFALL_NO_PADDING';
 else action='REVIEW_LARGE_SHORTFALL_NO_PADDING';
 return{action,desired,lower,upper,deficit,spareRows,
  quantitativeBandPass:letters>=lower&&letters<=upper,
  paddingForbidden:true,contentFidelityRequiresIndependentReview:true};
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
  if(actualLetters>output.upper&&output.action!=='REVIEW_FOR_SAFE_SHORTENING')throw Error('overband not flagged');
  if(actualLetters>=output.lower&&actualLetters<=output.upper&&output.action!=='KEEP_COMPLETE_TEXT_NO_PADDING')throw Error('inband altered');
  if(actualLetters<output.lower&&output.action!=='REVIEW_SMALL_SHORTFALL_NO_PADDING'&&output.action!=='REVIEW_LARGE_SHORTFALL_NO_PADDING')throw Error('shortfall not flagged');
  if(!output.paddingForbidden)throw Error('padding ever allowed');
  if(output.action.includes('EXPAND'))throw Error('expansion forbidden');
 }catch(e){errors.push({i,error:String(e),output});if(errors.length>=10)break}
}
const aggregate={realCases:actual.length,lab90Cases:actual.filter(x=>x.source==='LAB90').length,
 lab90ShorteningReview:actual.filter(x=>x.source==='LAB90'&&x.action==='REVIEW_FOR_SAFE_SHORTENING').length,
 allRealPaddingForbidden:actual.every(x=>x.paddingForbidden),
 randomCases:20000,failed:errors.length};
const output={date:'2026-11-09',experiment:'LAB91 stop-on-complete no-padding gate',
 status:'offline audit only; no provider calls, no application production change',
 rules:'Stop once every essential thought is complete. Never expand or add words to fill half/one empty row or a target-letter deficit. Prefer modest shortness over padding. ±5 points remains the measured ideal; small deviations are flagged separately, and content correctness must be independently reviewed. Correct missing essential ideas, never add facts for length.',
 limitation:'The gate cannot verify semantic completeness itself. Under-target results are not automatically certified. The virtual 60-cell research grid does not prove physical A4 rendering.',
 aggregate,realObservations:actual,errors};
mkdirSync('audit/reports',{recursive:true});writeFileSync('audit/reports/lab91-conditional-elaboration-guard.json',JSON.stringify(output,null,2)+'\n');
console.log('LAB91_OFFLINE_RESULT',JSON.stringify(aggregate));
if(errors.length||!aggregate.allRealPaddingForbidden)process.exitCode=1;
