Goal: Build a robust, durable Workflow Reliability feature for AI_Tool without changing the current active project stream.

# Assignment

Work only on the workflow product area. Strengthen the existing workflow builder and runner so saved workflows and their execution history behave like a dependable application feature rather than temporary process state.

Read `AGENTS.md`, `project_docs/INDEX.md`, and `project_docs/active/README.md` for repository rules and product direction. Then inspect the existing workflow routes, storage, executor, API client, React workflow components, and their styles before proposing or changing architecture. Work one step at a time: verify the current behavior, define the run-state contract, implement the backend foundation, add focused tests, then update the workflow UI against the verified contract.

Codex remains the lead architect and final reviewer. Return exact changed files, architectural decisions, limitations, test output, and build output for Codex review. Do not treat a successful build as proof that the feature contract is complete.

# Required Backend Outcome

Persist workflow runs and their event history so they remain inspectable after navigation and backend restart. Do not keep authoritative run state only in process memory.

Validate workflow definitions before saving or executing them. Reject duplicate node identifiers, missing nodes, dangling edges, unsupported commands, invalid execution order, cycles, and malformed node parameters with structured errors. Never execute a cyclic graph by falling back to visual position.

Use explicit run states and safe transitions. At minimum, support `queued`, `running`, `cancel_requested`, `cancelled`, `completed`, `failed`, and `interrupted`. A restart must not pretend an unfinished run completed. Mark work that cannot be resumed safely as interrupted and explain why.

Add cooperative cancellation. Cancellation must stop execution before the next node and preserve the results and events already produced. If an active command cannot be interrupted safely, show `cancel_requested` until that command returns and do not claim immediate cancellation.

Protect duplicate submissions through an optional idempotency key while preserving compatibility with the existing execute request. Concurrent status updates must not overwrite a newer terminal state.

Expose durable run history through bounded, paginated API responses. Preserve the existing start-run and get-run behavior where practical. Add only the smallest clear endpoints needed for listing runs, requesting cancellation, and inspecting events or results.

Do not persist full input datasets, raw uploaded rows, secrets, credentials, hidden prompts, or unbounded model output in workflow history. Persist safe metadata, node status, timestamps, bounded event details, bounded result summaries, and references when reliable identities already exist. Define and test truncation behavior.

Do not add automatic retry of arbitrary workflow nodes. Some commands may have side effects. A future retry control may be represented as a clearly disabled placeholder, but it must not execute until an idempotency and side-effect contract exists.

# Required UI Outcome

You may substantially improve the workflow interface where necessary to make reliability visible and usable. UI changes must remain inside the workflow feature area and adhere to the application’s existing visual language, spacing, typography, colors, controls, motion, and accessibility patterns. Do not redesign unrelated application surfaces.

The workflow UI should make saved runs understandable. Show current status, node progress, timestamps, failures, cancellation state, interrupted state, and retained history. Users must be able to inspect a prior run without confusing it with the currently executing run. Loading, empty, stale, error, and restart-recovery states must be deliberate.

Controls must be honest. A control that is not implemented must be visibly disabled and labeled as unavailable or coming later. Do not create buttons that silently do nothing, fake successful actions, fake live updates, or imply that a placeholder is operational.

Preserve accessibility. Interactive controls need keyboard support, visible focus, suitable labels, and status announcements where workflow progress changes asynchronously.

# Reviewability

Keep the implementation easy to audit. Prefer explicit service and repository boundaries, typed or schema-validated payloads, small functions, stable error codes, and comments that explain non-obvious concurrency, persistence, recovery, or cancellation decisions. Avoid clever abstractions that hide state transitions.

If the existing architecture cannot support a requirement safely, stop that part of the implementation and report the exact limitation. A clearly labeled placeholder plus a precise technical explanation is acceptable. Quietly weakening the requirement is not.

Do not rewrite source files with shell redirection, `Set-Content`, `Out-File`, Python file-writing helpers, or bulk replacement scripts. Use patch-based edits and preserve unrelated work.

# Tests And Acceptance

Add focused backend tests for valid directed acyclic graphs, cycle rejection, malformed definitions, duplicate submissions, durable retrieval, restart handling, cancellation before execution, cancellation between nodes, cancellation requested during a running node, concurrent terminal updates, failed nodes, `continue_on_error`, event ordering, pagination, result truncation, and preservation of existing workflow endpoints.

Add focused frontend tests when the repository’s current test setup supports them. At minimum, verify the production build and manually inspect the source paths for status rendering, history selection, cancellation, disabled placeholders, error handling, and accessibility behavior.

The feature is ready for Codex review only when the focused workflow tests pass, existing relevant regressions pass, `python .codex/hooks/agent_harness_check.py` passes, `git diff --check` passes, and `npm --prefix frontend\frontend run build` completes without new workflow warnings.

# Boundaries

Do not change source-workspace membership, source relationships, the Data Model canvas, dataset selection, AI Chat request construction, authentication, account ownership, active project gates, current status documentation, future planning documents, or any `GEMINI.md` file.

Do not modify this `CLAUDE.md` assignment while implementing it. Do not broaden the task into a generic distributed job platform, scheduler, automation marketplace, or application-wide redesign.

Stop after returning exact changed-file evidence, test and build output, remaining limitations, and any placeholders introduced. Codex will review the branch and decide whether any part should be accepted.
