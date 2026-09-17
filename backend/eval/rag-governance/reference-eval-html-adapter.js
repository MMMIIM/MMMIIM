import { createHash } from 'node:crypto';

export const EVAL_ONLY_HTML_ADAPTER_VERSION = 'eval-only-html-adapter-v1';

const sha256 = value => createHash('sha256').update(value).digest('hex');

const NAMED_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
});

function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/giu, (whole, token) => {
    const lower = token.toLowerCase();
    if (lower.startsWith('#x')) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole;
    }
    if (lower.startsWith('#')) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole;
    }
    return NAMED_ENTITIES[lower] ?? whole;
  });
}

/**
 * Deterministically converts a frozen HTML snapshot to visible source text.
 * This is intentionally an input adapter only; it does not summarize,
 * enrich, or infer content. Production normalization/chunking remains owned
 * by tender-text-extractor and enterprise-material-chunker.
 */
export function adaptHtmlToSourceText(html) {
  const input = String(html ?? '');
  const withoutComments = input.replace(/<!--[\s\S]*?-->/g, '');
  const withoutNonContent = withoutComments.replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '');
  const withBreaks = withoutNonContent
    .replace(/<\s*br\s*\/?>/giu, '\n')
    .replace(/<\s*\/??\s*(?:p|div|section|article|header|footer|main|aside|li|tr|table|h[1-6]|pre|blockquote)\b[^>]*>/giu, '\n');
  const visible = withBreaks.replace(/<[^>]*>/g, ' ');
  const decoded = decodeEntities(visible)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!decoded) throw Object.assign(new Error('HTML snapshot contains no visible source text.'), { code: 'HTML_VISIBLE_TEXT_EMPTY' });
  return decoded;
}

export function describeHtmlAdapter({ rawBytes, text }) {
  const bytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes ?? '');
  const normalized = String(text ?? '');
  return Object.freeze({
    adapter: 'EVAL_ONLY_HTML_INPUT_ADAPTER',
    adapter_version: EVAL_ONLY_HTML_ADAPTER_VERSION,
    source_byte_sha256: sha256(bytes),
    output_text_sha256: sha256(normalized),
    output_text_length: normalized.length,
    synthetic_content_added: false,
    production_upload_fidelity: 'NOT_CLAIMED',
    reference_fidelity: 'PARTIAL_EVAL_ADAPTER'
  });
}

export { sha256 };
