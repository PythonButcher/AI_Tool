# Future Plan: Login-Based Context Engineering

Created: 2026-07-07

This is a deferred planning note, not an active implementation gate. It captures the idea that AI_Tool should eventually add login-based memory and context engineering for AI Chat. The current active gate is `project_docs/active/active_gate/README.md`.

## Idea To Preserve

Start with Google sign-in using Gmail accounts, then use the authenticated user as the anchor for remembered application state, AI Chat context, and Decision Intelligence context. The goal is not simply to make prompts longer. The goal is to give the application a governed context layer that remembers the right things, retrieves only what is relevant, explains what context was used, and keeps observational Decision Intelligence boundaries intact.

This likely becomes a larger product direction after the current Decision Intelligence work is accepted. If context requires changes to Decision Intelligence sections, contracts, or saved assets, those changes should be allowed, but they must be explicit and versioned rather than patched into existing fields casually.

## Research Basis

LangChain frames context engineering as the work of filling the model context window with the right information at each agent step, and groups the core practices into writing context, selecting context, compressing context, and isolating context. That maps cleanly to this application because AI Chat already has transient `session_state`, Decision Intelligence already has structured artifacts, and future user memory needs to decide what becomes durable, what is retrieved, what is summarized, and what stays outside the model unless needed. Source: [LangChain, Context Engineering](https://www.langchain.com/blog/context-engineering-for-agents).

OpenAI's current API guidance treats conversation state, retrieval, and compaction as separate but related mechanisms. The important product lesson is that long-running conversations need state management, vector or semantic retrieval can pull in external knowledge, and compaction can reduce context size while preserving key state for later turns. Source: [OpenAI, Conversation state](https://platform.openai.com/docs/guides/conversation-state), [OpenAI, Retrieval](https://platform.openai.com/docs/guides/retrieval), and [OpenAI, Compaction](https://platform.openai.com/docs/guides/compaction).

Anthropic's agent guidance is a useful constraint: add agentic complexity only when it demonstrably improves outcomes, keep the design transparent, ground agent progress in environment feedback, and use guardrails because long-running autonomous systems can compound errors. For AI_Tool, that argues for a measured context layer with traceable memory selection and evaluations before loosening AI Chat behavior. Source: [Anthropic, Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents).

## Current Application Fit

The current application does not appear to have user login or user-owned context persistence yet. A targeted source search found Google libraries in backend requirements and Gemini integration, but no current Google OAuth, Gmail login, user identity, account table, tenant boundary, or authenticated API ownership layer.

AI Chat already has a short-term context surface. `backend/decision_engine/chat_service.py` normalizes `session_state`, tracks `active_mode`, carries `decision_state`, preserves `last_analytic_context`, attaches `dataset_trust`, and returns `context_summary` when a dataset or semantic model is present. This is a good foundation for session memory, but it is not yet durable user memory.

Decision Intelligence already has contract-grade structured context. `project_docs/active/contracts/decision_objects.md` defines `dataset_trust`, `decision_output`, `frame`, `readiness`, `evidence_board`, `decision_map`, `scenario_compare`, `command_center`, `export_sections`, `source_refs`, and `truth_boundary`. Future context should extend this contract rather than hiding memory inside assistant prose.

Saved DecisionAssets are intentionally immutable historical snapshots. `backend/services/decision_asset_service.py` rejects raw transcripts, raw data rows, unsafe path keys, and out-of-contract decision output fields. Future memory should respect that design. A saved asset can be a memory source, but it should not become live data or be silently reinterpreted as a current recommendation.

## Proposed Future Direction

### Identity Foundation

The first enabling slice should be Google OAuth sign-in with Gmail-backed identity. The application should store a stable internal `user_id`, the Google subject identifier, display metadata, and session tokens using secure server-side session handling. All user-owned artifacts, uploaded datasets, semantic models, dashboard canvas state, AI Chat threads, saved DecisionAssets, and future memory records should be scoped by this internal user id.

Acceptance for this slice is basic but strict: a user can sign in, sign out, refresh the app without losing the session, and API routes can distinguish authenticated user-owned resources from anonymous or other-user resources. Existing unauthenticated local flows can remain during development only if they are clearly marked as local/dev mode.

### Context Memory Foundation

After login exists, add a durable context store with explicit memory types instead of one generic blob. The initial types should be user preferences, workspace state, dataset and semantic-model recency, AI Chat thread summaries, Decision Intelligence frame summaries, saved DecisionAsset references, and user-approved reusable facts. Each memory record should include ownership, source, created time, updated time, confidence, visibility, expiry or retention policy, and whether it was user-approved, system-derived, or imported from an artifact.

This is where context engineering begins in the product. Writing context means deciding what events create memory. Selecting context means retrieving only relevant memory for the current chat turn or decision frame. Compressing context means summarizing older thread or decision history into bounded summaries. Isolating context means keeping heavyweight objects, raw data, full transcripts, and old assets outside the model unless a specific step needs a compact reference.

### Context Assembly Service

Add a backend-owned context assembly service that runs before `DecisionChatService.handle_turn` and `DecisionChatService.handle_action`. It should accept the authenticated user, current message, current session state, dataset and semantic model references, and optional active artifact ids. It should return a bounded `context_bundle` with selected memories, reasons for inclusion, excluded-memory counts, freshness warnings, and token-budget metadata.

The service should not pass everything it knows into the model. A practical early policy would include current session state, current dataset trust, current semantic model summary, the most recent relevant AI Chat thread summary, a small number of related DecisionAssets by title/summary/source refs, and approved user preferences. It should exclude raw transcripts, raw datasets, path secrets, unrelated saved assets, stale memories below a relevance threshold, and anything from another user.

### Contract Changes

Decision Chat responses should eventually expose a new backend-owned `context_state` or `context_manifest` object. This should be separate from `dataset_trust`; dataset trust proves data source and readiness, while context state explains remembered or retrieved application context.

Candidate fields are `schema_version`, `user_context_scope`, `selected_context_refs`, `memory_types_used`, `omitted_context_summary`, `freshness_state`, `privacy_state`, `warnings`, and `token_budget`. The frontend can render this as a small "Context Used" inspector in AI Chat and Decision Intelligence outputs, but the backend should remain the source of truth.

The `decision_output` artifact may need a new section such as `context_used` or `context_basis`. That section should explain which remembered context shaped the frame, evidence review, command center, or export sections. It must not weaken `truth_boundary`; even with memory, Decision Intelligence remains observational unless a later approved slice explicitly adds higher capability with new gates.

### AI Chat Behavior

Loosening AI Chat responses should happen after context state is measurable. The model can become more conversational, adaptive, and user-aware when it knows the user's preferred explanation level, prior workspace, recurring datasets, decision style, and terminology. The structured output contract should remain strict for artifacts, exports, and decision support, while ordinary chat prose can become less rigid.

The useful distinction is that memory can personalize language and reduce repeated setup, but it must not quietly decide. For Decision Intelligence, remembered context can prefill likely metrics, business definitions, prior assumptions, and recurring caveats. It should still show what it used, ask before relying on uncertain memories, and preserve user control over context acceptance.

### Evaluation And Safety

The context layer needs tests before it becomes default behavior. Add unit tests for memory ownership, relevance ranking, privacy filtering, stale-memory exclusion, and prompt assembly limits. Add service-level tests proving that selected memories appear in `context_manifest` while excluded memories do not affect the output. Add regression cases for context poisoning, context clash, and unwanted personalization.

The user-facing controls should include memory on/off, clear memory, delete a memory, inspect context used for a response, and opt out of using a saved DecisionAsset as future context. Context engineering is only valuable if the user can trust the context window still belongs to them.

## Suggested Sequence

The first future phase should be Identity and Ownership. It adds Google sign-in, user ids, authenticated sessions, and resource ownership boundaries without changing AI behavior yet.

The next phase should be Durable Context Store. It adds typed, user-owned memory records and thread or decision summaries, but uses them only for retrieval previews and internal inspection at first.

The next phase should be Context Assembly for AI Chat. It introduces `context_bundle` internally and `context_manifest` externally, with tests proving selection, compression, exclusion, and privacy behavior.

The next phase should be Decision Intelligence Context Integration. It adds context-aware decision framing, a `context_used` section or equivalent, contract updates, export behavior, and saved-asset memory references.

The next phase should be Adaptive AI Chat Style. It uses approved preferences and observed interaction patterns to loosen ordinary chat responses while keeping decision artifacts, Dataset Trust, Truth Boundary, and export sections deterministic.

## Non-Negotiable Constraints

Context must be user-scoped from the start. No memory, DecisionAsset, dataset, semantic model, or thread summary should cross users.

Dataset Trust remains separate from user memory. Context can say what the app remembered; Dataset Trust says what data powered the answer.

Saved DecisionAssets remain immutable historical snapshots. They can be referenced as prior context, but they must not be presented as live facts, final recommendations, predictions, simulations, optimizers, causal proof, or autonomous decisions.

All context selection must be inspectable. If a remembered preference, prior decision, or saved asset influenced a response, the API should make that visible in a structured field.

The first implementation should favor conservative retrieval over surprising personalization. The system should ask before using ambiguous, stale, sensitive, or high-impact memory.

## Open Design Questions

Should AI_Tool support anonymous local mode after login exists, or should all Decision Intelligence persistence require sign-in?

Should memory be stored relationally first, with embeddings added later, or should the initial context store include vector search immediately?

Should saved DecisionAssets be opt-in memory sources by default, or should the user explicitly promote an asset into future context?

Should `context_manifest` be a top-level Decision Chat response field only, or also embedded inside every `decision_output` artifact and export section?

Should Google sign-in be only authentication, or should future Gmail/Drive connectors become optional context sources after separate consent?
