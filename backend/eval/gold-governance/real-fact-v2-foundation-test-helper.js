import { buildRealFactV2FoundationInternal } from './real-fact-v2-foundation-core.js';

// Eval-only fixture adapter. The production-shaped builder never accepts a projection override.
export function buildRealFactV2FoundationForTest({ candidate, snapshot, candidates = [], snapshots = new Map(), projection, outputDir = null } = {}) {
  if (process.env.V43_GOLD_V2_TEST_PROJECTION !== '1') throw new Error('TEST_PROJECTION_GUARD_REQUIRED');
  const actualCandidates = candidate ? [candidate] : candidates;
  const actualSnapshots = candidate ? new Map([[candidate.source_id, snapshot]]) : snapshots;
  return buildRealFactV2FoundationInternal({ candidates: actualCandidates, snapshots: actualSnapshots, outputDir, projection });
}
