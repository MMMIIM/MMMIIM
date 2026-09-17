import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRealFactV2FoundationInternal, renderRealFactV2Manifest, renderRealFactV2BlindPacket, REAL_FACT_V2_SCHEMA_VERSION } from './real-fact-v2-foundation-core.js';
import { SOURCE_CANDIDATES } from '../gold-human-review/v2/mapping-real-rebuild/build-real-gold-source-foundation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECTION_PATH = path.resolve(HERE, '../gold-human-review/v2/mapping-real-rebuild/00_source_role_projection.json');
const projection = JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8'));

export { REAL_FACT_V2_SCHEMA_VERSION, renderRealFactV2Manifest, renderRealFactV2BlindPacket };
export function buildRealFactV2Foundation({ candidates = [], snapshots = new Map(), outputDir = path.join(HERE, 'v43-gold-v2-foundation') } = {}) {
  return buildRealFactV2FoundationInternal({ candidates, snapshots, outputDir, projection });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildRealFactV2Foundation({ candidates: SOURCE_CANDIDATES });
  console.log(JSON.stringify({ REAL_FACT_V2_ELIGIBLE_CANDIDATES: result.eligibleCount, rejected: result.rejectionAudit.length, provider_calls: 0, db_writes: 0 }, null, 2));
}
