import test from 'node:test';
import assert from 'node:assert/strict';
import { SemanticGatewayClient } from '../src/pipeline/semantic-gateway-client.js';
import { GATEWAY_SMOKE_REQUEST, runGatewaySmoke } from '../scripts/gateway-smoke.js';
import { runGatewayCheck } from '../scripts/gateway-check.js';

function gatewayResponse(raw) {
  return new Response(JSON.stringify({ data: { outputs: { response_payload_json: raw } } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function mockClient(fetchImpl) {
  return new SemanticGatewayClient({ apiBase: 'https://gateway.invalid/v1', apiKey: 'never-print-this-test-key', user: 'smoke-test', fetchImpl, timeoutMs: 100 });
}

test('gateway:check 只对 /info 发起 GET 并输出脱敏应用摘要', async () => {
  const calls=[];const stdout=[];const stderr=[];const times=[1000,1010];
  const code=await runGatewayCheck({env:{V43_GATEWAY_API_BASE:'https://gateway.invalid/v1',V43_GATEWAY_API_KEY:'secret'},fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({name:'4.3 Requirement Extraction',mode:'workflow'}),{status:200,headers:{'Content-Type':'application/json'}})},stdout:x=>stdout.push(x),stderr:x=>stderr.push(x),now:()=>times.shift()});
  assert.equal(code,0);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://gateway.invalid/v1/info');assert.equal(calls[0].options.method,'GET');assert.equal(stderr.length,0);
  const output=JSON.parse(stdout[0]);assert.equal(output.app_name,'4.3 Requirement Extraction');assert.match(output.key_fingerprint,/^sha256:[a-f0-9]{12}$/);assert.doesNotMatch(stdout[0],/secret|Authorization/);
});

test('smoke:gateway 使用最小 requirement_extraction payload 并验证新契约', async () => {
  let sentInputs;const envelope={schema_version:'4.3-requirement-extraction-v3',task_type:'requirement_extraction',status:'success',data:{requirements:[]},warnings:[]};
  const client=mockClient(async(_url,options)=>{sentInputs=JSON.parse(options.body).inputs;return gatewayResponse(JSON.stringify(envelope))});const stdout=[];const stderr=[];const times=[2000,2025];
  const code=await runGatewaySmoke({client,stdout:x=>stdout.push(x),stderr:x=>stderr.push(x),now:()=>times.shift()});
  assert.equal(code,0);assert.equal(sentInputs.task_type,'requirement_extraction');assert.deepEqual(JSON.parse(sentInputs.task_payload_json),{project_name:'gateway-contract-smoke',section_name:'契约测试',chunk_index:1,chunk_count:1,chunk_text:'本片段为契约连通性测试，不包含招标需求。'});assert.deepEqual(sentInputs,GATEWAY_SMOKE_REQUEST);assert.equal(stderr.length,0);
  assert.deepEqual(JSON.parse(stdout[0]),{schema_version:'4.3-requirement-extraction-v3',task_type:'requirement_extraction',status:'success',requirements_count:0,warnings_count:0,elapsed_ms:25});
});

test('smoke 异常只输出安全错误码且绝不回退 result/text/answer', async () => {
  const client=mockClient(async()=>new Response(JSON.stringify({data:{outputs:{result:'{}',text:'{}',answer:'{}'}}}),{status:200,headers:{'Content-Type':'application/json'}}));const stdout=[];const stderr=[];const times=[3000,3004];
  const code=await runGatewaySmoke({client,stdout:x=>stdout.push(x),stderr:x=>stderr.push(x),now:()=>times.shift()});
  assert.equal(code,1);assert.equal(stdout.length,0);assert.equal(JSON.parse(stderr[0]).error_code,'GATEWAY_RESPONSE_PAYLOAD_MISSING');assert.doesNotMatch(stderr[0],/result|answer|never-print/);
});
