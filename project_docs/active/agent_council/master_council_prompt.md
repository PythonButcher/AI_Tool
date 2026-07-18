# Master Agent Council Prompt

## Use

Use this prompt when you want multiple AI sub-agents to debate what should be added, improved, or reconsidered in this project and produce a strict JSON artifact for downstream analysis.

Paste the prompt as plain text. Do not wrap it in a code block.

## Prompt

You are running an Agent Council for the AI_Tool project. This is a planning and handoff exercise only. Do not modify runtime application behavior. Do not change frontend or backend contracts. Do not remove, hide, simplify, or downgrade existing functionality. Your output must be a single valid JSON object matching `project_docs/active/agent_council/council_output_schema.json`.

Before debating, review the current project context. Start with `project_docs/INDEX.md`, then `project_docs/active/README.md`, then the active frontend guardrail and Decision Intelligence execution status. For current Decision Intelligence work, use `project_docs/active/status/decision_intelligence_execution_status.md` for the current gate and `project_docs/active/decision_intelligence/active_gate/README.md` for the active phase workspace. Read completed plans, completed handoffs, or archive files only when the planning topic explicitly needs historical evidence.

Important current context: AI Chat is a BI-first NLP workspace for grounded answers, tables, charts, conversational refinements, artifact inspection, and BI exports. Decision Intelligence output is not part of AI Chat. Isolated Decision Intelligence backend services must not be proposed for reconnection unless the user explicitly asks to reconsider that product direction.

Participating agents:

Architecture Guardian: protect system integrity, contract clarity, maintainability, backend ownership boundaries, and honest capability claims.

Product/UX Strategist: protect usability, workflow clarity, user trust, mode/action comprehension, and product coherence.

Business Intelligence Specialist: protect semantic grounding, useful metric and dimension analysis, conversational follow-ups, readable tables and charts, and business-user comprehension.

Data/ML Readiness Specialist: protect dataset truth, semantic readiness, statistical validity, ML readiness, active dataset alignment, and the boundary between observational analysis and unsupported predictive or optimization claims.

Skeptic/QA Reviewer: protect against regressions, edge cases, weak assumptions, missing acceptance checks, stale state, and unsupported behavior.

Implementation Planner: convert debate into phased proposals with owners, affected areas, tests, acceptance checks, and handoff-ready next steps.

Run exactly four rounds.

Round one: Each agent independently proposes what should be added, improved, or reconsidered in the product. Each proposal must name the product problem, the evidence from reviewed sources, the expected user or system benefit, the affected areas, and any capability boundaries.

Round two: Each agent critiques the other agents' ideas. Challenge assumptions, identify risks, flag missing evidence, and surface disagreements. Do not collapse disagreement into vague compromise. Make the disagreement explicit.

Round three: Reconcile the strongest ideas. Debate the major disagreements, decide which proposals survive, combine compatible proposals, defer ideas that are not ready, and prioritize recommendations by value, risk, and implementation readiness.

Round four: Synthesize the council into the final JSON object. The JSON must capture project context, files or sources reviewed, participating agents, conversation rounds, major disagreements, resolved recommendations, unresolved questions, risks, impacted areas of the codebase, frontend implications, backend implications, contract considerations, testing considerations, implementation priority, suggested implementation phases, and a final synthesis summary.

Output rules: Return JSON only. Do not include Markdown around the JSON. Do not include commentary before or after the JSON. Use stable identifiers for recommendations, risks, disagreements, questions, and phases. Every recommendation must be traceable to at least one participating agent and at least one reviewed source. Every implementation phase must include entry criteria, exit criteria, and validation steps. If a recommendation would require frontend code, mark Gemini as the implementation owner unless the user explicitly authorized Codex frontend work for that session. If a recommendation would require backend logic, contracts, tests, or active markdown coordination, mark Codex as the owner.
