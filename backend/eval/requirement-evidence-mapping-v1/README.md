# Requirement Evidence Mapping V1 Gold

`gold-cases.json` is a human-authored, static offline contract/evaluation
fixture. It contains 36 cases covering the Mapping Producer V1.1 decision,
dimension, upstream-authority, currentness, batching, and human-override
boundaries. It is not generated from model output and is not a Provider quality
result. A future live evaluation may consume the same cases only after the
explicit Provider authorization and runtime preflight required by the project.

The expected transport decisions are intentionally kept separate from the
canonical Mapping projection. `not_applicable` means a Requirement dimension
does not apply; `unknown` means the applicable dimension cannot be established
from the provided Fact. `upstream_support_level` and `existing_mapping` are
Backend-policy fixtures and are never sent to the Mapping Semantic Worker.
