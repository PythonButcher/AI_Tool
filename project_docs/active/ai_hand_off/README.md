# AI Hand-Off Map

This folder is only for active Codex-to-frontend-agent handoffs.

## Ownership

Codex is the Lead Orchestrator and owns the roadmap, active gate, backend truth and implementation, contracts, tests, architecture decisions, status documentation, handoff scope, integration review, cleanup planning, and final coordination.

Antigravity owns bounded frontend implementation, React/CSS, UI rendering, and frontend build work assigned by the current handoff unless the user explicitly authorizes Codex frontend edits in the current session. The user retains final browser-level acceptance.

## Active Handoffs And Goal Prompts

There is no active Antigravity handoff. Workspace membership backend readiness is `backend_not_ready`; frontend source-adding work must wait for Codex verification.

The current project gate is `project_docs/active/active_gate/README.md`. Current status is recorded in `project_docs/active/status/project_execution_status.md`.

Completed handoffs belong outside this active folder.

## Handoff Rule

When frontend work is needed, Codex must write a focused frontend-agent handoff that names the files to inspect, the backend truth, the acceptance behavior, the constraints, and the status-doc requirement.

The handoff file is the automation surface. Each active handoff must contain one clear `Goal:` prompt near the top so Antigravity's `auto-handoff-execution` skill can read the file and execute the task without the user copying a prompt from chat.

If the handoff is for a failed or incomplete frontend-agent implementation, it must be visibly labeled `REPAIR REQUIRED` near the top. Add a short `Repair Blocker` section that names the exact source file, broken assumption, expected contract behavior, and verification command. Keep the repair label and blocker separate from background context so Antigravity does not miss it.

When Codex opens or updates an active frontend handoff, the final response should name or link the handoff file and tell the user which agent owns the next step. Do not paste the full `Goal:` prompt in chat unless the user explicitly asks for it.

Do not make the frontend agent infer backend truth from raw contracts. Do not let the frontend agent invent backend APIs or silently change product scope.

Each handoff must separate two things clearly. Non-negotiables are the goal, backend contract, required states, prohibited scope, regressions, and acceptance evidence. Creative latitude includes component composition, styling details, accessible interaction treatment, micro-interactions, and concise copy within the existing design system. Antigravity must ask Codex before changing a non-negotiable boundary, but does not need approval for choices inside the stated creative latitude.

## Task Sizing and Decomposition

Codex is responsible for decomposing frontend work before handing it off. A frontend handoff must be one independently reviewable slice: a small set of related files, one visible behavior, one API or state boundary, and a short acceptance list. It must not combine a new UI surface, persistence integration, state migration, export behavior, and broad regression validation in one request.

If a request needs more than one independently reviewable slice, Codex must write the dependency order and issue only the first slice. The frontend agent must stop before beginning an oversized or ambiguous request, report the blocking scope, and request a breakdown. The frontend agent must not silently delegate, broaden scope, or declare a multi-slice task complete without that communication.

Previous full handoff README was preserved at `project_docs/archive/superseded_active_2026_05_24/ai_hand_off_README_pre_map_cleanup_2026_05_24.md`.

## Agent Common Pitfalls

Frontend agents should review this checklist to prevent common handoff failures:
- **Asynchronous Callbacks**: Always `await` parent callbacks that trigger network requests (e.g., `onRefresh`, `onSave`) before unblocking UI controls (`isSubmitting(false)`). Otherwise, controls are re-enabled while the UI is still stale.
- **Race Condition Guards**: When extracting data-fetching logic into a `useCallback`, always use a `useRef` fetch-counter to ignore stale responses. Do not remove old `isMounted` guards without replacing them with fetch-id checks.
- **Error Propagation**: Ensure data-fetching hooks actually `throw` errors if they fail so that awaiting components can handle them. Do not just `catch` and swallow them silently.
- **State Reconciliation**: When updating props to reconcile server version conflicts after an error, use a `useRef` to track the active ID so you don't accidentally reset the user's unsaved draft form values or hide the actionable error message.
- **Cleanliness Evidence**: Always check for trailing whitespace. If `git show --check HEAD` or `git diff --check` complains, you must strictly strip those trailing whitespaces from your working copy.
- **Strict Evidence Matching**: If the handoff specifies displaying exact server fields (like `version` or `validated_at`) or validating specific constraints (like rejecting duplicate fields), implement them exactly. Never skip a requirement.
