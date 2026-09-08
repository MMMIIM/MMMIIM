# Bid Pilot

> A production-shaped AI workflow for enterprise bid response generation.

Bid Pilot explores a practical product question:

**How can an LLM participate in professional document production without losing factual grounding, traceability, control, or evaluation?**

The project started as a lightweight Dify-backed MVP and has been evolving toward a more explicit product architecture: LLMs handle semantic judgment, while deterministic backend services own state, contracts, validation, audit, and release decisions.

> **Status:** active personal product project. `main` preserves a stable public baseline; newer v4.3 capabilities are developed and verified across feature branches before being consolidated.

## Product Workflow

```text
Tender Document
      ↓
Requirement Extraction
      ↓
Canonical Requirements
      ↓
Enterprise Evidence Retrieval
      ↓
Requirement–Evidence Mapping
      ↓
Claim Gate
      ↓
Response Planning
      ↓
Section Generation
      ↓
Validation & Risk Review
      ↓
Document Output
```

The product is intentionally decomposed into explicit business objects and states instead of relying on one long prompt or a single opaque generation step.

## Product Principles

### 1. LLMs handle semantics; backend owns deterministic control

LLMs are used where semantic interpretation is necessary: understanding requirements, matching evidence, drafting claims, and generating content.

Deterministic responsibilities such as state transitions, output contracts, validation rules, audit records, retry boundaries, and final release decisions belong in backend services.

This separation is meant to make failures observable and recoverable instead of hiding them inside a long workflow.

### 2. Evidence before generation

The system models **what the tender asks** separately from **what the enterprise can actually prove**.

A generated claim should only enter downstream drafting when it is supported by approved evidence. This is the purpose of Requirement–Evidence Mapping and Claim Gate.

### 3. Provenance is a product capability

Requirements, evidence, mappings, claims, and generated sections retain source relationships so that unsupported content can be traced back to the first broken boundary.

Current v4.3 work uses concepts such as source references, source text/hash checks, Material Chunks, Evidence Facts, and approval state to preserve factual lineage.

### 4. Evaluation is part of the product lifecycle

Prompt changes, retrieval changes, schema changes, and pipeline changes are evaluated against frozen Gold / Regression suites instead of being judged only by subjective output review.

Evaluation focuses on identifying the **first failing layer** rather than only scoring the final document.

## Why the architecture evolved

The early prototype used a large Dify workflow. Real testing exposed several recurring failure modes:

- long-context omissions;
- unstable node-to-node output contracts;
- deterministic rules duplicated across workflow nodes;
- revision steps reintroducing content that had already been rejected;
- difficult failure attribution when one upstream boundary silently drifted.

That led to a product reliability decision:

```text
LLM Workflow / Provider
        ↓
semantic model calls

Backend Pipeline
        ↓
state
contracts
rules
validation
audit
retry / recovery boundaries
final output
```

The architecture change is therefore not about preferring one framework over another. It is about making a professional AI workflow easier to control, test, diagnose, and recover.

## Core Product Areas

### Requirement Extraction

Tender documents are parsed into candidate requirements, then normalized into a canonical contract with stable identity, source references, mandatory/confirmation state, risk flags, and deduplication.

### Enterprise Evidence / RAG

Enterprise materials are retrieved and normalized into evidence that can be independently evaluated before it is allowed to support a claim.

The key product boundary is:

```text
Tender Requirement
        ≠
Enterprise Evidence
        ↓
explicit mapping
        ↓
Approved Claim
```

### Claim Gate

Claim Gate prevents unsupported quantitative commitments, third-party modification promises, fixed SLA statements, or other risky assertions from silently entering generation.

### Generation Pipeline

The v4.3 backend direction uses an explicit state machine so that failed stages can be located and retried without replaying unrelated work.

A representative pipeline is:

```text
created
  → canonicalized
  → planned
  → claims_gated
  → drafted
  → sanitized
  → validated
  → finalized

any unrecoverable stage → failed
```

### Evaluation & Regression

Evaluation covers multiple layers of the system, including:

- requirement recall / precision;
- source verification and duplicate detection;
- retrieval relevance;
- evidence support;
- provenance integrity;
- provider reachability;
- production / evaluation parity;
- regression gates.

At one frozen Requirement evaluation checkpoint:

| Metric | Result |
| --- | ---: |
| Recall | 100% |
| Precision | 100% |
| Source Verified | 100% |
| Duplicate Rate | 0 |

These are **offline benchmark results from a frozen test set**, not production business KPIs.

## Reliability & Auditability

The product direction treats failed runs and unsupported outputs as first-class product states.

Important audit data includes:

- generation / run identity;
- input and requirement snapshots;
- approved-claim snapshots;
- provider request / raw response;
- validation errors;
- token / latency metadata;
- final output and revision history.

The goal is not simply to generate a document, but to make it possible to answer:

**What happened? Which boundary failed first? What evidence supported this claim? Can only the affected stage be rerun?**

## Repository Structure

The public repository contains a React + Vite frontend and a Node.js / Express backend. The project has evolved from a simple Dify-connected MVP toward PostgreSQL-backed product workflows and explicit AI-system boundaries.

```text
Bid-Pilot/
├── frontend/        # React + Vite product UI
├── backend/         # API, pipeline and persistence logic
├── package.json
└── README.md
```

Development branches currently include work around backend pipeline orchestration, production-shaped beta flows, requirement extraction resilience, semantic boundaries, gateway clients, and tender parse confirmation.

## Local Setup

The exact setup depends on the branch being evaluated. For the public baseline on `main`:

```bash
npm install
cp backend/.env.example backend/.env
npm run dev
```

Never commit real credentials. Dify / provider keys are read from backend environment variables only.

Newer v4.3 branches may additionally require PostgreSQL and database migrations.

## What this repository is for

Bid Pilot is primarily a **product + engineering practice project** for exploring production-oriented AI design:

- professional workflow decomposition;
- LLM / deterministic-system boundaries;
- RAG and factual grounding;
- evidence provenance;
- evaluation and release gates;
- failure attribution and recovery;
- human review and auditability.

It is not presented as a commercial production deployment.

## Related Open-Source Work

I also maintain [`ai-agent-skills`](https://github.com/MMMIIM/ai-agent-skills), a small library of reusable Agent Skills for AI evaluation and engineering governance.

---

## 中文说明

Bid Pilot 是一个围绕**政企标书专业工作流**构建的个人 AI 产品实践。

重点不是“让模型一次生成完整标书”，而是探索如何把需求抽取、企业证据、声明、正文生成、风险控制与 Evaluation 拆成可追踪、可校验、可恢复的产品链路，并明确：

> **LLM 负责语义判断，后端负责确定性控制；证据先于生成，评测进入产品生命周期。**
