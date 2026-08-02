# Archived Reference — Next Implementation Cycle Priorities Summary

This completed council summary belongs to a retired product direction and is not an active project gate.

# Next Implementation Cycle Priorities Summary

Date: 2026-06-28

## Council Conclusion

The council recommends a product-value cycle rather than another hidden-contract cycle. The source review shows that many foundations already exist: AI Chat can return `decision_output`, Dataset Trust, Evidence Board, Decision Map, Scenario Compare, export sections, graph actions, benchmark tests, and immutable saved DecisionAssets. The next work should make those pieces feel like a coherent Decision Intelligence product.

The highest priority is an AI Chat Decision Command Center: a dashboard-like review and control experience for the active `decision_output`, still rooted in AI Chat as the primary work surface. It should let the user see the brief, dataset trust, evidence, map, scenario state, limitations, and allowed next actions in one useful view, with stale or rerun state when the frame changes.

## Ranked Phases

## 1. AI Chat Decision Command Center

This is the strongest next feature because it turns existing backend structure into a product experience. The user should not have to inspect artifacts, read readiness text, and jump between surfaces to understand the decision. Codex should first define a backend-owned command-center state or confirm that `decision_output` can be extended additively. Gemini should implement only after the contract is stable.

## 2. Evidence-To-Action Workflow

The app already has Evidence Board, Decision Map, graph actions, charting, and Scenario Compare pieces. The next step is to connect them into a real loop: choose evidence, ask for a breakdown, open graph context, send a valid edge to Scenario Compare, or ask AI Chat to explain missing data. The key boundary is that these are next checks, not final recommendations.

## 3. Saved Decision Library Upgrade

The Decisions window is secondary but now has a useful role: immutable saved DecisionAsset review. The next slice should make saved assets easier to reuse without pretending they are live. Good upgrades include stronger library metadata, snapshot comparison, collections or tags, export from saved assets, and clear provenance.

## 4. Advanced Readiness And ML Trust Gates

The project has ML and AutoML surfaces, governance readiness, Dataset Trust, and advanced unsupported capability gates. The next backend-heavy phase should unify those into honest readiness diagnostics for prediction, optimization, causal analysis, and automated decisioning. This phase should not implement those advanced capabilities; it should explain what is missing before they can be trusted.

## 5. Product Truth Pruning And Executive Export Pack

The final ranked phase is cleanup with a product payoff. Legacy language around recommendations, Autopilot, AutoML, and strategic advice can conflict with the observational-only boundary. This phase should demote or rewrite overpromising surfaces and make exports read like executive decision assets rather than raw internal dumps.

## What The Council Rejected

The council rejected restarting broad canonical dataset alignment as a standalone first phase because Dataset Trust already exists and broad state work would be low-visibility unless tied to a decision outcome. It also rejected fake simulation, optimization, autonomous decisioning, causal proof, unsupported forecasting, and final recommendation language.

The council rejected a separate Decisions-window-first product direction. The Decisions window should stay secondary and focus on saved immutable assets unless a future approved slice changes that role.

The council also rejected frontend-only synthesis. If the UI claims a brief, map, scenario, readiness gate, or action is meaningful, the backend contract must supply the truth or the UI must label the state as a mock or display-only fallback.

## First Implementation Slice

The first implementation slice should be Codex-owned contract and backend planning for the AI Chat Decision Command Center. Start by deciding whether the existing `decision_output` artifact can be extended with a small command-center state or whether a new additive wrapper is cleaner. The first slice should prove one vertical path: AI Chat decision prompt to structured command-center payload to focused Gemini handoff.

Codex should not edit frontend implementation files for this slice. Gemini should wait until Codex provides exact fields, request or action semantics, acceptance checks, and build/browser expectations.

## Next Owner

Codex should act next. The next task is to turn the top-ranked phase into a scoped backend contract plan and, only after source-backed contract readiness exists, a focused Gemini prompt for the frontend command-center view.
