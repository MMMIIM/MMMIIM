# H3C_PUBLIC_REAL_ENTERPRISE_PACK_V1 — Codex Handoff

这个包不是 Fact Gold，也不包含任何招标需求反向构造的数据。

用途：
1. 让 Codex 从新华三官方域名直接下载/冻结公开企业资料；
2. 生成 source manifest、SHA256、下载报告、重复报告；
3. 作为 Real Fact V2 的真实公开企业 Source Authority Foundation；
4. 与现有 DEMO-ENTERPRISE-A synthetic corpus 严格隔离。

## 为什么不把网页/PDF原文直接二次打包进这个 ZIP
原始材料应由 Codex 从官方 H3C URL 直接落盘，以保留：
- canonical_url / resolved_url
- retrieved_at
- HTTP metadata
- raw bytes SHA256
- 官方来源链

运行：
```bash
python tools/download_h3c_public_sources.py   --manifest docs/handoff/H3C_PUBLIC_REAL_ENTERPRISE_PACK_V1/01_SOURCE_MANIFEST.json   --output data/eval/h3c-public-real-v1
```

下载完成后，不要直接开始 Fact extraction。
先输出 Source Authority Snapshot，交 GPT 做 source foundation adjudication。
