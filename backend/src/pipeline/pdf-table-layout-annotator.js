import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const COORDINATE_TOLERANCE = 1.5;
const MIN_EDGE_LENGTH = 20;
const MIN_TABLE_WIDTH = 100;
const MIN_TABLE_COLUMNS = 4;
const MAX_CONTINUATION_PARAGRAPH_GAP = 8;

function number(value, fallback = null) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function rounded(value) {
  return Math.round(Number(value) * 10) / 10;
}

export function normalizeLayoutText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function compactLayoutText(value) {
  return normalizeLayoutText(value).replace(/\s/g, '');
}

function cloneMatrix(matrix) {
  return Array.from(matrix || [1, 0, 0, 1, 0, 0]);
}

function transformPoint(point, matrix) {
  const result = [Number(point[0]), Number(point[1])];
  pdfjs.Util.applyTransform(result, matrix);
  return result;
}

function edgeFromPoints(p1, p2, sourceOperatorIndex) {
  const width = Math.abs(p2[0] - p1[0]);
  const height = Math.abs(p2[1] - p1[1]);
  if (width >= MIN_EDGE_LENGTH && height <= COORDINATE_TOLERANCE) {
    return {
      orientation: 'h', x1: Math.min(p1[0], p2[0]), y1: (p1[1] + p2[1]) / 2,
      x2: Math.max(p1[0], p2[0]), y2: (p1[1] + p2[1]) / 2,
      source_operator_index: sourceOperatorIndex
    };
  }
  if (height >= MIN_EDGE_LENGTH && width <= COORDINATE_TOLERANCE) {
    return {
      orientation: 'v', x1: (p1[0] + p2[0]) / 2, y1: Math.min(p1[1], p2[1]),
      x2: (p1[0] + p2[0]) / 2, y2: Math.max(p1[1], p2[1]),
      source_operator_index: sourceOperatorIndex
    };
  }
  return null;
}

function collectPageEdges(page, viewport, operatorList) {
  const edges = [];
  let transformMatrix = [1, 0, 0, 1, 0, 0];
  const transformStack = [];
  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index];
    if (fn === pdfjs.OPS.save) {
      transformStack.push(cloneMatrix(transformMatrix));
      continue;
    }
    if (fn === pdfjs.OPS.restore) {
      transformMatrix = transformStack.pop() || transformMatrix;
      continue;
    }
    if (fn === pdfjs.OPS.transform) {
      transformMatrix = pdfjs.Util.transform(transformMatrix, args || []);
      continue;
    }
    if (fn !== pdfjs.OPS.constructPath || args?.[0] !== pdfjs.OPS.stroke || !args?.[2]) continue;
    const minMax = Array.from(args[2]);
    if (minMax.length < 4 || minMax.some((value) => !Number.isFinite(Number(value)))) continue;
    const matrix = pdfjs.Util.transform(viewport.transform, transformMatrix);
    const p1 = transformPoint([minMax[0], minMax[1]], matrix);
    const p2 = transformPoint([minMax[2], minMax[3]], matrix);
    const direct = edgeFromPoints(p1, p2, index);
    if (direct) {
      edges.push(direct);
      continue;
    }
    const width = Math.abs(p2[0] - p1[0]);
    const height = Math.abs(p2[1] - p1[1]);
    if (width < MIN_EDGE_LENGTH || height < MIN_EDGE_LENGTH) continue;
    const corners = [
      [p1[0], p1[1]], [p2[0], p1[1]], [p2[0], p2[1]], [p1[0], p2[1]]
    ];
    for (let corner = 0; corner < corners.length; corner += 1) {
      const next = corners[(corner + 1) % corners.length];
      const edge = edgeFromPoints(corners[corner], next, index);
      if (edge) edges.push(edge);
    }
  }
  return edges.map((edge) => ({
    ...edge,
    x1: rounded(edge.x1), y1: rounded(edge.y1),
    x2: rounded(edge.x2), y2: rounded(edge.y2)
  }));
}

function textItemFromPdf(item, page, order, pageHeight) {
  const transform = Array.isArray(item.transform) || ArrayBuffer.isView(item.transform)
    ? Array.from(item.transform) : null;
  if (!transform || transform.length < 6 || !String(item.str || '').trim()) return null;
  const x = number(transform[4], 0);
  const baselineY = number(transform[5], 0);
  const width = Math.max(0, number(item.width, 0));
  const height = Math.max(0, number(item.height, Math.abs(transform[3]) || 0));
  const bottom = pageHeight - baselineY;
  const top = bottom - height;
  return {
    page,
    text: String(item.str),
    x: rounded(x), y: rounded(top), width: rounded(width), height: rounded(height),
    bbox: { x: rounded(x), y: rounded(top), width: rounded(width), height: rounded(height) },
    order
  };
}

/**
 * Collects auxiliary pdfjs layout data. The canonical text extractor remains
 * the source of paragraphs, offsets and source refs; this function never
 * creates or rewrites those values.
 */
export async function collectPdfLayout(buffer, { pages = null } = {}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    throw new TypeError('PDF layout collection requires binary data.');
  }
  const requested = Array.isArray(pages) && pages.length
    ? new Set(pages.map((page) => Number(page)).filter((page) => Number.isInteger(page) && page > 0))
    : null;
  const loadingTask = pdfjs.getDocument({
    data: Uint8Array.from(buffer), verbosity: 0, useSystemFonts: true, isEvalSupported: false
  });
  const document = await loadingTask.promise;
  const result = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (requested && !requested.has(pageNumber)) continue;
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const textItems = textContent.items
        .map((item, order) => textItemFromPdf(item, pageNumber, order, viewport.height))
        .filter(Boolean);
      const operatorList = await page.getOperatorList();
      result.push({
        page: pageNumber,
        width: rounded(viewport.width), height: rounded(viewport.height),
        text_items: textItems,
        edges: collectPageEdges(page, viewport, operatorList)
      });
      await page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return { pages: result };
}

function clusterByCoordinate(values, coordinate) {
  const sorted = [...values].sort((left, right) => left[coordinate] - right[coordinate]);
  const clusters = [];
  for (const value of sorted) {
    const existing = clusters.at(-1);
    if (!existing || Math.abs(existing.coordinate - value[coordinate]) > COORDINATE_TOLERANCE) {
      clusters.push({ coordinate: value[coordinate], values: [value] });
    } else {
      existing.values.push(value);
      existing.coordinate = existing.values.reduce((sum, item) => sum + item[coordinate], 0) / existing.values.length;
    }
  }
  return clusters;
}

function mergeRanges(values, start, end) {
  const ranges = [...values]
    .map((value) => ({ start: Math.min(value[start], value[end]), end: Math.max(value[start], value[end]) }))
    .sort((left, right) => left.start - right.start);
  const merged = [];
  for (const range of ranges) {
    const existing = merged.at(-1);
    if (!existing || range.start > existing.end + COORDINATE_TOLERANCE) merged.push(range);
    else existing.end = Math.max(existing.end, range.end);
  }
  return merged;
}

function gridRegion(page) {
  const horizontal = clusterByCoordinate(
    (page.edges || []).filter((edge) => edge.orientation === 'h' && Math.abs(edge.x2 - edge.x1) >= MIN_TABLE_WIDTH),
    'y1'
  ).map((cluster) => ({
    y: cluster.coordinate,
    left: Math.min(...cluster.values.map((edge) => edge.x1)),
    right: Math.max(...cluster.values.map((edge) => edge.x2))
  }));
  const vertical = clusterByCoordinate(
    (page.edges || []).filter((edge) => edge.orientation === 'v' && Math.abs(edge.y2 - edge.y1) >= MIN_EDGE_LENGTH),
    'x1'
  ).map((cluster) => ({
    x: cluster.coordinate,
    ranges: mergeRanges(cluster.values, 'y1', 'y2')
  }));
  if (horizontal.length < 2 || vertical.length < MIN_TABLE_COLUMNS) return null;
  let best = null;
  for (let start = 0; start < horizontal.length - 1; start += 1) {
    for (let end = start + 1; end < horizontal.length; end += 1) {
      const top = horizontal[start].y;
      const bottom = horizontal[end].y;
      const left = Math.max(horizontal[start].left, horizontal[end].left);
      const right = Math.min(horizontal[start].right, horizontal[end].right);
      if (right - left < MIN_TABLE_WIDTH) continue;
      const columns = vertical.filter((line) => line.x >= left - COORDINATE_TOLERANCE
        && line.x <= right + COORDINATE_TOLERANCE
        && line.ranges.some((range) => range.start <= top + COORDINATE_TOLERANCE
          && range.end >= bottom - Math.max(COORDINATE_TOLERANCE, Math.min(20, (bottom - top) * 0.35))));
      if (columns.length < MIN_TABLE_COLUMNS) continue;
      const rowLines = horizontal.filter((line) => line.y >= top - COORDINATE_TOLERANCE
        && line.y <= bottom + COORDINATE_TOLERANCE
        && line.right >= left - COORDINATE_TOLERANCE
        && line.left <= right + COORDINATE_TOLERANCE);
      const rowCount = Math.max(1, rowLines.length - 1);
      const score = (columns.length ** 2 * rowCount ** 2) / Math.max(1, bottom - top);
      if (!best || score > best.score) best = { top, bottom, left, right, columns, score };
    }
  }
  if (!best) return null;
  const rowLines = horizontal
    .filter((line) => line.y >= best.top - COORDINATE_TOLERANCE && line.y <= best.bottom + COORDINATE_TOLERANCE
      && line.right >= best.left - COORDINATE_TOLERANCE && line.left <= best.right + COORDINATE_TOLERANCE)
    .sort((left, right) => left.y - right.y);
  return { ...best, row_lines: rowLines };
}

function itemCenter(item) {
  const box = item.bbox || item;
  return {
    x: Number(box.x) + Number(box.width || 0) / 2,
    y: Number(box.y) + Number(box.height || 0) / 2
  };
}

function itemBox(item) {
  const box = item.bbox || item;
  return {
    x: Number(box.x) || 0,
    y: Number(box.y) || 0,
    width: Number(box.width) || 0,
    height: Number(box.height) || 0
  };
}

function cellIndex(centerX, columns) {
  const lastCell = Math.max(0, columns.length - 2);
  for (let index = 0; index <= lastCell; index += 1) {
    const left = columns[index].x - COORDINATE_TOLERANCE;
    const right = columns[index + 1].x + COORDINATE_TOLERANCE;
    if (centerX >= left && centerX < right) return index;
  }
  return centerX < columns[0].x ? 0 : lastCell;
}

function mapItemsToParagraphs(items, paragraphs) {
  const ordered = [...paragraphs].sort((left, right) => Number(left.paragraph || 0) - Number(right.paragraph || 0));
  const mapped = [];
  let cursor = 0;
  for (const item of [...items].sort((left, right) => left.order - right.order)) {
    const compact = compactLayoutText(item.text);
    if (!compact) continue;
    const selectCandidate = (start, end) => {
      const candidates = [];
      for (let index = start; index < end; index += 1) {
        const paragraphText = compactLayoutText(ordered[index].text);
        if (paragraphText.includes(compact)) {
          candidates.push({ index, exact: paragraphText === compact, length: paragraphText.length });
        }
      }
      const exact = candidates.filter((candidate) => candidate.exact);
      if (exact.length === 1) return exact[0].index;
      if (exact.length > 1) return -1;
      if (candidates.length === 1) return candidates[0].index;
      if (candidates.length === 0) return -1;
      // A short layout token such as "≦" or a common unit is not a safe
      // alignment key when it occurs in several paragraphs.  Only accept a
      // clearly shortest containing paragraph; otherwise fail closed.
      candidates.sort((left, right) => left.length - right.length || left.index - right.index);
      const shortest = candidates[0];
      const second = candidates[1];
      return second && second.length - shortest.length >= Math.max(8, compact.length * 2)
        ? shortest.index : -1;
    };
    let found = selectCandidate(cursor, ordered.length);
    if (found < 0) continue;
    cursor = Math.max(cursor, found);
    mapped.push({ item, paragraph: ordered[found] });
  }
  return mapped;
}

function headerLike(row) {
  const text = compactLayoutText(row.cells.map((cell) => cell.display_text).join(''));
  const labels = [
    '故障分级', '问题描述', '响应时间', '处理时间', '解决时间', '序号', '项目名称', '服务内容',
    '服务类别', '服务子类', '服务项', '计价单位', '报价单位', '数量', '期限', '规格', '参数', '单位'
  ];
  return labels.filter((label) => text.includes(label)).length >= 2;
}

function rowForBand({ page, region, rowIndex, top, bottom, paragraphs, tableId }) {
  const items = (page.text_items || []).filter((item) => {
    const center = itemCenter(item);
    return center.x > region.left + COORDINATE_TOLERANCE
      && center.x < region.right - COORDINATE_TOLERANCE
      && center.y > top + COORDINATE_TOLERANCE
      && center.y < bottom - COORDINATE_TOLERANCE;
  });
  if (!items.length) return null;
  const mapped = mapItemsToParagraphs(items, paragraphs);
  const mappedByItem = new Map(mapped.map(({ item, paragraph }) => [item, paragraph]));
  const mappedParagraphs = [...new Set(mapped.map(({ paragraph }) => paragraph))]
    .filter((value) => Number.isInteger(value.paragraph)).sort((left, right) => left.paragraph - right.paragraph);
  if (!mappedParagraphs.length) return null;
  const firstMapped = mappedParagraphs[0].paragraph;
  const lastMapped = mappedParagraphs.at(-1).paragraph;
  const paragraphNumbers = resolveParagraphRange(paragraphs, firstMapped, lastMapped, items);
  if (!paragraphNumbers.length) return null;
  const cells = Array.from({ length: region.columns.length - 1 }, (_, columnIndex) => ({
    column_index: columnIndex, display_text: '', source_refs: [], bbox: null
  }));
  for (const item of items) {
    const paragraph = mappedByItem.get(item);
    const center = itemCenter(item);
    const column = cellIndex(center.x, region.columns);
    const cell = cells[column];
    cell.display_text += String(item.text);
    cell.source_refs.push(...(paragraph?.source_ref ? [paragraph.source_ref] : []));
    const currentBox = itemBox(item);
    if (!cell.bbox) cell.bbox = currentBox;
    else {
      const right = Math.max(cell.bbox.x + cell.bbox.width, currentBox.x + currentBox.width);
      const bottomEdge = Math.max(cell.bbox.y + cell.bbox.height, currentBox.y + currentBox.height);
      cell.bbox = {
        x: Math.min(cell.bbox.x, currentBox.x), y: Math.min(cell.bbox.y, currentBox.y),
        width: right - Math.min(cell.bbox.x, currentBox.x),
        height: bottomEdge - Math.min(cell.bbox.y, currentBox.y)
      };
    }
  }
  for (const cell of cells) {
    cell.source_refs = [...new Set(cell.source_refs)];
  }
  const row = {
    row_id: `${tableId}-r${rowIndex + 1}`,
    table_id: tableId,
    pages: [page.page],
    paragraph_numbers: paragraphNumbers,
    source_refs: [...new Set(mapped.map(({ paragraph }) => paragraph.source_ref).filter(Boolean))],
    cells,
    confidence: 'GRID_CONFIRMED',
    column_boundaries: region.columns.map((column) => rounded(column.x)),
    top: rounded(top), bottom: rounded(bottom)
  };
  return headerLike(row) ? { header: true, row } : { header: false, row };
}

function orderedParagraphRange(paragraphs, first, last) {
  return [...paragraphs]
    .map((paragraph) => Number(paragraph.paragraph))
    .filter((paragraph) => Number.isInteger(paragraph) && paragraph >= first && paragraph <= last)
    .sort((left, right) => left - right);
}

function resolveParagraphRange(paragraphs, first, last, items) {
  const ordered = [...paragraphs].sort((left, right) => Number(left.paragraph) - Number(right.paragraph));
  let currentLast = last;
  for (const item of items) {
    const token = compactLayoutText(item.text);
    if (!token) continue;
    const rangeText = ordered
      .filter((paragraph) => Number(paragraph.paragraph) >= first && Number(paragraph.paragraph) <= currentLast)
      .map((paragraph) => compactLayoutText(paragraph.text)).join('');
    if (rangeText.includes(token)) continue;
    const extension = ordered.find((paragraph) => Number(paragraph.paragraph) > currentLast
      && Number(paragraph.paragraph) <= currentLast + MAX_CONTINUATION_PARAGRAPH_GAP
      && compactLayoutText(paragraph.text).includes(token));
    if (!extension) return [];
    currentLast = Number(extension.paragraph);
  }
  return orderedParagraphRange(paragraphs, first, currentLast);
}

function compatibleContinuation(previous, next) {
  if (!previous || !next || next.pages[0] !== previous.pages.at(-1) + 1) return false;
  if (previous.column_boundaries.length !== next.column_boundaries.length) return false;
  if (previous.column_boundaries.some((value, index) => Math.abs(value - next.column_boundaries[index]) > 2)) return false;
  const firstCell = next.cells[0]?.display_text || '';
  if (firstCell.trim()) return false;
  const previousEnd = previous.paragraph_numbers.at(-1);
  const nextStart = next.paragraph_numbers[0];
  // PDF page counters and other deterministic decorations can occupy a few
  // canonical paragraphs between a row's final line and its next-page tail.
  return Number.isInteger(previousEnd) && Number.isInteger(nextStart)
    && nextStart <= previousEnd + MAX_CONTINUATION_PARAGRAPH_GAP;
}

function mergeContinuation(previous, next) {
  const mergedCells = previous.cells.map((cell, index) => ({
    ...cell,
    display_text: `${cell.display_text}${next.cells[index]?.display_text || ''}`,
    source_refs: [...new Set([...(cell.source_refs || []), ...(next.cells[index]?.source_refs || [])])]
  }));
  return {
    ...previous,
    pages: [...previous.pages, ...next.pages],
    paragraph_numbers: [...new Set([...previous.paragraph_numbers, ...next.paragraph_numbers])].sort((a, b) => a - b),
    source_refs: [...new Set([...(previous.source_refs || []), ...(next.source_refs || [])])],
    cells: mergedCells,
    bottom: next.bottom
  };
}

/**
 * Detect conservative grid/text rows and map them to existing paragraph
 * numbers. Rows without a unique monotonic source alignment are omitted or
 * marked ambiguous; they never create provenance.
 */
export function annotatePdfTableLayout({ paragraphs = [], layout = { pages: [] } } = {}) {
  const byPage = new Map();
  for (const paragraph of paragraphs) {
    const page = Number(paragraph.page);
    if (!Number.isInteger(page)) continue;
    const list = byPage.get(page) || [];
    list.push(paragraph);
    byPage.set(page, list);
  }
  const rows = [];
  const headers = [];
  let ambiguousRows = 0;
  for (const page of layout.pages || []) {
    const region = gridRegion(page);
    if (!region || region.row_lines.length < 2) continue;
    const pageParagraphs = byPage.get(Number(page.page)) || [];
    const tableId = `p${page.page}-t${rounded(region.left)}-${rounded(region.right)}`;
    for (let index = 0; index < region.row_lines.length - 1; index += 1) {
      const outcome = rowForBand({
        page, region, rowIndex: index, top: region.row_lines[index].y,
        bottom: region.row_lines[index + 1].y, paragraphs: pageParagraphs, tableId
      });
      if (!outcome) continue;
      if (outcome.header) {
        headers.push(outcome.row);
        continue;
      }
      if (outcome.row.confidence === 'AMBIGUOUS') ambiguousRows += 1;
      else rows.push(outcome.row);
    }
  }
  rows.sort((left, right) => {
    const leftParagraph = left.paragraph_numbers[0] ?? Number.MAX_SAFE_INTEGER;
    const rightParagraph = right.paragraph_numbers[0] ?? Number.MAX_SAFE_INTEGER;
    return leftParagraph - rightParagraph;
  });
  const merged = [];
  for (const row of rows) {
    const previous = merged.at(-1);
    if (compatibleContinuation(previous, row)) merged[merged.length - 1] = mergeContinuation(previous, row);
    else merged.push(row);
  }
  return { rows: merged, headers, ambiguous_rows: ambiguousRows };
}

/**
 * Add only the compact metadata consumed by the existing chunker. No layout
 * coordinates or synthetic IDs are persisted and no source refs are created.
 */
export function applyTableAnnotationsToParagraphs(paragraphs = [], rows = [], headers = []) {
  const byParagraph = new Map();
  const headerByTable = new Map();
  for (const header of headers) {
    if (!header?.table_id) continue;
    const headerCells = (header.cells || []).map((cell) => normalizeLayoutText(cell?.display_text));
    const headerContext = headerCells.filter(Boolean).join(' | ');
    if (headerContext) headerByTable.set(header.table_id, { headerContext, headerCells });
  }
  for (const row of rows) {
    if (!['GRID_CONFIRMED', 'GRID_TEXT_CONFIRMED'].includes(row.confidence)) continue;
    for (const paragraphNumber of row.paragraph_numbers || []) {
      byParagraph.set(paragraphNumber, row);
    }
  }
  return paragraphs.map((paragraph) => {
    const row = byParagraph.get(paragraph.paragraph);
    if (!row) return paragraph;
    const header = headerByTable.get(row.table_id);
    return {
      ...paragraph,
      table: {
        semantic_unit_type: 'TABLE_ROW',
        id: row.table_id,
        row_id: row.row_id,
        header_context: header?.headerContext || null,
        header_cells: header?.headerCells || null,
        cells: row.cells.map((cell) => cell.display_text)
      }
    };
  });
}

/**
 * Decorate already-built chunks without re-running the chunker.  Keeping the
 * original chunk boundaries, offsets and Cxxx-Sxxx refs is a hard provenance
 * invariant; only the in-memory semantic-unit metadata is overlaid.
 */
export function applyTableAnnotationsToChunks(chunks = [], paragraphs = []) {
  const tableByParagraph = new Map();
  for (const paragraph of paragraphs) {
    if (paragraph?.table?.semantic_unit_type !== 'TABLE_ROW') continue;
    tableByParagraph.set(paragraph.paragraph, paragraph.table);
  }
  return chunks.map((chunk) => {
    const segments = (chunk.segments || []).map((segment) => {
      const table = tableByParagraph.get(segment.paragraph);
      return table ? {
        ...segment,
        semantic_unit_type: 'TABLE_ROW',
        table_id: table.id,
        table_row_id: table.row_id,
        table_header_context: table.header_context,
        table_header_cells: table.header_cells,
        table_cells: table.cells
      } : segment;
    });
    const presentedRows = new Set();
    const modelText = segments.map((segment) => {
      const table = segment.semantic_unit_type === 'TABLE_ROW' ? segment : null;
      let tableContext = '';
      if (table && !presentedRows.has(table.table_row_id)) {
        presentedRows.add(table.table_row_id);
        const cells = (table.table_cells || []).map((value, index) => {
          const cell = normalizeLayoutText(value);
          const header = normalizeLayoutText(table.table_header_cells?.[index]);
          return cell ? (header ? `${header}=${cell}` : cell) : '';
        }).filter(Boolean).join(' | ');
        tableContext = cells ? ` 表格行：${cells}` : '';
      }
      const header = segment.table_header_context ? ` 表头：${segment.table_header_context}` : '';
      return `[${segment.source_ref}]${header}${tableContext} ${segment.text}`;
    }).join('\n');
    const tableUnits = segments.filter((segment) => segment.semantic_unit_type === 'TABLE_ROW').map((segment) => ({
      table_id: segment.table_id,
      row_id: segment.table_row_id,
      header_context: segment.table_header_context,
      source_ref: segment.source_ref,
      source_text: segment.text,
      cells: segment.table_cells,
      header_cells: segment.table_header_cells || null
    }));
    return { ...chunk, segments, model_text: modelText, table_units: tableUnits };
  });
}
