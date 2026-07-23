# Data Catalog Governance and Quality Contract

## Purpose

Every backend path that turns a dataset into a chart, AI answer, decision output, model run, or export must evaluate the same readiness contract first. The result is explainable and safe to display because it contains no raw values from sensitive fields.

## Policy Model

The optional `governance_policy` request field, or its camel-case alias `governancePolicy`, accepts these fields. The policy can travel with upload, Data Hub registration, chart, AI Chat, Decision Intelligence, and AutoML requests. Data Hub persists it beside the dataset record.

| Field | Meaning | Default |
| --- | --- | --- |
| `required_fields` | Column names that must exist | No required columns |
| `null_thresholds` | A ratio, or `{ default, fields }`, limiting null values | 40% warning threshold unless explicitly configured |
| `duplicate_keys` | Key columns that must have unique non-null values | ID-like column names are checked as warnings; declared keys block duplicates |
| `value_ranges` | Per-column `{ min, max }` numeric bounds | No range bounds |
| `freshness` | `{ field, max_age_days, required }` timestamp rule | Disabled unless supplied |
| `pii` | `{ mode: warning|block, enabled }` handling for PII-like column names | Warning mode, enabled |
| `retention` | `{ expires_at }` ISO-8601 data retention expiry | Disabled unless supplied |

## Readiness Response

Every governed JSON response includes `governance_readiness`. It has `status` (`ready`, `warning`, or `blocked`), an overall `severity`, `reasons`, a top-level `next_action`, row and column counts, and the normalized policy. Each reason has a stable `code`, `severity`, plain-language `message`, exact `next_action`, and `field` when relevant.

Multi-source execution evaluates this readiness contract independently against every freshly loaded participating source and returns `schema_version: "multi_source_governance_v1"`, conservative overall `status`, `severity`, `next_action`, and ordered `sources[]` entries containing `source_id` and that source's full readiness object. Any blocked source refuses execution before a joined answer or chart is built. One-source requests retain the standard readiness shape above.

`blocked` always returns HTTP 422 with `error` and `governance_readiness`; no chart, AI result, decision artifact, model, rows, or export body is produced. `warning` permits the requested operation while exposing the remedy. Binary exports place the same signal in `X-Dataset-Governance-Status` and `X-Dataset-Governance-Next-Action` headers.

For Decision Chat requests that pass this gate, the route passes the verified readiness object internally to `decision_output.advanced_readiness`. Prediction diagnostics may cite `governance_readiness.status` and its remedies as source-backed evidence. This governance result can support preparation but cannot produce a `supported` prediction state because Decision Chat has no trusted dataset-lineage join to a model evaluation. Caller-supplied internal readiness fields are discarded. A blocked governance result still returns HTTP 422 before any Decision Output or advanced readiness diagnostic is composed.

## Enforcement Points

| Path | Behavior |
| --- | --- |
| `POST /api/upload` | Rejects a blocked file before it becomes the active dataset. |
| Cleaning and manual cleaning | Reject candidate output before committing it as cleaned data. |
| `POST /api/nlp/chart` | Rejects an inline dataset before chart construction. |
| Multi-source AI Chat and `POST /api/nlp/chart` | Re-evaluates every selected source, blocks if any source is blocked, and returns the ordered source-level rollup with result lineage. |
| `/api/decision/*` | Rejects inline or Data Hub datasets before workspace, chat, graph, pipeline, recommendation, and scenario processing. |
| `POST /api/automl/train` | Runs the governance gate before loading model training code. A passing gate does not establish model readiness, future performance, or Decision Chat Advanced Readiness. The route reports a bounded single-holdout evaluation separately. |
| `GET /api/export` | Rejects blocked datasets before building a download. |
| Data Hub | Stores the policy, exposes `GET /api/datahub/<dataset_id>/governance-readiness`, and prevents blocked row fetches. |
| Legacy `/ai` and `/ai_cmd` | Returns a warning when no structured dataset is supplied; blocks a structured dataset that fails readiness. |

## Frontend Contract

The frontend must render `governance_readiness` from all JSON responses, including error responses, as an honest warning or block with its supplied `next_action`. For downloads, it must inspect the two governance response headers. It must not infer readiness from chart, model, or decision success.
