import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = path.join(ROOT, 'docs', 'eval', 'flywheel', 'p0-badcase-repair-v2');
const EVIDENCE_REL = process.env.V43_V64_EVIDENCE_REL || 'docs/eval/flywheel/p0-badcase-repair-v2/v6-4-evidence';
const paths = [
  path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_TARGETED_REPLAY.json'),
  path.join(OUT_DIR, 'V43_REQUIREMENT_V6_4_ROOT_CAUSE_TRACE.json')
];

function relocate(value) {
  if (Array.isArray(value)) return value.map(relocate);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, relocate(item)]));
  if (typeof value === 'string' && value.includes('restricted-evidence')) return `${EVIDENCE_REL}/${path.basename(value)}`;
  return value;
}

for (const filePath of paths) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fs.writeFileSync(filePath, `${JSON.stringify(relocate(value), null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({ relocated: paths.map((value) => path.relative(ROOT, value).replaceAll('\\', '/')), evidence_root: EVIDENCE_REL }));
