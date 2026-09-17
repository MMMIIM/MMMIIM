import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const ROOT = path.resolve(process.cwd());
const REPO = fs.existsSync(path.join(ROOT, 'backend')) ? ROOT : path.resolve(ROOT, '..');
const DOCS = path.join(REPO, 'docs');
const OUT_DIR = path.join(DOCS, 'handoff', 'V43_RESPONSE_ROUTER_V2_2_BOUNDED_SEMANTIC_CLOSURE');
const ZIP_PATH = `${OUT_DIR}.zip`;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => fs.readFileSync(file);
const readJson = file => JSON.parse(read(file).toString('utf8'));

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const full = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_VS_REFERENCE_V3_FULL_CORPUS_EVAL.json'));
  const overlay = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_REFERENCE_V3_GPT_OVERLAY_V1.json'));
  const replay = full;
  const recert = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_EXECUTION_LAYER_RECERT.json'));
  const baseline = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_BACKEND_FAILURE_SET_COMPARISON.json'));
  const checkpoint = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_CHECKPOINT.json'));
  const metricContract = readJson(path.join(DOCS, 'V43_RESPONSE_ROUTER_V2_2_METRIC_CONTRACT.json'));
  const unsafeIds = new Set(full.rows.filter(row => row.gpt_adjudication).map(row => row.case_id));
  const packetRows = full.rows.filter(row => unsafeIds.has(row.case_id) || (row.cohort === 'CORE6' && row.router.response_mode === 'NEED_REVIEW')).map(row => ({
    case_id: row.case_id,
    cohort: row.cohort,
    tender_id: row.tender_id,
    requirement_id: row.requirement_id,
    requirement_text: row.requirement_text,
    source_refs: row.source_refs,
    source_excerpt: row.source_excerpt,
    source_span: row.source_span,
    source_hash: row.source_hash,
    source_verified: row.source_verified,
    reference_v3: row.reference_v3,
    gpt_adjudication: row.gpt_adjudication,
    gpt_overlay_applied: row.gpt_overlay_applied,
    router_v2_2: {
      response_mode: row.router.response_mode,
      response_required: row.router.response_required,
      risk_tier: row.router.risk_tier,
      evidence_dependency: row.router.evidence_dependency,
      human_required: row.router.human_required,
      scoring_related: row.router.is_scoring_related,
      routing_reasons: row.router.routing_reasons,
      secondary_dependencies: row.router.secondary_dependencies
    },
    disagreement_dimensions: row.disagreement_dimensions,
    semantic_root_cause: 'PENDING_GPT'
  }));
  const packet = {
    artifact_type: 'V43_RESPONSE_ROUTER_V2_2_GPT_SEMANTIC_REVIEW_PACKET',
    artifact_version: 'v1',
    blind_to_new_semantics: true,
    purpose: 'Review remaining safety disagreements, GPT-adjudicated unsafe rows, and materially relevant Core6 NEED_REVIEW rows.',
    reference_v3_sha256: full.reference_v3.sha256,
    router_identity: full.router_identity,
    case_count: packetRows.length,
    rows: packetRows,
    semantic_root_cause_policy: 'PENDING_GPT',
    provider_calls: 0,
    llm_calls: 0,
    production_db_writes: 0
  };
  const files = new Map();
  const add = (name, content) => files.set(name, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
  add('00_GPT_README.md', [
    '# V43 Response Router V2.2 bounded semantic closure', '',
    'This package contains deterministic Router V2.2 replay evidence and an Eval-only GPT overlay.',
    'Reference V3 is immutable. The GPT overlay is not imported by Production Router runtime.',
    'Review `02_GPT_SEMANTIC_REVIEW_PACKET.json`; semantic_root_cause remains PENDING_GPT.', '',
    `Reference V3 SHA256: ${full.reference_v3.sha256}`, `Reference rows: ${full.reference_v3.row_count}`, `GPT adjudicated rows: ${full.gpt_adjudication.row_count}`, `Overlay rows: ${overlay.row_count}`, `Router: ${full.router_identity.implementation_id}`, '',
    'Provider calls, LLM calls, Production DB writes, Gold/Reference/Requirement mutations: 0.'
  ].join('\n') + '\n');
  const manifest = {
    artifact_type: 'V43_HANDOFF_RESPONSE_ROUTER_V2_2_BOUNDED_SEMANTIC_CLOSURE',
    generated_at: new Date().toISOString(),
    reference_v3: full.reference_v3,
    gpt_adjudication: full.gpt_adjudication,
    router_identity: full.router_identity,
    run_id: full.run_id,
    packet_case_count: packetRows.length,
    required_files: ['00_GPT_README.md', '01_MANIFEST.json', '02_GPT_SEMANTIC_REVIEW_PACKET.json', '03_GPT_OVERLAY.json', '04_ROUTER_V2_2_REPLAY.json', '05_EXECUTION_LAYER_RECERT.json', '06_BACKEND_FAILURE_SET_COMPARISON.json', '07_CHECKPOINT.json', 'evidence/', 'SHA256SUMS.txt'],
    side_effects: { provider_calls: 0, llm_calls: 0, production_db_writes: 0, gold_mutations: 0, source_truth_mutations: 0, requirement_mutations: 0, reference_v3_mutations: 0, router_mutations: 0, commit: 0, push: 0, merge: 0, deploy: 0 },
    call_count_semantics: { offline_phase_provider_calls: 0, final_replay_provider_calls: 0, task_cumulative_provider_calls: 0, authoritative_replay_run_provider_calls: 0 },
    source_artifacts: {
      reference_v3_package: 'docs/V43_RESPONSE_ROUTER_FULL_CORPUS_GPT_SEMANTIC_REFERENCE_V3_PACKAGE.zip',
      gpt_adjudication_bundle: 'V43_GPT_ADJUDICATION_BUNDLE_20260912.zip',
      requirement_freeze_checkpoint: 'docs/V43_REQUIREMENT_V6_4_FREEZE_CHECKPOINT.json'
    },
    execution_layer_recert_status: recert.status,
    backend_failure_set_equivalent: baseline.comparison.set_equivalent,
    status: checkpoint.status
  };
  add('01_MANIFEST.json', `${JSON.stringify(manifest, null, 2)}\n`);
  add('02_GPT_SEMANTIC_REVIEW_PACKET.json', `${JSON.stringify(packet, null, 2)}\n`);
  add('03_GPT_OVERLAY.json', `${JSON.stringify(overlay, null, 2)}\n`);
  add('04_ROUTER_V2_2_REPLAY.json', `${JSON.stringify(replay, null, 2)}\n`);
  add('05_EXECUTION_LAYER_RECERT.json', `${JSON.stringify(recert, null, 2)}\n`);
  add('06_BACKEND_FAILURE_SET_COMPARISON.json', `${JSON.stringify(baseline, null, 2)}\n`);
  add('07_CHECKPOINT.json', `${JSON.stringify({ ...checkpoint, execution_layer: recert, backend_failure_set_comparison: baseline }, null, 2)}\n`);
  add('evidence/reference-v3-identity.json', `${JSON.stringify(full.reference_v3, null, 2)}\n`);
  add('evidence/gpt-adjudication-identity.json', `${JSON.stringify(full.gpt_adjudication, null, 2)}\n`);
  add('evidence/requirement-v6-4-freeze.json', read(path.join(DOCS, 'V43_REQUIREMENT_V6_4_FREEZE_CHECKPOINT.json')));
  add('evidence/metric-contract.json', `${JSON.stringify(metricContract, null, 2)}\n`);
  const sums = [...files.entries()].map(([name, content]) => `${sha256(content)}  ${name}`).sort().join('\n') + '\n';
  add('SHA256SUMS.txt', sums);
  for (const [name, content] of files) {
    const target = path.join(OUT_DIR, name.replaceAll('/', path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  const zip = new JSZip();
  for (const [name, content] of files) zip.file(name, content);
  const zipBytes = zip.generateNodeStream({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const chunks = []; zipBytes.on('data', chunk => chunks.push(chunk));
  zipBytes.on('end', () => {
    const buffer = Buffer.concat(chunks); fs.writeFileSync(ZIP_PATH, buffer);
    console.log(JSON.stringify({ zip_path: path.relative(REPO, ZIP_PATH), zip_sha256: sha256(buffer), zip_bytes: buffer.length, case_count: packetRows.length, evidence_file_count: [...files.keys()].filter(name => name.startsWith('evidence/')).length, decision_packet_sha256: sha256(files.get('02_GPT_SEMANTIC_REVIEW_PACKET.json')) }, null, 2));
  });
}

try { main(); } catch (error) { console.error(error?.message || String(error)); process.exitCode = 1; }
