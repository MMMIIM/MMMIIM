import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { adaptHtmlToSourceText, describeHtmlAdapter, EVAL_ONLY_HTML_ADAPTER_VERSION } from '../eval/rag-governance/reference-eval-html-adapter.js';

test('Eval-only HTML adapter is deterministic and preserves visible substantive text', () => {
  const html = '<html><!--ignored--><head><style>.x{display:none}</style><script>alert(1)</script></head><body><h1>数据中心</h1><p>支持 &amp; 可靠性<br>99&#x25;</p><div>部署</div></body></html>';
  const first = adaptHtmlToSourceText(html);
  const second = adaptHtmlToSourceText(html);
  assert.equal(first, second);
  assert.match(first, /数据中心/);
  assert.match(first, /支持 & 可靠性/);
  assert.match(first, /99%/);
  assert.match(first, /部署/);
  assert.doesNotMatch(first, /alert|display:none|ignored/);
});

test('Eval-only HTML adapter adds no synthetic content and exposes byte/text lineage', () => {
  const raw = Buffer.from('<p>原始内容</p>', 'utf8');
  const text = adaptHtmlToSourceText(raw.toString('utf8'));
  const metadata = describeHtmlAdapter({ rawBytes: raw, text });
  assert.equal(metadata.adapter, 'EVAL_ONLY_HTML_INPUT_ADAPTER');
  assert.equal(metadata.adapter_version, EVAL_ONLY_HTML_ADAPTER_VERSION);
  assert.equal(metadata.source_byte_sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(metadata.synthetic_content_added, false);
  assert.equal(metadata.output_text_length, text.length);
});

test('empty HTML fails closed', () => {
  assert.throws(() => adaptHtmlToSourceText('<html><script>x</script></html>'), { code: 'HTML_VISIBLE_TEXT_EMPTY' });
});
