import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const skillPath = new URL('../../.codex/skills/engineering-governance/SKILL.md', import.meta.url);

test('engineering governance declares Parity as a focused review dimension', async () => {
  const skill = await readFile(skillPath, 'utf8');
  assert.match(skill, /7\. Parity/);
  assert.match(skill, /production-like evaluation/);
});

test('engineering governance requires fail-closed canonical input parity before Provider', async () => {
  const skill = await readFile(skillPath, 'utf8');
  assert.match(skill, /production\s+owner/);
  assert.match(skill, /canonical resolver\/builder/);
  assert.match(skill, /PRODUCTION_PARITY_VIOLATION/);
  assert.match(skill, /before Provider invocation/);
  assert.match(skill, /must not independently reconstruct/);
});

test('engineering governance requires cross-run identity and evaluation certification invariants', async () => {
  const skill = await readFile(skillPath, 'utf8');
  assert.match(skill, /Ephemeral Identity/);
  assert.match(skill, /Evaluation Certification/);
  assert.match(skill, /No Shadow Evaluation Semantics/);
  assert.match(skill, /Evaluator Identity/);
  assert.match(skill, /EVALUATOR_NOT_CERTIFIED/);
});
