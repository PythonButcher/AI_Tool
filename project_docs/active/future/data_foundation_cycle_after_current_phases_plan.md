# Future Cycle - Data Foundation And Automation Plan

This is a deferred planning record, not the active Decision Intelligence gate. Do not execute it until the active status file promotes it.

## Purpose

After the current Decision Intelligence phases, shift from council-led prioritization to direct product capability work. The next cycle should make the app handle real multi-source analytical workflows instead of continuing to refine decision-output architecture.

## Recommended Order

1. Multiple data sources.

The app should support more than one connected or uploaded data source in a workspace. This is the largest unlock because analysis, Decision Intelligence, ML, automation, and relationship modeling are all limited while the app behaves like a single-source tool.

2. Data source relationships.

Once multiple sources exist, users need Power BI-style relationships: join keys, source-to-source links, cardinality, relationship confidence, mismatch warnings, and clear semantic meaning. This should become the base for reliable AI Chat answers across sources.

3. Better cleaning tool.

Improve cleaning after the multi-source base is in place. Cleaning should support type fixes, missing-value handling, dedupe, normalization, column naming, merge readiness, and user-visible cleaning decisions that can feed the relationship model.

4. Improved basic ML.

Improve basic ML only after the app can understand data shape, target variables, candidate features, leakage risks, time columns, data quality, and relationships. Avoid advanced ML claims until readiness gates say the data is trustworthy enough.

5. Improved automation tool.

Upgrade automation after the data foundation is stronger. Automations should use trusted datasets, cleaning state, relationships, and safe action boundaries rather than acting on ambiguous single-source context.

6. Link automations to the AI Chat window.

Let AI Chat inspect, explain, trigger, and monitor automations once automation state is reliable. AI Chat should show what will run, what data it will use, what permissions or risks apply, and what happened after execution.

## Product Rule

Do not run another AI Council automatically before this cycle. The next needs are already concrete. Use a council only if the project has conflicting priorities, unclear ownership, or a major architecture fork.

## First Future Gate

The first future gate should be a scoped multiple-data-sources plan. Codex should inspect current data connection, upload, dataset registry, active dataset, AI Chat data context, and persistence code before proposing changes. Frontend work should wait for a backend contract and migration plan.
