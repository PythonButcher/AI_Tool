# Five capabilities the combined data platform needs

Deferred product review · 2026-11-21

## The product to build

**Give teams one place to turn scattered records, documents, and analyses into reusable business data that other people can verify, use, and act on.** Today, the three projects have pieces of that experience. A user can study a source PDF in Slipstream, ask a governed question in Context Ledger, or analyze data and train a model in Devstream. Datastream aims to give those tools a shared business context so teams can carry their work across them.

The product should get more useful as teams use it. A second team should be able to pick up the first team's data product, run its own analysis against the same definitions, verify a disputed result against original evidence, and use the product in a team app. It should be able to do that without reconstructing the original work. The distinctive behavior to test is whether exact source evidence and calculation history survive that entire journey, including updates and changes in who can see the underlying data.

## Ranked platform capabilities

### 1. Live business model

**Give users a consistent place to find and understand the things their business works with.** A customer, product, asset, project, or location has a shared identity and a page that brings together its relationships, events, related documents, measures, and history. Connect an entity to several source systems while keeping the source of each fact intact. Stewards can define what an entity or measure means and where that definition applies. Analysts, AI, and apps can then refer to the same object and see what was true at a given time, subject to their permissions.

Devstream already has data workspaces, semantic models, and validated relationships between tables. Context Ledger's Blueprints govern source scope and interpretation. Slipstream can point to a specific field or passage. The missing capability is a stable business identity that links those pieces across all three projects, plus a user-facing way to navigate them. This ranks first because every later capability gets cheaper to build and easier to trust when it can use the same objects and definitions. [Devstream workspace contract](../../contracts/multiple_data_source_workspace.md) · [Relationship contract](../../contracts/multiple_data_source_relationships.md) · [Context Ledger product contract](<C:/Users/18022/Desktop/Context Ledger/project_docs/active/product/context_ledger_product_contract.md>)

### 2. Governed data product publishing and reuse

**Let a team build something other teams can depend on.** A data product is an owned, discoverable package of data, definitions, and supporting evidence with a maintained output. A builder can combine sources, review document-derived data, define transformations or measures, test the result, and publish it. Consumers can see what it contains, who owns it, when it was updated, how it can be used, and whether they are on a pinned revision or following the current one. Analytics, AI Chat, ML Studio, and later apps should be able to use the same published product by reference.

The business model gives a customer or product a common meaning. A published data product gives people a specific, maintained thing to use, such as a collection of approved metrics or a joined dataset with document evidence. Devstream already has readiness checks and query lineage. Slipstream has reviewed, versioned Forms output with field evidence. Context Ledger publishes approved context. The combined platform needs a shared publish-and-consume lifecycle, including quality, freshness, and the ability to see who depends on a product before changing it. [Devstream data governance](../../contracts/data_catalog_lineage.md) · [Slipstream Forms contract](D:/Tool/gemini/hand_off/FORMS_CONTRACT.md) · [Context Ledger consumer evidence contract](<C:/Users/18022/Desktop/Context Ledger/project_docs/active/contracts/phase_12_governed_consumer_evidence_foundation_contract.md>)

### 3. Shared evidence and analysis workspaces

**Make investigation a team activity that can be resumed.** Start with a question, a business object, a document, or a metric. Move between the chart, contributing rows, exact document passages, and any relevant model output while keeping the same scope and definitions. Save the question, assumptions, filters, working notes, reviewed evidence, and result together. A colleague can reopen the same result or branch the investigation and compare an alternative. Make observed facts, model estimates, and human interpretations visibly distinct. Reapply the colleague's access before showing any result or evidence.

The business object persists across many questions. The workspace preserves what happened in one investigation. Devstream has charting, comparison, AI Chat, and local Analytics collections. Slipstream can highlight the original page region. Context Ledger has governed questions and actor-bound receipts. The missing product feature is a shared, reproducible investigation that combines those experiences and survives a handoff between people. [Devstream Analytics contract](../../contracts/analytics_workspace.md) · [Slipstream architecture](D:/Tool/gemini/ARCHITECTURE.md) · [Context Ledger public receipt and adapter contract](<C:/Users/18022/Desktop/Context Ledger/project_docs/active/contracts/public_api_v1_contract.md>)

### 4. Operational monitoring, action, and outcomes

**Give teams a way to use data to run work and learn from the result.** Let a team watch an approved business measure, event, or model signal. When a condition changes, show the affected objects, evidence, and permitted next actions. Give an owner the ability to review, approve, and carry out a defined action with the relevant context. Record what was decided, what actually executed, and the later result separately. A team should be able to see which responses resolved issues, which need follow-up, and where a change in policy or model behavior deserves review.

This is what turns the platform into something operators return to throughout the week. The existing Analytics and ML features can provide measurements, forecasts, or anomaly signals. The shared action lifecycle and measured outcome are new product work. Start with explicitly approved actions and observable outcomes. A completed action alone does not show that it caused the later result. [Devstream ML Studio contract](../../contracts/ml_studio.md) · [Devstream Analytics investigation and refresh behavior](../../contracts/analytics_workspace.md)

### 5. Composable data applications

**Let teams assemble the experience their audience needs from products that already exist.** A builder can combine shared object pages, metrics, evidence viewers, comparisons, input forms, and approved actions into a role-specific app. The app could be a simple read-only workspace or an interactive tool. Its users get an experience suited to their job and can still inspect supporting evidence where permitted. Its builder links to an approved data product and shared controls, so a new app does not create another definition or copy the sources.

This is the way the platform reaches people who will rarely open a full analytics studio. It is distinct from monitoring and actions, which govern what can happen and what was observed afterward. The app layer determines who sees what experience and how they use it. Devstream has dashboards and exports. The missing capability is to assemble, publish, and maintain an app whose parts stay linked to the shared business model, data products, and permission rules. [Devstream dashboard state contract](../../contracts/dashboard_canvas_state.md) · [Devstream Analytics contract](../../contracts/analytics_workspace.md)

## What makes the combination worth choosing

Fabric IQ and Palantir Foundry already cover shared business entities, analysis, and action. Palantir also builds operational apps on top of its objects. Dataiku already turns documents into structured datasets and reusable transformations. Databricks already tracks column-level lineage and downstream dependencies. These are meaningful substitutes for parts of the proposed product. [Microsoft Fabric IQ](https://learn.microsoft.com/en-us/fabric/iq/get-started-with-fabric-iq) · [Palantir Ontology](https://www.palantir.com/docs/foundry/ontology/overview) · [Palantir Workshop](https://www.palantir.com/docs/foundry/workshop/overview) · [Dataiku document extraction](https://doc.dataiku.com/dss/latest/visual-recipes/extract-document-content.html) · [Databricks lineage](https://docs.databricks.com/aws/en/data-governance/unity-catalog/data-lineage)

The differentiator to prove is **reuse with evidence intact for teams whose work depends on both documents and structured data**. A person can verify a result against the calculation, source rows, and exact source passage. A second team can reuse that result or definition with the same identity and provenance under its own permissions. When an underlying source changes, users can see what depends on it, what may need review, and which historical result they are looking at. Measure whether that experience is quicker to set up and easier to verify than the tools those teams already use.

## First product release

Deliver a small, working slice of the first three capabilities together. A builder connects two related business object types to a structured source and a document collection, publishes one data product, and makes it discoverable. An analyst uses that product in Devstream. A different team opens it independently in a shared investigation, verifies a material result against both kinds of source under its own access, and uses the product in a different analysis. Update one input and show which result remains pinned and which current view has changed or needs review.

The acceptance question for the platform is whether that second team can get to a trusted result with less setup, fewer redefined measures, and fewer manual evidence handoffs. Measure time to the first usable result, time for the second team to reuse it, and time to verify a material figure against the team's existing tools. Include a current-permission check after an access change. Expansion into action and app building should use those same published assets.

Use the Datastream hub as the shared entry point, Devstream for structured analysis, Context Ledger to govern evidence within existing source permissions, and Slipstream to read documents and inspect evidence. Start with supported adapters, stable references, and one definition of what the viewer may see. Give each shared contract a clear owner. Keep original sources in their authorized systems or use an explicitly governed copy when the experience requires one. A repository consolidation decision can follow that contract and product proof.

## Council decision

A platform experience strategist and a composability architect proposed independent rankings. A separate manager challenged both on whether each capability serves multiple teams, whether two capabilities described the same work, and whether established competitors already set that expectation. They separated the durable business object from an investigation, and the execution of an action from the app that presents it. Both reviewers explicitly approved the same five in the same order, and the manager concurred. The source review identifies existing building blocks. Cross-project operation and the adoption advantage described here still need to be demonstrated.
