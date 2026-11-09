// MotorLab StudyBook LAB87: deterministic audit acceptance seal.
// This guards against publishing an invalid corrected text; it is NOT a semantic model.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const raw=JSON.parse(readFileSync('audit/reports/lab87-targeted-repair-real-gemini.json','utf8'));
const baseline=JSON.parse(readFileSync('audit/reports/lab86-six-levels-real-gemini.json','utf8'));
const qa=JSON.parse(readFileSync('audit/reports/lab87-qualitative-review.json','utf8'));
if(raw.records.length!==qa.reviews.length)throw new Error('Missing human-review record');
const rows=[];
for(const test of raw.records){
 const reference=baseline.records.find(x=>x.source===test.source&&x.level===test.level);
 const check=qa.reviews.find(x=>x.source===test.source&&x.level===test.level);
 if(!reference||!check)throw new Error('Missing original source or manual review for '+test.source+' '+test.level);
 if(reference.text!==test.previous)throw new Error('Immutable baseline mismatch');
 if(reference.originalLetters!==test.after.letterBand[1]&&test.after.letters<0)throw new Error('Invalid measured letters');
 const passesNumeric=test.after.gridPass&&test.after.mathPass;
 const passesPreliminary=passesNumeric&&test.after.wordIntegrityPass&&test.after.heuristicConceptPass&&test.after.noContextLeak;
 const accepted=passesPreliminary&&check.decision==='APPROVE';
 if(check.decision!=='APPROVE'&&check.decision!=='REJECT')throw new Error('Invalid review decision');
 if(check.decision==='REJECT'&&accepted)throw new Error('Rejected text must never be published');
 rows.push({source:test.source,level:test.level,gridPass:test.after.gridPass,mathPass:test.after.mathPass,
  automatedTextChecks:test.after.wordIntegrityPass&&test.after.heuristicConceptPass&&test.after.noContextLeak,
  explicitQualityReview:check.decision,acceptedForPublishing:accepted,
  action:accepted?'CANDIDATE_ONLY_REQUIRES_RELEASE_QA':'REJECT_AND_PRESERVE_SOURCE',
  sourceNeverMutated:true,
  issueCount:check.issues.length,
  issues:check.issues});
}
const summary={reviewed:rows.length,numericallyConforming:rows.filter(x=>x.gridPass&&x.mathPass).length,
 preliminaryAutomatedTextClean:rows.filter(x=>x.automatedTextChecks).length,
 approvedForPublishing:rows.filter(x=>x.acceptedForPublishing).length,
 rejected:rows.filter(x=>!x.acceptedForPublishing).length};
const report={experiment:'LAB87 acceptance seal',source:'LAB86 original and LAB87 corrected text, plus focused review',scope:'audit only',mainBranchModified:false,appModified:false,
 releaseAllowed:summary.approvedForPublishing>0&&summary.rejected===0,
 note:'Manual assistant review is not an expert validation; all eight are rejected. Grid and percentage success NEVER auto-publishes.',
 summary,rows};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab87-acceptance-gate.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB87_ACCEPTANCE_GATE',JSON.stringify(summary));
if(rows.length!==8||summary.approvedForPublishing!==0||summary.rejected!==8)process.exitCode=1;
