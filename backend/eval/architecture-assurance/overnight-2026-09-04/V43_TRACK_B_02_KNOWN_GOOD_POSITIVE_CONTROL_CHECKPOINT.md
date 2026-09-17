# V43 Track B — Known-Good Positive Controls

These three Tenders are the current Source Foundation positive controls. The rows below are read from the existing manifest, packets, source audit, adjudication artifact, and resolver logic; no artifact was regenerated.

| Tender | Raw source SHA (current = declared) | Packet | Packet SHA | Frozen Requirement count | Resolver discovery | Source audit |
|---|---|---|---|---:|---|---|
| FAST-01 | `8048485301cad27536c6f4a44e355c8ae05a5ded0ebb537ab9d6a61900d92c29` | `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-01.json` | `d4e1932bd7702e6d28582931ff24eb6d680c58f108eeda8d8705c44ebae170af` | 39 | found | source-clear rows |
| TB-006 | `b714d521220e367d1a762bc7de0fb7b007ef539105be9a0822af093f02793480` | `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/TB-006.json` | `0675bff49eefa129c0c4c07f17b4bc3040a155c4247d647eb26361215003f3ab` | 46 | found | source-clear rows |
| FAST-WATER-01 | `15f92c3a676269e296295b033da02bdfe448fe6de74d3ac3a98f3cfc9a419535` | `backend/eval/requirement-extraction-real-tender-pilot-v1/semantic-boundary-v1.1/packets/FAST-WATER-01.json` | `0d7561178ae7a16670608a2ac16d04c0f68687be7e3d1e26cfb460b6f4102310` | 114 | found | source-clear rows except the separately excluded ambiguous item |

## Positive-control trace

```text
raw PDF (census source_file + declared SHA)
  -> controlled packet source_extraction/windows/spans
  -> gold_requirements (gold_id/text/category/source_range/mandatory_observed/requires_confirmation)
  -> frozen source-audit identity (SOURCE_CLEAR for evaluable rows)
  -> frozen semantic-adjudication artifact
  -> manifest packet entry (packet path, source SHA, count/hash)
  -> Source Foundation resolver (packetIndex/spanIndex/sourceIdentity/requirementRecord)
```

For these positive controls, the resolver-visible parsed/Requirement boundary is the packet's `source_extraction`, `windows[].spans[]`, and `gold_requirements[]`. The resolver derives Eval Requirement identities from `tender_id:gold_id`; it does not require or invent a formal production `REQ-*` identifier in this source-foundation artifact.

The shared frozen adjudication identity currently used by the builder is:

`backend/eval/reports/reqx-v311-canonical-post-fix-certified-live/reqx-v311-canonical-post-fix-live-1788026179424-583a8c74/semantic-adjudication.json`  
SHA-256: `014601a3505f9a6648e4ec5eb28f00ed23365a36415b68a68fd8ac45dd96d78`  
Dataset: `reqx-v3-real-tender-gold-pilot-v1.1-semantic-boundary`  
Integrity: structural certified, gold provenance `199/199`, production eval parity `PASS`; certification remains blocked by the known critical omission and is not silently treated as a new promotion signal.

## Pattern conclusion

`KNOWN_GOOD_ARTIFACT_PATTERN = CONFIRMED_BY_CURRENT_RESOLVER` for packet path, packet schema, source hash, source spans, manifest linkage, and source-audit parity. Historical runner paths for other Tenders are not interchangeable with this packet pattern. No cross-Tender aliasing is allowed.

**Provider calls:** 0  
**Production DB writes:** 0  
**Gold mutations:** 0
