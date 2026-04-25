# Semantic Info

## Phase Goal

This phase adds the first semantic or business-layer foundation to the application without replacing the existing dataset-first pipeline. The current upload, cleaning, preview, filtering, charting, AI, reporting, and export flows continue to operate on datasets exactly as before. The new work introduces a parallel structure that can carry business meaning alongside those datasets.

## What Was Added

### 1. Backend semantic model inference service

A new backend service was added at `backend/services/semantic_model.py`.

It introduces an inferred semantic model structure that is built from the active dataset or from a supplied dataset payload. The model currently includes:

- dataset summary metadata
- field profiles
- inferred entities
- inferred dimensions
- inferred metrics
- placeholder relationships
- compatibility metadata that explicitly marks the model as additive and backward-compatible

The inference is intentionally conservative. It does not change data or downstream behavior. It only describes business-oriented meaning that can be reused later.

### 2. Active semantic model state in the backend

`backend/utils/global_state.py` now stores a current `semantic_model` alongside the existing uploaded and cleaned data references.

This allows the semantic layer to coexist with the same in-memory dataset flow the app already uses today.

### 3. Semantic model API endpoints

A new route module was added at `backend/routes/semantic_model.py` and registered in `backend/app.py`.

It provides:

- `POST /api/semantic-model/infer`
  - infer a semantic model from supplied dataset rows or the active dataset
- `GET /api/semantic-model/current`
  - retrieve the current semantic model, inferring one if needed from active data
- `PUT /api/semantic-model/current`
  - replace the current semantic model in memory

These endpoints create a stable integration point for later semantic editing, semantic-aware AI, and reusable KPI definitions.

### 4. Data Hub persistence support for semantic definitions

`backend/db/backend_db.py` now ensures the `datahub_datasets` table exists and includes a `semantic_model_json` column.

`backend/routes/datahub_routes.py` was extended so Data Hub records can now:

- store semantic model JSON
- return semantic model JSON in dataset payloads
- infer a semantic model for stored datasets when one is missing
- update semantic model definitions through dedicated endpoints

New Data Hub endpoints:

- `GET /api/datahub/<dataset_id>/semantic-model`
- `PUT /api/datahub/<dataset_id>/semantic-model`

This is the first durable persistence layer for semantic definitions in the repository.

### 5. Existing dataset routes now return semantic metadata alongside current responses

The following routes were updated so they continue returning their existing dataset payloads, but now also attach a `semantic_model` object:

- `backend/routes/upload.py`
- `backend/routes/api_fetch.py`
- `backend/routes/sql_fetch.py`
- `backend/routes/cleaning.py`
- `backend/routes/manual_cleaning.py`
- `backend/routes/analysis.py` for filtered dataset submission

This keeps the old flows working while allowing the frontend to begin receiving business-layer metadata whenever the dataset changes.

### 6. Frontend semantic state in `DataContext`

`frontend/frontend/src/context/DataContext.jsx` now carries semantic-layer state in parallel with dataset state.

Added state and helpers:

- `semanticModel`
- `setSemanticModel`
- `semanticModelStatus`
- `refreshSemanticModelFromDataset()`
- `useSemanticModel()`
- `useBusinessDefinitions()`

This is the main frontend integration point for future semantic-aware features.

### 7. Frontend flows now keep semantic state in sync with dataset mutations

The following existing flows were updated so semantic state is refreshed when data changes, without altering current behavior:

- `frontend/frontend/src/App.jsx`
  - stores semantic model on upload or dataset load
- `frontend/frontend/src/components/data_management/DataCleaningForm.jsx`
  - updates semantic model when cleaning is applied
- `frontend/frontend/src/components/data_management/DataFilterPanel.jsx`
  - updates semantic model when filters are applied or cleared
- `frontend/frontend/src/features/ai/AIChat.jsx`
  - refreshes semantic model after AI cleaning

### 8. Semantic summary helper for future business-aware AI

A new frontend helper was added at `frontend/frontend/src/utils/semanticModelUtils.js`.

It currently summarizes the active semantic model into compact entity, dimension, and metric text. `AIChat.jsx` now includes that summary in its conversation context when available. The raw dataset context is still preserved.

This is important because it lets future AI behavior begin reasoning from business-oriented concepts without removing dataset-level context.

## How It Fits Into The Existing Architecture

The existing application still revolves around datasets. That has not changed.

The semantic model is now introduced as an additive companion to the current dataset pipeline:

1. A dataset enters through upload, API import, DB preview, cleaning, or filtering.
2. The original dataset response is still returned exactly as before.
3. A semantic model is inferred from that same dataset and attached to the response.
4. The frontend stores both:
   - the dataset rows for current features
   - the semantic model for future business-aware features
5. Existing features continue using raw dataset logic.
6. New and future features now have a stable place to read business-oriented definitions.

## Files Involved

### Backend

- `backend/app.py`
- `backend/db/backend_db.py`
- `backend/utils/global_state.py`
- `backend/services/semantic_model.py`
- `backend/routes/semantic_model.py`
- `backend/routes/upload.py`
- `backend/routes/api_fetch.py`
- `backend/routes/sql_fetch.py`
- `backend/routes/cleaning.py`
- `backend/routes/manual_cleaning.py`
- `backend/routes/analysis.py`
- `backend/routes/datahub_routes.py`

### Frontend

- `frontend/frontend/src/context/DataContext.jsx`
- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/data_management/DataCleaningForm.jsx`
- `frontend/frontend/src/components/data_management/DataFilterPanel.jsx`
- `frontend/frontend/src/features/ai/AIChat.jsx`
- `frontend/frontend/src/utils/semanticModelUtils.js`

## Compatibility And Constraints

### Backward compatibility

This phase preserves backward compatibility by design.

- existing dataset payloads are still returned
- existing components still receive raw rows and previews
- charting still uses raw fields and mappings
- cleaning still works through current dataset transformations
- AI still receives raw dataset context
- reporting and export still operate on the current dataset pipeline

The semantic model is additive. Nothing in this phase replaces the old flow.

### Important limitation of this phase

This phase does not yet make the rest of the application semantic-first.

That means:

- charts still map directly to fields
- exports still summarize raw columns
- NLP charting still resolves columns rather than semantic definitions
- KPI logic is not yet centralized
- relationships are only placeholders today
- entities are inferred at a simple row-grain level

That is intentional. This phase is only the groundwork.

## Why This Sets Up Later Work Correctly

This phase creates the minimum durable structure needed for later business-oriented work:

- a reusable semantic model shape
- inference for datasets entering the app today
- backend storage for semantic definitions
- frontend state for semantic definitions
- API boundaries for reading and updating semantic models
- initial AI integration point for semantic context

Because the semantic layer now exists independently of any one chart, prompt, or report, later phases can start migrating downstream features onto shared business definitions instead of continuing to recompute meaning from raw fields.

## Likely Next Dependencies For Phase Two

The next phase will likely need to build on this foundation in the following order:

1. introduce editable semantic definitions instead of inference-only output
2. add explicit metric definitions with formulas and filters
3. add semantic IDs to chart configuration so charts can reference reusable metrics and dimensions
4. add semantic-aware AI prompts and NLP resolution before falling back to raw columns
5. begin routing reporting and exports through semantic definitions instead of raw-column summarization
6. introduce relationship and entity modeling beyond a single inferred dataset entity

## Summary

This phase does not convert the application into a BI platform yet. It creates the first architectural layer required to get there safely.

The system is still dataset-driven in operation, but it now has a real semantic/business definition layer that can live beside the current architecture and be expanded in future phases.
