#!/usr/bin/env node
// LAB137 — deterministic Android foreground recovery regression.
// No network, credentials, Gemini requests, Android work or paid services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planStudyAutoResumeV45, autoResumeWakeDecisionV54,
 autoResumeNextWakeMsV54,autoResumeRecheckDelayV137,
 geminiResumeDisplayV55} from '../src/lib/studyAutoResumeV45.js';

const version='lab126-whole-book-comprehension-v1';
const NOW=Date.parse('2026-11-16T14:31:00+01:00');
const OLD=Date.parse('2026-11-16T14:00:00+01:00');
const LATER=Date.parse('2026-11-16T15:00:00+01:00');
const snapshot=(at,status='quota-paused')=>({
 version,complete:false,status,
 sourceFingerprint:'f'.repeat(64),
 verifiedChunkVariants:9,totalChunkVariants:44,
 draftUnitsSaved:44,quota:{automatic:true,estimated:true,
  kind:'overload',retryAt:new Date(at).toISOString()},
 providerRecoveryV128:{overloadStrikes:5,maxBlockChars:40000}
});
const expired=snapshot(OLD);
const late=planStudyAutoResumeV45(expired,NOW,10);
assert.equal(late.reason,'provider-cooldown');
assert.equal(late.at,NOW,'An overdue provider cooldown must wake immediately');
assert.equal(geminiResumeDisplayV55(expired,NOW).expired,true);
assert.equal(autoResumeWakeDecisionV54(late,{now:NOW,visible:true,inFlight:false}),'ready');
assert.equal(autoResumeRecheckDelayV137('ready',late,NOW),null);
assert.equal(autoResumeWakeDecisionV54(late,{now:NOW,visible:false,inFlight:false}),
 'foreground-required');
assert.equal(autoResumeRecheckDelayV137('foreground-required',late,NOW),15000,
 'A frozen background timer is rearmed, NOT considered consumed');
assert.equal(autoResumeRecheckDelayV137('in-flight',late,NOW),2500,
 'Never launch two concurrent Gemini retries');
const upcoming=planStudyAutoResumeV45(snapshot(LATER),NOW,10);
assert.equal(autoResumeWakeDecisionV54(upcoming,{now:NOW,visible:true,inFlight:false}),
 'too-early');
assert.ok(autoResumeNextWakeMsV54(upcoming,NOW)>0);
assert.equal(autoResumeRecheckDelayV137('too-early',upcoming,NOW),
 autoResumeNextWakeMsV54(upcoming,NOW));
assert.equal(autoResumeWakeDecisionV54(upcoming,{now:LATER,visible:true,inFlight:false}),
 'ready');
assert.equal(planStudyAutoResumeV45({...expired,complete:true},NOW,0),null);
const overlay={...snapshot(LATER,'quality-review'),diagnostics:{qualityReview:35}};
assert.equal(planStudyAutoResumeV45(overlay,NOW,0).reason,'provider-cooldown',
 'A quality review must not bypass a pending provider 503 cooldown');

// Verify the app uses ONE existing owner, not a second scheduler, and
// repairs BOTH missed Android wake events and missing in-memory book state.
const app=readFileSync('src/AppV15.jsx','utf8');
const start=app.indexOf('// LAB46: the SAME LAB45 recovery planner');
const end=app.indexOf('function navigateTo(',start);
assert.ok(start>=0&&end>start);
const owner=app.slice(start,end);
assert.ok(owner.includes('autoResumeRecheckDelayV137'));
assert.ok(owner.includes("document.addEventListener('resume',tryResume)"));
assert.ok(owner.includes("window.addEventListener('online',tryResume)"));
assert.ok(owner.includes('resumeFromHome({auto:true})'));
assert.ok(owner.includes('activeEdition&&documentData&&libraryId'));
assert.ok(owner.includes('if(decision!==\'ready\')return'));
assert.equal((owner.match(/setTimeout\(/g)||[]).length,1,
 'Keep exactly one scheduled foreground wake inside the existing owner');
assert.equal((owner.match(/setInterval\(/g)||[]).length,0,
 'No background infinite polling');
assert.ok(!owner.includes('navigator.serviceWorker.register'));
console.log('LAB137 PASS: expired 503 wake, Android hidden/focus rearm,');
console.log('single writer, no premature retry, checkpoint rehydration, no second timer.');
