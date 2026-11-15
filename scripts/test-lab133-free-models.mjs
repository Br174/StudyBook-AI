#!/usr/bin/env node
// LAB133 offline model comparison — no Gemini calls or text in diagnostics.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V128_DEFAULT_BLOCK_CHARS,providerRecoveryStateV128,providerPauseV128,
 providerSuccessfulBlockV128,V133_BLOCK_POLICY} from '../src/lib/explainedProviderRecoveryV128.js';
import {FREE_STUDY_MODELS_V133,modelComparisonStateV133,selectFreeStudyModelV133,
 recordFreeStudyModelV133,modelComparisonReportV133} from '../src/lib/explainedModelComparisonV133.js';
assert.deepEqual(FREE_STUDY_MODELS_V133,
 ['gemini-3.1-flash-lite','gemini-3.5-flash-lite']);
let benchmark=modelComparisonStateV133();
assert.equal(selectFreeStudyModelV133(benchmark),'gemini-3.1-flash-lite');
benchmark=recordFreeStudyModelV133(benchmark,{
 model:'gemini-3.1-flash-lite',status:503});
assert.equal(selectFreeStudyModelV133(benchmark),'gemini-3.5-flash-lite');
benchmark=recordFreeStudyModelV133(benchmark,{
 model:'gemini-3.5-flash-lite',status:200,
 sourceChars:12000,elapsedMs:16000,readyPages:5,receivedPages:5});
assert.equal(selectFreeStudyModelV133(benchmark),'gemini-3.5-flash-lite');
benchmark=recordFreeStudyModelV133(benchmark,{
 model:'gemini-3.1-flash-lite',status:200,
 sourceChars:15000,elapsedMs:7000,readyPages:6,receivedPages:6});
const results=modelComparisonReportV133(benchmark);
assert.equal(results.length,2);
assert.equal(results[0].http503,1);
assert.equal(results[1].success,1);
assert.ok(results[0].charsPerSecond>results[1].charsPerSecond);
assert.equal(results[0].acceptancePct,100);
assert.ok(!JSON.stringify(benchmark).includes('sourceText'));
const json=JSON.stringify(benchmark);
assert.equal(JSON.stringify(modelComparisonStateV133(JSON.parse(json))),json);
const original=modelComparisonStateV133(benchmark);
recordFreeStudyModelV133(benchmark,{model:'unknown-model',status:200});
assert.deepEqual(benchmark,original,'Unknown models cannot be silently tested');
const overloaded=providerPauseV128({},{httpStatus:503,now:0});
assert.equal(overloaded.state.maxBlockChars,40000);
const second=providerPauseV128(overloaded.state,{httpStatus:503,now:90000});
assert.equal(second.state.maxBlockChars,40000);
assert.ok(second.seconds>=180);
const old=providerRecoveryStateV128({maxBlockChars:7500,lastStatus:503,overloadStrikes:4});
assert.equal(old.maxBlockChars,40000,'Restore legacy checkpoints shrunk by 503');
assert.equal(old.blockPolicy,V133_BLOCK_POLICY);
const quota=providerPauseV128(old,{httpStatus:429,retryAfterSeconds:420,now:0});
assert.equal(quota.state.maxBlockChars,40000);
assert.ok(quota.seconds>=420);
const small=providerRecoveryStateV128({maxBlockChars:15000,lastStatus:0});
assert.equal(providerSuccessfulBlockV128(providerSuccessfulBlockV128(small)).maxBlockChars,22500,
 'Legitimate smaller legacy packet can safely grow after successes');
assert.equal(V128_DEFAULT_BLOCK_CHARS,40000);
const worker=readFileSync('api/explainedV126.js','utf8');
const generator=readFileSync('src/lib/explainedGeneratorV126.js','utf8');
assert.ok(worker.includes('V133_MODEL_INVALID'));
assert.ok(worker.includes('X-StudyBook-Model-Compare-Contract'));
assert.ok(generator.includes('selectFreeStudyModelV133'));
assert.ok(generator.includes("MAX_STAGE_SOURCE=40000"));
assert.ok(generator.includes("modelComparisonV133:modelComparisonReportV133"));
console.log('LAB133 PASS: free model A/B, 40k blocks, 503 stable, safe quota and checkpoints.');
