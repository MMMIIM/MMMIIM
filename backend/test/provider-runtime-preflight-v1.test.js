import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderRuntimePreflight } from '../eval/real-e2e/build-provider-runtime-preflight-v1.mjs';

test('provider runtime preflight is offline-only and separates reusable vectors from missing vectors', async () => {
  const { preflight, embeddingAudit, dependencyArtifact, hostGate } = await buildProviderRuntimePreflight();
  assert.equal(preflight.status, 'PROVIDER_RUNTIME_READY_WITH_HOST_GATE');
  assert.equal(preflight.network.attempted_this_run, false);
  assert.equal(preflight.side_effects.provider_calls, 0);
  assert.equal(preflight.side_effects.production_db_writes, 0);
  const base = embeddingAudit.corpora.find(row => row.corpus_id === 'CHENGCHUAN-SYNTHETIC-BASE-COM-01-16');
  assert.deepEqual({ materials: base.material_count, chunks: base.chunk_count, embeddings: base.embedding_row_count, dimension: base.dimension }, { materials: 16, chunks: 160, embeddings: 160, dimension: 1024 });
  assert.equal(base.valid_vector_reuse, true);
  const extension = embeddingAudit.corpora.find(row => row.corpus_id === 'CHENGCHUAN-SYNTHETIC-V2-EXTENSION');
  assert.equal(extension.material_count, 92);
  assert.equal(extension.valid_vector_reuse, false);
  assert.equal(hostGate.status, 'PROVIDER_RUNTIME_READY_WITH_HOST_GATE');
  assert.equal(hostGate.exact_next_host_command.repo_owned_script, 'backend/scripts/smoke-embedding.js');
  assert.equal(dependencyArtifact.entries.find(row => row.stage === 'Router').network_required, false);
  assert.equal(dependencyArtifact.entries.find(row => row.stage === 'Evidence retrieval').host_required, true);
});
