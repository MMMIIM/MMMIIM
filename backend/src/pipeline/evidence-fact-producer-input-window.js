import crypto from 'node:crypto';
import { resolveEnterpriseFactSourceUnits } from './enterprise-evidence-source-router.js';

export const EVIDENCE_FACT_PRODUCER_INPUT_WINDOW_VERSION = '4.3-evidence-fact-producer-input-window-v1';

const sha256 = value => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const text = value => typeof value === 'string' ? value : '';

/**
 * Build deterministic, heading-bounded producer inputs from one immutable
 * document snapshot. The source-role parser is the sole heading parser here;
 * no sibling heading body is ever joined into a window. Document metadata is
 * carried separately from the semantic body so it cannot become evidence.
 */
export function buildEvidenceFactProducerInputWindows({
  documentId = null,
  sourceText,
  sourceRef = null,
  sourceHash = null,
  metadata = {}
} = {}) {
  const documentText = text(sourceText);
  if (!documentText.trim()) throw new Error('sourceText is required');
  const documentHash = sourceHash || sha256(documentText);
  if (sourceHash && sourceHash !== documentHash) throw new Error('sourceHash does not match sourceText');
  const units = resolveEnterpriseFactSourceUnits(documentText);
  const documentMetadata = Object.freeze({
    ...metadata,
    ...(documentId ? { doc_id: documentId } : {}),
    ...(sourceRef ? { source_ref: sourceRef } : {}),
    source_hash: documentHash
  });
  return Object.freeze({
    version: EVIDENCE_FACT_PRODUCER_INPUT_WINDOW_VERSION,
    document: Object.freeze({
      doc_id: documentId,
      source_ref: sourceRef,
      source_hash: documentHash,
      metadata: documentMetadata
    }),
    windows: Object.freeze(units.map((unit, index) => {
      const headingPath = Object.freeze([...(unit.heading_path || [])]);
      const heading = headingPath.at(-1) || null;
      // Include the heading path as structural context, but only the current
      // unit body as semantic content. This is intentionally not a full source
      // document slice and never carries a sibling heading body.
      const producerSourceText = [headingPath.join(' / '), unit.text].filter(Boolean).join('\n');
      return Object.freeze({
        window_id: `${documentId || 'DOCUMENT'}-WINDOW-${String(index + 1).padStart(3, '0')}`,
        heading_path: headingPath,
        heading,
        heading_level: unit.heading_level ?? null,
        body: unit.text,
        producer_source_text: producerSourceText,
        producer_source_hash: sha256(producerSourceText),
        source_ref: sourceRef,
        document_source_hash: documentHash,
        document_metadata: documentMetadata
      });
    }))
  });
}
export function windowHasSiblingHeadingBody(window, allWindows = []) {
  if (!window || !Array.isArray(allWindows)) return false;
  const id = window.window_id;
  const body = text(window.producer_source_text);
  return allWindows.some(other => other && other.window_id !== id && text(other.body) && body.includes(text(other.body)));
}
