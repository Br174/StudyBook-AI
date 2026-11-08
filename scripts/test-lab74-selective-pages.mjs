import assert from 'node:assert/strict';
import {selectPageRepairUnitsV74,pageLetterReviewV74}
 from '../src/lib/studyPageBudgetsV74.js';
const units=Array.from({length:3},(_,i)=>({
 id:'0:'+i,pageStart:i+1,pageEnd:i+1,source:String.fromCharCode(65+i).repeat(100)
}));
const drafts=[
 {id:'0:0',text:'A'.repeat(50)},
 {id:'0:1',text:'B'.repeat(100)},
 {id:'0:2',text:'C'.repeat(50)}
];
const selected=selectPageRepairUnitsV74(units,drafts,'50');
assert.deepEqual(selected.repairUnits.map(u=>u.id),['0:1']);
assert.deepEqual(selected.untouchedUnits.map(u=>u.id),['0:0','0:2']);
assert.deepEqual(selected.wrongPages.map(u=>u.pageStart),[2]);
const repaired=drafts.map(d=>d.id==='0:1'?{...d,text:'B'.repeat(50)}:d);
assert.equal(pageLetterReviewV74(units,repaired,'50').withinBand,true);
assert.equal(repaired[0].text,drafts[0].text);
assert.equal(repaired[2].text,drafts[2].text);
assert.equal(selectPageRepairUnitsV74(units,repaired,'50').repairUnits.length,0);
const overlapping=[
 {id:'0:0',pageStart:1,pageEnd:2,source:'A'.repeat(110)},
 {id:'0:1',pageStart:2,pageEnd:2,source:'B'.repeat(90)},
 {id:'0:2',pageStart:3,pageEnd:3,source:'C'.repeat(100)}
];
const selectedRange=selectPageRepairUnitsV74(overlapping,[
 {id:'0:0',text:'A'.repeat(110)},
 {id:'0:1',text:'B'.repeat(90)},
 {id:'0:2',text:'C'.repeat(50)}
],'50');
assert.deepEqual(selectedRange.repairUnits.map(u=>u.id),['0:0','0:1']);
assert.deepEqual(selectedRange.untouchedUnits.map(u=>u.id),['0:2']);
console.log('LAB74_SELECTIVE_PAGES_PASS: preserve conforming source-page groups, repair only wrong ones, keep overlapping originals atomic');
