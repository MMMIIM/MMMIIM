import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const HANDOFF_DIR = path.join(ROOT, 'docs', 'handoff', 'V43_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT');
const ZIP_PATH = path.join(ROOT, 'docs', 'handoff', 'V43_HANDOFF_REQUIREMENT_V6_4_FINAL_ONE_CASE_RECERT.zip');
const sha256File = filePath => createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

async function main() {
  if (!fs.existsSync(HANDOFF_DIR)) throw new Error('HANDOFF_DIRECTORY_NOT_FOUND');
  const zip = new JSZip();
  function add(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = `${prefix}${name}`;
      if (fs.statSync(full).isDirectory()) add(full, `${rel}/`);
      else zip.file(rel, fs.readFileSync(full));
    }
  }
  add(HANDOFF_DIR);
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(ZIP_PATH, bytes);
  process.stdout.write(`${JSON.stringify({ zip_path: ZIP_PATH, zip_sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, decision_packet_sha256: sha256File(path.join(HANDOFF_DIR, '02_GPT_SEMANTIC_REVIEW_PACKET.json')), case_count: 1, evidence_file_count: fs.readdirSync(path.join(HANDOFF_DIR, 'evidence')).length })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main().catch(error => { process.stderr.write(`${error?.message || error}\n`); process.exitCode = 1; });
export { main };

