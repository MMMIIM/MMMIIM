import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const FILES = [
  'backend/src/pipeline/requirement-response-router-v2-2-3.js',
  'backend/src/pipeline/response-decision-v1.js',
  'backend/src/pipeline/response-router-service.js'
];
const forbidden = [
  /JY-001|TB-003|TB-006|FAST-01|FAST-04|FAST-WATER-01/,
  /HOLDOUT-REQ(?:-V2)?-[0-9]+|CAN-[0-9]{4}/,
  /REFERENCE[_-]V3|GPT[_-]ADJUDICATION|REQUIREMENT[_-]?GOLD/,
  /DeepSeek|SiliconFlow|provider[_-]?api[_-]?key|Authorization/,
  /benchmark[_-]?id/
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const findings = [];
for (const relative of FILES) {
  const file = path.join(ROOT, relative);
  const source = fs.readFileSync(file);
  const text = source.toString('utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
  for (const pattern of forbidden) if (pattern.test(text)) findings.push({ file: relative, pattern: String(pattern) });
}
const result = { checkpoint: 'V43_RESPONSE_ROUTER_V2_2_3_STATIC_LEAKAGE_AUDIT', files: FILES.map(relative => ({ path: relative, sha256: sha(fs.readFileSync(path.join(ROOT, relative))) })), forbidden_pattern_count: findings.length, findings, provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, status: findings.length === 0 ? 'PASS' : 'FAIL' };
fs.writeFileSync(path.join(ROOT, 'docs/V43_RESPONSE_ROUTER_V2_2_3_STATIC_LEAKAGE_AUDIT.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
