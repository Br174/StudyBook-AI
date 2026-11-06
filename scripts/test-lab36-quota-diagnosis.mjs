import assert from 'node:assert/strict';
import {diagnoseGeminiQuota} from '../api/geminiQuotaV36.js';
const now=Date.parse('2026-11-06T12:00:00.000Z');
const from=([id,metric,quotaValue],retry=null,headers=null)=>{
  const body={error:{message:'Resource exhausted',details:[
    {'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:id,quotaMetric:metric,quotaValue}]},
    ...(retry?[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:retry}]:[])]}};
  return diagnoseGeminiQuota({body,status:429,model:'gemini-3.6-flash',now,headers});
};
const minute=from(['GenerateRequestsPerMinutePerProjectPerModel-FreeTier','generate_content_free_tier_requests','30'],'70s');
assert.equal(minute.kind,'requests-minute');assert.equal(minute.retryAfterSeconds,70);
const tokens=from(['GenerateContentInputTokensPerModelPerMinute-FreeTier','generate_content_free_tier_input_token_count','1000'],'3m');
assert.equal(tokens.kind,'tokens-minute');assert.equal(tokens.retryAfterSeconds,180);
const daily=from(['GenerateRequestsPerDayPerProjectPerModel-FreeTier','generate_content_free_tier_requests','20'],'86000s');
assert.equal(daily.kind,'daily');assert.equal(daily.retryAfterSeconds,86000);
const zero=from(['GenerateRequestsPerDayPerProjectPerModel-FreeTier','generate_content_free_tier_requests','0']);
assert.equal(zero.kind,'no-free-allocation');assert.equal(zero.automatic,false);
const bill=diagnoseGeminiQuota({status:429,body:{error:{message:'Prepay funds depleted; spend cap exceeded.'}},now});
assert.equal(bill.kind,'billing');assert.equal(bill.automatic,false);
const retry=diagnoseGeminiQuota({status:429,body:{error:{message:'Unknown error'}},headers:new Headers({'Retry-After':'44'}),now});
assert.equal(retry.retryAfterSeconds,44);
const fallback=diagnoseGeminiQuota({status:429,body:{error:{message:'Quota exceeded'}},now});
assert.equal(fallback.estimated,true);assert.equal(fallback.retryAfterSeconds,900);
assert.equal(fallback.kind,'unknown');
const overload=diagnoseGeminiQuota({status:503,body:{},now});
assert.equal(overload.kind,'overload');
console.log('LAB36 Gemini quota taxonomy: RPM, TPM, RPD, RetryInfo, billing and zero-free protection OK');
