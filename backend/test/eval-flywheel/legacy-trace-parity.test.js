import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkCanonicalRequirements, buildRequirementTrace } from '../../src/eval/flywheel/adapters/requirement.js';
import { runDeterministicEvaluators } from '../../src/eval/flywheel/deterministic-evaluator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SOURCE_PATH = path.join(ROOT, 'docs/eval/p0-recall/GPT_SOURCE_TRUTH_P0_CORE6_V1.json');
const OLD_TRACE_PATH = path.join(ROOT, 'docs/eval/p0-recall/V43_P0_487_PROVENANCE_TRACE_INDEX.json');
const PRODUCTION_DIR = path.join(ROOT, 'docs/eval/requirement-production-core6-20260911');
const EXPORTS = {
  'JY-001': 'JY-001.production-requirements.json',
  'TB-003': 'TB-003.production-requirements.json',
  'TB-006': 'TB-006.production-requirements.json',
  'FAST-01': 'FAST-01.production-requirements.json',
  'FAST-04': 'FAST-04.production-requirements.json',
  'FAST-WATER-01': 'FAST-WATER-01.production-requirements.json'
};

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

function linkedRequirements(atom, index) {
  const artifact = index.get(atom.tender);
  return linkCanonicalRequirements({ atom, requirements: artifact?.requirements || [] });
}

test('legacy mechanical trace parity preserves source/page many-to-many linkage', () => {
  const source = readJson(SOURCE_PATH);
  const old = readJson(OLD_TRACE_PATH);
  const index = new Map(Object.entries(EXPORTS).map(([tender, fileName]) => [tender, readJson(path.join(PRODUCTION_DIR, fileName))]));
  assert.equal(source.atoms.length, 487);
  assert.equal(old.atoms.length, 487);

  let linkedAtomCount = 0;
  let totalLinks = 0;
  let chunkObservable = 0;
  let sourceResolutionObservable = 0;
  let canonicalLineageObservable = 0;
  let noMechanicalLinkCount = 0;
  let providerInputEvidenceGaps = 0;
  let rawCandidateEvidenceGaps = 0;
  let normalizationEvidenceGaps = 0;
  const currentIds = new Set();

  for (const atom of source.atoms) {
    currentIds.add(atom.atom_id);
    const links = linkedRequirements(atom, index);
    const oldAtom = old.atoms.find((item) => item.atom_id === atom.atom_id);
    assert.ok(oldAtom, `missing historical atom ${atom.atom_id}`);
    const oldLinks = oldAtom.canonical_trace?.mechanically_linked_requirements || [];
    const currentIdSet = new Set(links.map((item) => item.requirement_id));
    const oldIdSet = new Set(oldLinks.map((item) => item.requirement_id));
    assert.deepEqual([...currentIdSet].sort(), [...oldIdSet].sort(), `canonical IDs drifted for ${atom.atom_id}`);
    const oldMethodById = new Map(oldLinks.map((item) => [item.requirement_id, item.mechanical_link_methods?.[0] || null]));
    for (const link of links) assert.equal(link.link_method, oldMethodById.get(link.requirement_id), `link method drifted for ${atom.atom_id}/${link.requirement_id}`);
    if (links.length) {
      linkedAtomCount += 1;
      totalLinks += links.length;
      chunkObservable += 1;
      sourceResolutionObservable += 1;
      canonicalLineageObservable += 1;
    } else {
      noMechanicalLinkCount += 1;
    }
    providerInputEvidenceGaps += 1;
    rawCandidateEvidenceGaps += 1;
    normalizationEvidenceGaps += 1;
    const trace = buildRequirementTrace({
      evalRunId: 'V43-FLYWHEEL-P0-487-R3',
      caseId: atom.atom_id,
      source: { tender_id: atom.tender, source_hash: atom.source_truth?.source_hash || null, text: atom.atomic_requirement },
      stages: {
        section: { section_id: `page:${atom.page}` },
        chunk: links.length ? { chunk_numbers: [...new Set(links.map((item) => item.source_span.chunk_number).filter(Boolean))], source_span_valid: true, reconstructable: true } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND' },
        provider_input: null,
        raw_candidate: null,
        normalization: null,
        source_resolution: links.length ? { source_refs: [...new Set(links.flatMap((item) => item.source_refs))], source_verified: links.every((item) => item.source_verified) } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND' },
        canonical_requirement: links.length ? { canonical_requirement_ids: links.map((item) => item.requirement_id), canonical_link_count: links.length } : { status: 'ABSENT', failure_code: 'NO_MECHANICAL_LINK_FOUND' }
      }
    });
    const evaluated = runDeterministicEvaluators(trace, { source_hash: atom.source_truth?.source_hash || null });
    assert.equal(evaluated.find((row) => row.check_id === 'CHUNK_SOURCE_SPAN_VALID')?.result, links.length ? 'PASS' : 'NOT_EVALUATED');
    assert.equal(evaluated.find((row) => row.check_id === 'SOURCE_RESOLUTION_PRESENT')?.result, links.length ? 'PASS' : 'NOT_EVALUATED');
  }

  assert.equal(currentIds.size, 487);
  assert.equal(linkedAtomCount, 472);
  assert.equal(chunkObservable, 472);
  assert.equal(sourceResolutionObservable, 472);
  assert.equal(canonicalLineageObservable, 472);
  assert.equal(noMechanicalLinkCount, 15);
  assert.equal(totalLinks, 5286);
  assert.equal(providerInputEvidenceGaps, 487);
  assert.equal(rawCandidateEvidenceGaps, 487);
  assert.equal(normalizationEvidenceGaps, 487);
});
