# Datastream Publishing Portal — Standalone Application Build Plan

Deferred proposal · November 22, 2026

## Product goal

Build a standalone application where business users open, understand, and use work published from Devstream. Developers and analysts prepare data and build content in Devstream. Business users get a simple link or a library of content shared with them. The portal owns what was published, who can open it, and which release each link serves.

The core experience is a choice among **Dashboard**, **Table**, and **Print** where the published content supports them. A manager can scan a dashboard. An accountant can open the same reporting scope as a familiar Excel-style grid. An operations user can open a detailed report with the right period and filter already selected. All three see who published it, when the data is from, and what the numbers cover.

## Where it lives in the platform

| Area | Responsibility |
| --- | --- |
| **Devstream** | Build and validate dashboards, charts, tables, and report definitions in Analytics. Own source connections, dataset refresh, analysis execution, and advanced editing. Let authors pin work to Publishing and inspect publication status. |
| **Publishing Portal** | Provide a standalone viewer website and publishing API. Own the publication catalog, collections, stable links, version history, audience grants, personal views, and saved rendered output. Use a dedicated portal database for metadata and private file storage for approved report files, authorized snapshots, and exports. |
| **Data Hub** | Help builders find existing sources and discover published datasets they are allowed to build with. Show metadata from the publishing service when that feature is available and pass an approved dataset reference to Analytics. |
| **Context Ledger and Slipstream** | Context Ledger governs access to approved supporting evidence. Slipstream provides exact document locations and the original-source experience. Introduce evidence links through an authorized resolver when the underlying integrations are ready. |

Start with a sibling application such as `publishing_portal/` inside the Datastream repository, with its own frontend, backend, data stores, and deployable entry points. Share a small versioned publishing contract and reusable chart primitives where they fit both clients. A future move to its own repository relies on those boundaries. The standalone viewer opens a portal URL and can display a published snapshot after the author closes Devstream. A live view uses a supported server API and shows a clear unavailable or stale state if the provider cannot answer.

The first release uses existing Devstream sources. Business Objects can later supply stable contextual references. This sequence allows the publishing and Business Objects work to meet through a documented contract. [Business Objects roadmap](../../business_objects/README.md) · [Three-project platform strategy](three_project_data_platform_review.md)

## What people see and do

| Persona | Starting point | Useful actions |
| --- | --- | --- |
| **Business reader** | A shared link or **My Library**, with search, collections, and recently opened items. | Open a report, change allowed filters, see freshness and the report owner, and download an authorized output. |
| **Business power user** | A published table or dashboard with a clear **Table** option where supported. | Sort, filter, compare periods, group and subtotal, drill to permitted detail, and save a personal view. |
| **Publisher** | **Pin to Publishing** from a saved analysis or dashboard in Devstream. | Open the resulting draft, choose an audience, preview the published result, publish, release an update, roll back, or withdraw it. Review release status and use a stable viewer link. |
| **Data builder** | Data Hub or an audience-approved dataset page. | Inspect meaning, owner, coverage, schema, and freshness. Open in Analytics using an authorized dataset reference. Treat raw export and build access as separate grants. |

Use a consistent item header with title, owner, as-of date, relevant filters, and available actions. Let publishers arrange collections by team or purpose. Give direct links and library navigation equal priority so an occasional user can go straight to the right report. Keep one reading area and responsive navigation. On small screens offer simple filters and a readable summary, with a clear way to inspect wider tables. Support keyboard access and usable focus for charts, menus, and the grid.

### From Analytics to Publishing

A developer builds and checks a complex report in Devstream Analytics, saves it, then chooses **Pin to Publishing**. The action creates or opens a private publication draft tied to the saved analysis or dashboard and its source identities. Carry over the verified result or approved query, layout, measures, filters, and relevant source revisions. Show what will be published and which inputs drive it. The publisher previews the draft, selects the audience and allowed actions, then explicitly publishes a release. Repeat pin requests should reopen the same draft. Analytics retains **Pin copy** for adding a result to a Devstream dashboard.

## Dataset and report refresh

Devstream refreshes the source and reruns the saved preparation and report definitions against the validated dataset revision. Publishing displays the report release, data as-of time, and last successful refresh separately. Refresh updates the data used by a refresh-enabled report without changing its report definition. A pinned snapshot stays tied to its original data, and the publisher explicitly releases a new snapshot when needed.

| Source | Refresh behavior |
| --- | --- |
| **PostgreSQL and other supported databases** | Start with PostgreSQL. Provide **Refresh now** and scheduled refresh. Reread the approved tables, columns, and query scope using a server-managed connection with read-only access. Advancing the refreshed dataset requires the whole source selection to pass validation. Current PostgreSQL imports are stored snapshots and use request-scoped credentials. Durable server-side connection authorization is a prerequisite for scheduled refresh. |
| **Flat files** | Let an authorized builder replace the input for an existing dataset, preview the result of rerunning its saved preparation steps, and confirm the replacement. Keep the dataset identity stable and create a new revision. Report schema changes before applying the replacement. |

Validate required fields, types, relationships, and governed measures before advancing the data available to each affected report. A failed validation, timeout, or lost connection keeps the last successful authorized result available with a visible stale or failed status. Show the last attempt, last success, and an actionable error to the owner. Retries and overlapping refreshes must preserve the most recent valid revision and avoid duplicate rows. Recheck access before serving refreshed data or last-known results. [PostgreSQL workspace contract](../../contracts/postgres_workspace.md) · [Saved dataset workflow](../../saved_datasets/README.md)

## What the portal can publish

| Content | Viewer experience | Delivery |
| --- | --- | --- |
| **Single chart or chart collection** | One shareable chart or an ordered set of charts, each with title, units, and source scope. | First release. |
| **Dashboard** | A published layout of charts, tables, and KPIs. Show available filters, refresh status, and permitted details. | Snapshot in the first release. Live mode follows. |
| **Table or Excel-style report** | A spreadsheet-like view with typed columns, search, sorting, filters, totals, and an optional formatted Excel download. | Core first-release format. |
| **Standard report** | Read a published document or approved PDF. Later support a report layout assembled from text, charts, and tables. | Existing approved PDF in the first release. Authored report layouts follow. |
| **Paginated report** | Choose approved parameters and read or print a consistent multi-page report with recurring headers, page numbers, and complete results within supported limits. | Separate rendering phase. |
| **Reusable dataset** | An audience-approved dataset page with definitions, limits, freshness, and an **Open in Analytics** action for builders. | Live and governed data phase. |

Use a common publication record with typed content for each kind. A collection can mix item types and retain ordering and pinned revisions. Unsupported types may be reserved in the contract and tracked in this roadmap. Expose a viewer control once it has a real destination or an accurate availability state.

## Excel-style reporting and decisions

Make **Table** a genuine way to read and work with a report. Start with sticky headers, typed numbers and dates, column resizing, sort and filter controls, visible totals, and a server-backed page boundary for larger results. Put units and formats in the column definition. Clearly distinguish totals for all authorized filtered rows from totals on the current page. Keep the original published defaults one click away.

Offer **Download Excel** as a real `.xlsx` workbook with usable column types, the permitted selection, a readable sheet title, and the publication version, period, and filters in an information sheet. Preserve dates, leading zero identifiers, precision, and text values. Treat untrusted cell strings as data. Validate export scope independently from viewing and disclose result limits. Keep CSV as an optional plain-data output, with the same scope and export permission. Use keyboard movement and focus behavior appropriate to the kind of grid selected. [W3C interactive grid guidance](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) · [Power BI Excel export example](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-export-data)

Add a small set of decision tools once trusted grid behavior is in place.

| Question a business user has | Portal action |
| --- | --- |
| **What changed?** | Compare the current period with the previous period or an approved target. Show the change, its denominator, and the matching rows when available. |
| **Where should I look first?** | Sort by largest variance or show exceptions using thresholds defined by the publisher or a private viewer setting. |
| **What is driving this total?** | Group and subtotal by an allowed field, then open the contributing rows. Later support a simple pivot using approved measures. |
| **How do I come back to this view?** | Save a personal view with filters, columns, and ordering. Reapply it against the current allowed scope and show when filters or fields are unavailable. |

For example, a controller opens Monthly Operating Expenses in Table view, filters to their team, sorts by largest change, and opens the contributing rows for one cost center. They save that view for next month or export it with its date and scope included. This can be done within the published report. Keep calculations bounded to supported operations and make assumptions visible. Keep comments, scheduled delivery, embedding, and optional AI assistance as future capabilities after people can reliably use the core reports.

## Publishing contract and reliability

- **Asset identity and release identity.** Use a stable publication ID and immutable version ID. A short link resolves to the current authorized release. A pinned link identifies an exact authorized version. A collection version records its exact member versions. Use an expected current version when changing the active release. Publish only after required files and dependencies are ready. A failed or repeated publish cannot duplicate a release or switch a working link to a partial result.
- **Proposed interface.** Standardize a versioned manifest with `asset_type`, `title`, `schema_version`, `delivery_mode`, typed layout and content, data scope or fingerprint, and source references where authorized. The portal derives tenant, publisher identity, and permissions on the server. It returns `publication_id`, `version_id`, status, and a viewer link. Document the exact request, response, errors, retry key, file upload, and internal authorization handshake in the first contract. Preserve compatibility for supported published manifests when the authoring schema evolves.
- **Snapshot and live modes.** A snapshot holds only approved display data and files, with a recorded scope, limits, and as-of date. The first publisher adapter uses a supported stored-source result or approved file produced through a trusted publication flow, with no unrelated local cache or browser draft state. A live version stores the approved query or data product reference and a bounded parameter schema. The backend resolves it with the current viewer's applicable data grants. Keep content version and data refresh time visible as separate facts.
- **Permissions.** Evaluate audience and item access at list, search, open, query, drill, and download. Treat View, Download, Build, and Manage as distinct capabilities. A report link identifies content. The server decides whether the recipient may use it. Recheck access for saved versions, downloads, collection members, and personal views. Scope result caches by relevant access and inputs. Public links are a future policy decision.
- **Evidence and data boundaries.** Avoid publishing author credentials, unrestricted queries, storage paths, hidden columns, unapproved source documents, or another actor's Context Ledger receipt. If a document link is available, resolve it under the recipient's applicable access or use an explicitly approved evidence copy. Live query connectors and export jobs use scoped parameters. Devstream and the portal keep separate storage ownership, even when built from one repository.
- **Operational behavior.** Show whether a release is published, withdrawn, stale, unavailable, or failed. Keep a history of publish, rollback, and withdrawal with actor and timestamp. Use bounded queries, preview limits, and background rendering for large exports. Show actual result coverage and never report that a file is ready until it can be opened. A withdrawal controls hosted access. Copies already downloaded follow the organization's data handling policy.

## Reuse Datastream’s agent harness

Start with the current harness pattern and keep the pieces that actively govern work. The harness is for building and maintaining the portal. Viewer workflows use the portal's ordinary product interfaces.

| Carry over | Portal adaptation |
| --- | --- |
| **Short instructions and doc routing** | Add a concise app-scoped instruction file, product roadmap, contract map, and evidence locations. Route contributors to the repository's authoritative status, authorization record, and active gate while both apps share one repository. |
| **One active step and explicit ownership** | Record what the user authorized, which paths can change, one current step, readiness, and who acts next. Codex owns backend, contracts, tests, and review. Use one bounded Antigravity UI handoff after contract readiness unless the user explicitly assigns UI implementation to Codex. The user owns final browser acceptance. |
| **Executable validation** | Reuse the patterns from the harness validator, active-gate checker, mutation guard, hook tests, and CI entrypoint. Parameterize only app-specific paths or checks needed by the portal. Test denied out-of-scope writes and ownership mismatch using fixtures. Run in manual mode first and enable lifecycle hooks only after verified behavior. |
| **Handoff and return** | Use the same structure for exact contract fields, target files, fixtures, applicable async failure and recovery states, required tests/build, and stop-and-return. Review source and verification before moving ownership. |

An app inside the Datastream repository follows the single root gate. If the portal later becomes its own repository, give it its own small `AGENTS.md`, status and authorization files, single active-gate README, local validators, CI command, and handoff template. Use the blueprint and template to adapt the generic logic. Leave product-specific histories, runtime settings, existing handoffs, and unrelated frontend assumptions with their owning app. [Datastream harness blueprint](../../agent_harness/harness_blueprint.md) · [Hook guidance](../../agent_harness/hooks.md) · [Frontend handoff template](../../agent_harness/templates/ANTIGRAVITY_FRONTEND_HANDOFF_TEMPLATE.md)

## Ordered build plan

| Phase | Delivery | Evidence to advance |
| --- | --- | --- |
| **1 — Standalone foundation and publish contract** | Codex sets up the app boundary, harness, shared manifest, portal metadata and file-store interfaces, and the minimum API to publish and read a private snapshot with fixture identities. Define admission checks and release transitions before UI work. | Backend tests prove idempotent publication, an unavailable partial release, an authorized read, denied access, durable version identity after restart, and storage ownership. CI validates the adapted harness. |
| **2 — Publish and view the first release** | Connect **Pin to Publishing** in Analytics to a private portal draft and an explicit snapshot release. Add one focused viewer handoff at a time for link and library, then chart/dashboard, table, and authorized PDF download. Include the first Excel-style report and `.xlsx` export before calling the first release ready. | An author pins a saved report, previews its layout, measures, and filters, then publishes. An authorized viewer opens it in a separate session. A repeated pin opens the same draft, and a second release appears only after explicitly publishing. Verify restricted viewing, download permissions, and workbook values and scope. |
| **3 — Collections and business reporting tools** | Group single and multiple charts, dashboards, tables, and reports for an audience. Expand table views with compare, subtotals, exceptions, authorized drill, and saved personal views. Add simple authored report layouts where needed. | Teams can find a report by collection and complete a period comparison or exception review. Verify totals, audience differences for collection members, and access changes. |
| **4 — Governed refresh, live data, and dataset reuse** | Implement PostgreSQL refresh first, then file replacement and report reruns. Add a bounded live query adapter, explicit viewer scope and freshness, a published dataset catalog entry, and reuse from Data Hub. Add authorized evidence links if provider contracts support them. | Change known values in PostgreSQL and a replacement CSV. Verify that refreshed dataset and report totals match, viewer and export results agree, and pinned snapshots keep their original values. Exercise an incompatible schema, an interrupted refresh, a safe retry, and revoked access. |
| **5 — True paginated reports** | Add a typed report definition, report parameters, page layout, repeated headers and footers, group breaks, preview, and jobs that generate PDF and structured Excel output. Reuse the portal catalog, release, and access rules. | A long table flows correctly across pages. Totals and sections match the authorized query, missing or invalid parameters are clear, and completed outputs can be reopened. [Power BI pagination as a product reference](https://learn.microsoft.com/en-us/power-bi/paginated-reports/paginated-reports-pagination) |
| **Later — Distribution extensions** | Assess scheduled delivery, secure embedding, cross-project evidence packages, and additional authoring integrations against viewer demand. | Each extension has an audience, a supported permission model, and a separate authorized delivery goal. |

Devstream currently has local Analytics collections, dashboard snapshot metadata, and report exports. Use those for a publisher adapter and rendering fixtures. Establish durable sharing in the portal. [Analytics workspace contract](../../contracts/analytics_workspace.md) · [Dashboard sharing contract](../../contracts/dashboard_canvas_state.md)

## Start here when the user authorizes implementation

Goal: Establish the standalone portal foundation and prove private snapshot publication from a minimal versioned contract.

Read this plan, the repository instructions and current gate, the Analytics and dashboard sharing contracts, and the Datastream harness blueprint. Confirm the sibling app location and which repository owns the active gate. Record the user's implementation authorization, allowed paths, current step, and ownership in that repository before coding. Activate Phase 1 only.

Use the proposed `publishing_portal/` application area for backend, storage, tests, and app-scoped docs. Put contract types where both the portal and Devstream integration can version and test them. Choose exact paths and commands in the new gate before implementation. Add a minimal working backend for a private publication, a stable version and link, a denied viewer, and a safe retry. Use fixtures for Devstream inputs and test durability and partial failure. Run focused backend tests, contract checks, the applicable harness and active-gate checks, and `git diff --check`. Frontend implementation begins from a bounded handoff backed by verified response fields. Control returns to the next recorded owner with contract and test evidence.

This kickoff is a future entry point. Implementation authority comes from the user's later start instruction.
