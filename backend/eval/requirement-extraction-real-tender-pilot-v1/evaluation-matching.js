import { createHash } from 'node:crypto';

function textHash(value) {
  return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

/**
 * Stable source identity for evaluation only.  Chunk-relative Cxxx-Sxxx
 * references are deliberately excluded: offsets are anchored to the frozen
 * extracted source, while the text hash provides a deterministic fallback
 * for spans that do not expose offsets.
 */
export function stableSourceProvenanceKey(span = {}) {
  const start = Number(span.source_start_offset);
  const end = Number(span.source_end_offset);
  if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start) {
    return `offset:${start}:${end}`;
  }
  const hash = typeof span.source_text_sha256 === 'string' && span.source_text_sha256
    ? span.source_text_sha256
    : textHash(span.text);
  return `text:${hash}:paragraph:${span.paragraph ?? ''}:page:${span.page ?? ''}`;
}

export function buildStableProvenanceIndex(spans = []) {
  const records = (Array.isArray(spans) ? spans : []).map((span, position) => ({
    key: stableSourceProvenanceKey(span),
    ref: span?.source_ref ?? span?.span_id ?? null,
    position,
    span
  }));
  const keyCounts = new Map();
  const refCounts = new Map();
  for (const record of records) {
    keyCounts.set(record.key, (keyCounts.get(record.key) || 0) + 1);
    if (record.ref) refCounts.set(record.ref, (refCounts.get(record.ref) || 0) + 1);
  }
  const ambiguousKeys = new Set([...keyCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  const ambiguousRefs = new Set([...refCounts.entries()].filter(([, count]) => count > 1).map(([ref]) => ref));
  return {
    records,
    ambiguousKeys,
    ambiguousRefs,
    byRef: new Map(records.filter((record) => record.ref && !ambiguousRefs.has(record.ref)).map((record) => [record.ref, record])),
    byKey: new Map(records.filter((record) => !ambiguousKeys.has(record.key)).map((record) => [record.key, record]))
  };
}

export function resolveStableRange(range, index) {
  if (!range || !index?.byRef) return null;
  if (index.ambiguousRefs?.has(range.start_ref) || index.ambiguousRefs?.has(range.end_ref)) return null;
  const start = index.byRef.get(range.start_ref);
  const end = index.byRef.get(range.end_ref);
  if (!start || !end || start.position > end.position) return null;
  if (index.ambiguousKeys?.has(start.key) || index.ambiguousKeys?.has(end.key)) return null;
  return {
    start_key: start.key,
    end_key: end.key,
    start_position: start.position,
    end_position: end.position
  };
}

function locationKey(span = {}) {
  return `${span.paragraph ?? ''}\u0000${String(span.text ?? '').normalize('NFKC').replace(/\s+/g, '').trim()}`;
}

function uniqueLocationMatches(spans = []) {
  const matches = new Map();
  for (const span of Array.isArray(spans) ? spans : []) {
    const key = locationKey(span);
    const values = matches.get(key) || [];
    values.push(span);
    matches.set(key, values);
  }
  return new Map([...matches.entries()]
    .filter(([, values]) => values.length === 1)
    .map(([key, values]) => [key, values[0]]));
}

/**
 * Project a historical Gold range onto the retained production source view.
 *
 * The historical packet and current parser may use different chunk-relative
 * refs and different absolute offsets.  We therefore resolve each historical
 * span through stable provenance (offsets when shared, otherwise a unique
 * paragraph/text location).  Spans present in the full current view but
 * intentionally excluded by the scope router are skipped; any other missing,
 * duplicated, or out-of-order mapping fails closed.
 */
export function projectStableRangeToRetained({
  range,
  historicalSpans = [],
  retainedSpans = [],
  allCurrentSpans = retainedSpans,
  isExcluded = () => false
} = {}) {
  const historicalIndex = buildStableProvenanceIndex(historicalSpans);
  const retainedIndex = buildStableProvenanceIndex(retainedSpans);
  const allCurrentIndex = buildStableProvenanceIndex(allCurrentSpans);
  const historicalRange = resolveStableRange(range, historicalIndex);
  if (!historicalRange) return null;
  const allCurrentByLocation = uniqueLocationMatches(allCurrentSpans);
  const historicalRecords = historicalIndex.records.slice(historicalRange.start_position, historicalRange.end_position + 1);
  const projected = [];
  let excludedCount = 0;
  for (const historicalRecord of historicalRecords) {
    let currentRecord = null;
    if (!allCurrentIndex.ambiguousKeys.has(historicalRecord.key)) {
      currentRecord = allCurrentIndex.byKey.get(historicalRecord.key) || null;
    }
    if (!currentRecord) {
      const locationMatch = allCurrentByLocation.get(locationKey(historicalRecord.span));
      if (locationMatch) {
        currentRecord = allCurrentIndex.records.find((record) => record.span === locationMatch) || null;
      }
    }
    if (!currentRecord || allCurrentIndex.ambiguousKeys.has(currentRecord.key)) return null;
    const retainedRecord = retainedIndex.byKey.get(currentRecord.key) || null;
    if (retainedRecord && !retainedIndex.ambiguousKeys.has(retainedRecord.key)) {
      projected.push(retainedRecord);
      continue;
    }
    if (isExcluded(currentRecord.span) === true) {
      excludedCount += 1;
      continue;
    }
    return null;
  }
  if (!projected.length) return null;
  for (let index = 1; index < projected.length; index += 1) {
    if (projected[index - 1].position >= projected[index].position) return null;
  }
  const start = projected[0];
  const end = projected.at(-1);
  return {
    start_key: start.key,
    end_key: end.key,
    start_ref: start.ref,
    end_ref: end.ref,
    start_position: start.position,
    end_position: end.position,
    excluded_count: excludedCount
  };
}

/** Precision is intentionally based on the same candidate-level denominator
 * represented by TP candidates plus automatically classified FP candidates.
 * Manual-review candidates remain outside the automatic score denominator. */
export function calculateEvaluationPrecision({ tp_candidate_count = 0, false_positive_count = 0 } = {}) {
  const tp = Number.isFinite(tp_candidate_count) ? Math.max(0, tp_candidate_count) : 0;
  const fp = Number.isFinite(false_positive_count) ? Math.max(0, false_positive_count) : 0;
  const denominator = tp + fp;
  return denominator ? tp / denominator : 1;
}
