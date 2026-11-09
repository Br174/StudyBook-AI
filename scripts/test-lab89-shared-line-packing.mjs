// StudyBook LAB89: deterministic shared-line packing of original real Gemini sections.
// No provider calls or content rewriting. Distinguishes strict per-section cap from fixed whole-page cap.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {wrap,alpha,WIDTH} from './lab89-budget-engine.mjs';
const input=JSON.parse(readFileSync('audit/reports/lab89-proportional-real-gemini.json','utf8'));
const records=[];
for(const r of input.records.filter(v=>v.textReturned&&v.validation?.structurallyValid)){
 const segments=r.sections.map(s=>String(s.text).normalize('NFC').replace(/\s+/gu,' ').trim());
 const joined=segments.join(' '),layout=wrap(joined);
 const packed=layout.lines.join('\n');
 const id=r.source+':'+r.level;
 if(alpha(packed)!==r.validation.actualLetters)throw Error('Letter count changed '+id);
 if(packed.replace(/\s+/gu,' ').trim()!==joined.replace(/\s+/gu,' ').trim())throw Error('Content changed '+id);
 if(layout.lines.some(line=>[...line].length>WIDTH))throw Error('Line too long '+id);
 const individual=r.validation.geometry.map(g=>g.rows);
 const sums=individual.reduce((a,b)=>a+b,0);
 const withinGlobal=layout.lines.length<=r.plan.maxRows;
 const bandPass=r.validation.bandPass;
 // Section quotas are NOT silently declared satisfied when sharing lines.
 records.push({
  source:r.source,level:r.level,targetRows:r.plan.maxRows,
  proportionalAssignedRows:r.plan.segments.map(s=>s.maxRows),
  independentRows:individual,sumIndependentRows:sums,
  strictIndividualCapPass:r.validation.gridPass,
  totalPackedRows:layout.lines.length,totalSavedRows:sums-layout.lines.length,
  packedGlobalPageCapPass:withinGlobal,percentPass:bandPass,
  bothPackedAndPercentPass:withinGlobal&&bandPass,
  sectionCapPassAfterSharedLayout:'NOT_EVALUATED_AS_FIXED_EXCLUSIVE_ROWS',
  unchangedAlphabeticLetters:true,unchangedNormalizedText:true,
  semanticQualityCertified:false,heuristicQualitySignals:r.semanticFlags?.length||0,
  warnings:['No changes to Gemini wording, facts, punctuation or source-page boundaries.',
   'A shared line may include the end of a concept and the beginning of the next concept.',
   'This validates global capacity only, not the previously assigned exclusive per-concept row maximum.']
 });
}
const sum=(key)=>records.filter(r=>r[key]).length;
const report={name:'StudyBook LAB89 shared-line deterministic repacking of real proportional Gemini sections',
 date:new Date().toISOString(),
 source:'audit/reports/lab89-proportional-real-gemini.json',
 noFurtherGeminiCalls:true,kind:'OFFLINE_GEOMETRY_EXPERIMENT',
 warning:'No semantic fixes. Sharing a physical line effectively relaxes the strict exclusive row budget per concept. Future generation must allocate flexible cell slots before calling Gemini, while retaining whole-page grid, semantic coverage and Unicode-letter targets.',
 aggregate:{cases:records.length,strictPerSectionGridPass:sum('strictIndividualCapPass'),
  wholePageSharedLineGridPass:sum('packedGlobalPageCapPass'),
  percentPass:sum('percentPass'),strictAndPercent:records.filter(r=>r.strictIndividualCapPass&&r.percentPass).length,
  sharedAndPercent:sum('bothPackedAndPercentPass'),
  cumulativeRowsRecovered:records.reduce((a,r)=>a+r.totalSavedRows,0),
  letterOrTextChanged:records.filter(r=>!r.unchangedAlphabeticLetters||!r.unchangedNormalizedText).length},
 records};
mkdirSync('audit/reports',{recursive:true});
writeFileSync('audit/reports/lab89-shared-line-repacking.json',JSON.stringify(report,null,2)+'\n');
console.log('LAB89_SHARED_LINE_FINAL',JSON.stringify(report.aggregate));
if(records.length!==15||report.aggregate.letterOrTextChanged!==0)process.exitCode=1;
