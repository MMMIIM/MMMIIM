import { AppError } from '../errors.js';

export const SECTION_MARKER_VERSION = 'writer-section-markers-v1';
const fail = message => { throw new AppError('WRITER_SECTION_MARKER_INVALID', message, 422); };

export function renderSectionMarkers(sections = []) {
  return sections.map(({ section_id, content }) => `<<<SECTION:${section_id}>>>\n${String(content || '').trim()}\n<<<END_SECTION>>>`).join('\n\n');
}

export function parseSectionMarkers(text, expectedSectionIds = []) {
  const expected = new Set(expectedSectionIds);
  const result = {};
  const pattern = /<<<SECTION:([^>]+)>>>\s*([\s\S]*?)\s*<<<END_SECTION>>>/g;
  let match;
  while ((match = pattern.exec(String(text || '')))) {
    const id = match[1].trim();
    if (!expected.has(id) || Object.hasOwn(result, id) || !match[2].trim()) fail('Section marker 缺失、重复或未授权。');
    result[id] = match[2].trim();
  }
  if (Object.keys(result).length !== expected.size || [...expected].some(id => !Object.hasOwn(result, id))) fail('Writer Batch 未完整返回所有 Section。');
  const remainder = String(text || '').replace(pattern, '').trim();
  if (remainder) fail('Writer 输出包含未标记正文。');
  return result;
}
