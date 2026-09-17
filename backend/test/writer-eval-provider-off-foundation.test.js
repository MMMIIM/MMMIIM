import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { runWriterProviderOffFoundation } from '../eval/gold-governance/writer-eval-provider-off-foundation.js';

const SOURCE_ROLE_CASES = [
  'ENTERPRISE_EVIDENCE_ASSERTABLE_PASS',
  'REFERENCE_SOLUTION_DESIGN_PASS',
  'REFERENCE_TO_ENTERPRISE_ASSERTION_FAIL',
  'FOREIGN_ENTERPRISE_IDENTITY_CONTAMINATION_FAIL',
  'REFERENCE_STRONG_FACT_PROMOTION_FAIL',
  'MIXED_ASSERTABLE_REFERENCE_BOUNDARY'
];

const MUTATION_DIMENSIONS = [
  'quantity',
  'entity',
  'status',
  'scope',
  'SLA',
  'certification',
  'customer_case',
  'unsupported_commitment',
  'authorization_source'
];

test('reference context can enrich design but cannot authorize enterprise assertions', () => {
  const result = runWriterProviderOffFoundation({ outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'writer-provider-off-role-')) });
  assert.deepEqual(Object.keys(result.sourceRoleBoundary), SOURCE_ROLE_CASES);
  assert.equal(result.sourceRoleBoundary.ENTERPRISE_EVIDENCE_ASSERTABLE_PASS, 'PASS');
  assert.equal(result.sourceRoleBoundary.REFERENCE_SOLUTION_DESIGN_PASS, 'PASS');
  assert.equal(result.sourceRoleBoundary.REFERENCE_TO_ENTERPRISE_ASSERTION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.FOREIGN_ENTERPRISE_IDENTITY_CONTAMINATION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.REFERENCE_STRONG_FACT_PROMOTION_FAIL, 'FAIL_CLOSED');
  assert.equal(result.sourceRoleBoundary.MIXED_ASSERTABLE_REFERENCE_BOUNDARY, 'FAIL_CLOSED');
  assert.equal(result.metrics.SOURCE_ROLE_BOUNDARY_EVAL, 'PASS');
  assert.equal(result.metrics.REFERENCE_SOLUTION_USAGE_PASS, 'PASS');
  assert.equal(result.metrics.REFERENCE_SOLUTION_USAGE_RATE, 1);
  assert.equal(result.metrics.REFERENCE_TO_ENTERPRISE_ASSERTION_BLOCK_RATE, 1);
  assert.equal(result.metrics.FOREIGN_ENTERPRISE_CONTAMINATION_BLOCK_RATE, 1);
  const rows = new Map(result.semanticCases.filter(row => row.case_class === 'SOURCE_ROLE').map(row => [row.id, row]));
  assert.equal(rows.get('ENTERPRISE_EVIDENCE_ASSERTABLE_PASS').actual, 'pass');
  assert.deepEqual(rows.get('ENTERPRISE_EVIDENCE_ASSERTABLE_PASS').source_roles, ['ENTERPRISE_EVIDENCE']);
  assert.equal(rows.get('ENTERPRISE_EVIDENCE_ASSERTABLE_PASS').authority_provenance[0].referenced_fact_ids[0], 'FACT-SOURCE-ROLE-001');
  assert.equal(rows.get('REFERENCE_SOLUTION_DESIGN_PASS').actual, 'pass');
  assert.deepEqual(rows.get('REFERENCE_SOLUTION_DESIGN_PASS').authority_provenance, []);
  assert.deepEqual(rows.get('REFERENCE_SOLUTION_DESIGN_PASS').used_context_refs, ['REFCTX-REF-DESIGN-001']);
  for (const id of SOURCE_ROLE_CASES.slice(2)) {
    assert.equal(rows.get(id).actual, 'failed');
    assert.equal(rows.get(id).pipeline.guardCriticalAssertions, 'FAIL_CLOSED');
    assert.ok(rows.get(id).guard_findings.length > 0);
  }
  assert.deepEqual(rows.get('MIXED_ASSERTABLE_REFERENCE_BOUNDARY').used_context_refs, ['REFCTX-REF-MIXED-001']);
  assert.ok(SOURCE_ROLE_CASES.slice(1).every(id => rows.get(id).used_context_refs.length === 1));
});

test('unsupported mutation dimensions fail closed through the existing Writer contracts', () => {
  const result = runWriterProviderOffFoundation({ outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'writer-provider-off-mutation-')) });
  assert.deepEqual(result.mutationCases.map(row => row.dimension), MUTATION_DIMENSIONS);
  assert.ok(result.mutationCases.every(row => row.expected === 'failed' && row.actual !== 'pass'));
  assert.ok(result.mutationCases.every(row => row.pipeline.buildWriterTask === 'PASS'));
  assert.ok(result.mutationCases.every(row => row.pipeline.validateWriterOutput === 'PASS'));
  assert.ok(result.mutationCases.every(row => row.pipeline.guardCriticalAssertions === 'FAIL_CLOSED'));
  assert.equal(result.provider_calls, 0);
  assert.equal(result.db_writes, 0);
});

test('semantic and engineering denominators remain separate', () => {
  const result = runWriterProviderOffFoundation({ outputDir: fs.mkdtempSync(path.join(os.tmpdir(), 'writer-provider-off-denominator-')) });
  assert.deepEqual(result.engineeringCases.map(row => row.id), ['W-AUTH-RETENTION-001', 'W-IDEMPOTENCY-AUTH-001']);
  assert.ok(result.engineeringCases.every(row => row.semantic_denominator_included === false));
  assert.equal(result.metrics.semantic_denominator, result.semanticCases.length);
  assert.equal(result.metrics.source_role_denominator, 6);
  assert.equal(result.metrics.mutation_denominator, 9);
  assert.equal(result.metrics.engineering_denominator, result.engineeringCases.length);
  assert.equal(result.metrics.semantic_denominator, 15);
  assert.equal(result.metrics.engineering_denominator, 2);
  assert.ok(result.semanticCases.every(row => row.pipeline.buildWriterTask === 'PASS'));
  assert.ok(result.semanticCases.every(row => row.pipeline.validateWriterOutput === 'PASS'));
  assert.ok(result.semanticCases.every(row => typeof row.pipeline.sanitizer === 'string'));
  assert.ok(result.semanticCases.every(row => typeof row.pipeline.validator === 'string'));
  assert.equal(result.status, 'READY/PASS');
});

test('checkpoint artifacts are deterministic, bounded, and disclose zero calls and writes', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-provider-off-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-provider-off-b-'));
  fs.writeFileSync(path.join(first, 'caller-sentinel.txt'), 'preserve me\n');
  const a = runWriterProviderOffFoundation({ outputDir: first });
  const b = runWriterProviderOffFoundation({ outputDir: second });
  const jsonName = 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.json';
  const mdName = 'V43_WRITER_EVAL_PROVIDER_OFF_FOUNDATION_CHECKPOINT.md';
  assert.equal(fs.readFileSync(path.join(first, jsonName), 'utf8'), fs.readFileSync(path.join(second, jsonName), 'utf8'));
  assert.equal(fs.readFileSync(path.join(first, mdName), 'utf8'), fs.readFileSync(path.join(second, mdName), 'utf8'));
  assert.equal(fs.readFileSync(path.join(first, 'caller-sentinel.txt'), 'utf8'), 'preserve me\n');
  assert.deepEqual(fs.readdirSync(first).sort(), ['caller-sentinel.txt', jsonName, mdName].sort());
  const checkpoint = JSON.parse(fs.readFileSync(path.join(first, jsonName), 'utf8'));
  assert.equal(checkpoint.provider_calls, 0);
  assert.equal(checkpoint.db_writes, 0);
  assert.equal(checkpoint.gold_mutations, 0);
  assert.equal(checkpoint.provider_execution, 'OFF');
  assert.equal(checkpoint.status, 'READY/PASS');
  assert.ok(checkpoint.semantic_cases.every(row => /^[a-f0-9]{64}$/.test(row.output_hash)));
  assert.ok(checkpoint.semantic_cases.every(row => row.guard_findings.every(finding => !Object.hasOwn(finding, 'text'))));
  const serialized = JSON.stringify(checkpoint);
  assert.equal(serialized.includes('不少于10万并发用户'), false);
  assert.equal(serialized.includes('海云集团客户案例'), false);
  assert.equal(serialized.includes('raw_output'), false);
  assert.deepEqual(a, b);
});
