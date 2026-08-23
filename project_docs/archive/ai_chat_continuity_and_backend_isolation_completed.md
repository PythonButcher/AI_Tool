# Completed Backend Reference — AI Chat Continuity And Runtime Isolation

This record preserves the verified backend implementation and is not an active work plan.

AI Chat now treats the latest `user_message` as authoritative across sustained conversations. Prior analytical state is reused only with explicit refinement evidence, independent questions clear incompatible metrics, groupings, filters, and output preference, general dataset questions do not fall through to guessed measures, and BI session state no longer retains `decision_prompt`.

The public route was verified with an eight-turn realistic rolling history test and a twenty-four-turn stress test. Coverage includes independent questions, valid refinements, answer-to-chart transitions, filters, stale compatibility prompts, bounded message history, and state returned from every turn.

The primary Flask application now registers `backend/routes/decision_chat.py` by default. `backend/routes/decision.py` and its workspace, asset, graph, signal, brief, pipeline, recommendation, and scenario services are registered only when `ENABLE_DECISION_INTELLIGENCE_COMPATIBILITY` is explicitly enabled. Compatibility service imports inside `DecisionChatService` are lazy, so ordinary BI startup and Explore requests do not load them. Existing compatibility endpoints, persistence, and focused tests remain intact.

Verified backend commands passed:

`python -m py_compile backend/app.py backend/routes/decision_common.py backend/routes/decision_chat.py backend/routes/decision.py backend/decision_engine/chat_service.py tests/test_decision_runtime_isolation.py tests/test_decision_chat_service.py`

`python -m unittest tests.test_decision_chat_service tests.test_decision_runtime_isolation tests.test_nlp_chart_reliability tests.test_relationship_execution tests.test_data_catalog_lineage tests.test_decision_asset_service tests.test_decision_graph_service tests.test_decision_pipeline_service tests.test_decision_workspace_service tests.test_decision_phase_3_correction`

The combined backend run completed 91 tests successfully.
