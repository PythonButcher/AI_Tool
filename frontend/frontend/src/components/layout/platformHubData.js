import dataFabricVisual from '../../assets/platform-hub/platform-data-fabric.jpg';
import analyticsSurfaceVisual from '../../assets/platform-hub/platform-analytics-surface.jpg';
import evidenceLineageVisual from '../../assets/platform-hub/platform-evidence-lineage.jpg';

/**
 * Structured content, mineral color themes, future roadmap placeholders,
 * topic context panels, and step-by-step guides for the Data Platform hub.
 */

export const HUB_PALETTE_STORAGE_KEY = 'platform_hub_palette';

export const HUB_COLOR_THEMES = [
  {
    id: 'mineral',
    label: 'Mineral Blue',
    swatches: ['#315fc4', '#197a7b'],
  },
  {
    id: 'emerald',
    label: 'Emerald Tide',
    swatches: ['#157a5b', '#1b7f82'],
  },
  {
    id: 'amber',
    label: 'Warm Ochre',
    swatches: ['#915c10', '#1f7480'],
  },
  {
    id: 'indigo',
    label: 'Cobalt Slate',
    swatches: ['#444ec2', '#247996'],
  },
];

export const PLATFORM_APPLICATIONS = [
  {
    id: 'datastream',
    name: 'Datastream',
    eyebrow: 'Active studio',
    description: 'Prepare and analyze data, explore it with AI Chat, and build models in ML Studio.',
    iconKey: 'datastream',
    featured: true,
    capabilities: [
      'Workspace',
      'Data Tools & Power Query',
      'Data Hub',
      'Data Model',
      'Analytics',
      'BI-First AI Chat',
      'ML Studio',
    ],
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    eyebrow: 'Document intelligence',
    description: 'Work with documents and trace extracted information back to source evidence.',
    iconKey: 'slipstream',
    featured: false,
  },
  {
    id: 'context-ledger',
    name: 'Context Ledger',
    eyebrow: 'Governed context',
    description: 'Find governed business context and the evidence behind it.',
    iconKey: 'context-ledger',
    featured: false,
  },
  {
    id: 'publishing-portal',
    name: 'Publishing Portal',
    eyebrow: 'Business reporting',
    description:
      'Open published dashboards, Excel-style tables, and print views with versioned links.',
    iconKey: 'publishing-portal',
    featured: false,
  },
];

export const PLATFORM_VISUALS = [
  {
    id: 'data-fabric',
    index: '01',
    tabLabel: 'Architecture',
    eyebrow: 'Platform architecture',
    title: 'Shared semantic fabric across tools',
    src: dataFabricVisual,
    alt: 'Layered glass data planes connected by mineral blue and teal pathways representing sources, semantic definitions, and insights',
    caption:
      'Connect raw tables, reviewed documents, and governed business definitions so teams reuse work instead of rebuilding logic.',
    highlights: [
      'Datastream anchors live data prep, modeling, and analysis today',
      'Companion apps plug into shared identifiers and revision contracts',
      'Hub navigation keeps open tools and working drafts intact',
    ],
    topicId: 'architecture',
  },
  {
    id: 'analytics-surface',
    index: '02',
    tabLabel: 'Analytics & ML',
    eyebrow: 'Datastream intelligence',
    title: 'Deterministic profiling, Analytics & local ML',
    src: analyticsSurfaceVisual,
    alt: 'Minimalist glass analytical bar clusters and smooth teal confidence bands over a dark slate coordinate plane',
    caption:
      'Inspect completeness automatically on upload, refine reproducibly in Power Query, visualize interactively, and benchmark local models against honest baselines.',
    highlights: [
      'Explicit Save Dataset commits clean revisions to Data Hub',
      'BI-first AI Chat stays grounded in your active dataset schema',
      'Five local ML tasks export verified Python joblib bundles',
    ],
    topicId: 'ml-baselines',
  },
  {
    id: 'evidence-lineage',
    index: '03',
    tabLabel: 'Lineage',
    eyebrow: 'Provenance & governance',
    title: 'Verifiable results with evidence intact',
    src: evidenceLineageVisual,
    alt: 'Frosted glass document slabs and structured schema tiles linked by hairline conduits into a verification prism',
    caption:
      'Designed for the roadmap where every shared figure traces back to contributing rows, approved Blueprints, and exact document passages under current permissions.',
    highlights: [
      'Planned Google OAuth & SSO anchors workspace ownership',
      'Dataset Trust remains distinct from remembered AI context',
      'Published releases separate snapshot history from live views',
    ],
    topicId: 'publishing-reuse',
  },
];

export const FUTURE_CAPABILITIES = [
  {
    id: 'identity-sso',
    title: 'Sign-In, SSO & Access',
    stage: 'Planned',
    iconKey: 'identity',
    summary: 'Google OAuth & org SSO for user-scoped datasets, workspaces, and role-based access.',
    topicId: 'identity-memory',
  },
  {
    id: 'context-memory',
    title: 'AI Context Memory',
    stage: 'Planned',
    iconKey: 'memory',
    summary: 'Durable user memory with a Context Used inspector, freshness checks, and opt-out controls.',
    topicId: 'identity-memory',
  },
  {
    id: 'live-business-model',
    title: 'Live Business Model',
    stage: 'Planned',
    iconKey: 'entities',
    summary: 'Shared entity pages linking tables, Context Ledger Blueprints, and Slipstream documents.',
    topicId: 'architecture',
  },
  {
    id: 'governed-data-products',
    title: 'Governed Data Products',
    stage: 'Planned',
    iconKey: 'products',
    summary: 'Versioned packages of curated data and metrics with owners, freshness, and lineage.',
    topicId: 'publishing-reuse',
  },
  {
    id: 'shared-investigations',
    title: 'Shared Investigations',
    stage: 'Planned',
    iconKey: 'investigations',
    summary: 'Reproducible team analyses and Guided Exploration inside BI-first AI Chat.',
    topicId: 'ai-grounding',
  },
  {
    id: 'monitoring-apps',
    title: 'Monitoring & Data Apps',
    stage: 'Planned',
    iconKey: 'monitoring',
    summary: 'Metric threshold alerts, approved action tracking, and composable role-specific apps.',
    topicId: 'architecture',
  },
];

export const CONTEXT_TOPICS = [
  {
    id: 'architecture',
    label: 'How apps connect',
    status: 'Platform vision',
    availableNow: false,
    title: 'Focused apps unified by shared data contracts',
    summary:
      'Datastream handles preparation, modeling, analytics, AI Chat, and ML today. Planned companion apps add document evidence, governance, and published reporting without duplicating definitions.',
    points: [
      'Datastream (available): active studio for tables, semantic models, BI Chat, and local ML.',
      'Slipstream & Context Ledger (planned): document extraction and governed Blueprints with source receipts.',
      'Publishing Portal (planned): versioned Dashboard, Table, and Print consumption for business readers.',
    ],
    relatedGuideId: 'first-dataset',
  },
  {
    id: 'working-vs-hub',
    label: 'Working Data vs. Hub',
    status: 'Available now',
    availableNow: true,
    title: 'Clean working sessions with explicit versioned saves',
    summary:
      'Uploads and Power Query refinements stay local to your session so you can experiment freely, then commit a versioned record to Data Hub only when ready.',
    points: [
      'Attach CSV, Excel, JSON, API, or SQL data to see a deterministic Workspace profile immediately.',
      'Clean, validate values, check keys, and summarize rows in Data Tools without polluting Data Hub.',
      'Click Save Dataset in Datastream to publish a reusable revision; hub navigation preserves open drafts.',
    ],
    relatedGuideId: 'first-dataset',
  },
  {
    id: 'ai-grounding',
    label: 'BI-First AI Chat',
    status: 'Available now',
    availableNow: true,
    title: 'Grounded answers anchored to your active schema',
    summary:
      'AI Chat generates charts, tables, and explanations strictly from your dataset and semantic model, with Auto, Quick, and Deep routing modes.',
    points: [
      'Pick any saved dataset beside New Chat and work in the docked panel or a detached window.',
      'Deterministic backend calculations stay separate from narrative summaries and chart drafts.',
      'Planned Guided Exploration will suggest grounded next-step analyses from active scope.',
    ],
    relatedGuideId: 'ai-chat-bi',
  },
  {
    id: 'ml-baselines',
    label: 'Local ML & Baselines',
    status: 'Available now',
    availableNow: true,
    title: 'Five local workflows benchmarked against baselines',
    summary:
      'Run Regression, Classification, Forecasting, Clustering, or Anomaly Detection locally with automated quality prep, holdout scoring, and Python exports.',
    points: [
      'Inspect grouped quality findings in Prepare Data and apply bulk treatments reproducibly.',
      'Benchmark linear and ensemble models on holdout splits (chronological for Forecasting).',
      'Export verified joblib model bundles, schema contracts, and sample Python scripts.',
    ],
    relatedGuideId: 'ml-experiment',
  },
  {
    id: 'identity-memory',
    label: 'Login & Context Memory',
    status: 'Planned',
    availableNow: false,
    title: 'Authenticated workspaces and inspectable memory',
    summary:
      'Local workspace mode requires no sign-in today. Planned Google/SSO identity will anchor private resources and user-controlled AI Chat memory.',
    points: [
      'Google OAuth & organizational SSO scope datasets, models, and chat threads by user and role.',
      'Context Used manifests will show which remembered preferences influenced an AI answer.',
      'Dataset Trust stays strictly separate from memory, with full clear, delete, and opt-out controls.',
    ],
    relatedGuideId: 'ai-chat-bi',
  },
  {
    id: 'publishing-reuse',
    label: 'Publishing Portal',
    status: 'Planned',
    availableNow: false,
    title: 'Versioned dashboards and Excel-style reports for teams',
    summary:
      'Planned standalone viewer where business readers open stable links in Dashboard, Table, or Print modes with server-enforced grants.',
    points: [
      'Interactive Table mode with sticky headers, variance comparisons, subtotals, and saved personal views.',
      'Formatted .xlsx workbook exports preserving column types, filters, and publication release metadata.',
      'Independent View, Download, Build, and Manage permissions evaluated per link and revision.',
    ],
    relatedGuideId: 'model-analytics',
  },
];

export const GUIDANCE_PLAYBOOKS = [
  {
    id: 'first-dataset',
    shortTitle: 'Import & save data',
    title: 'Import, profile, and save your first dataset',
    duration: '3 min',
    steps: [
      { number: '01', title: 'Attach a source', detail: 'Open Datastream and click Upload data, or connect an API/SQL source in Data Tools.' },
      { number: '02', title: 'Audit profile', detail: 'Check row counts, completeness, duplicates, and unique keys on Workspace.' },
      { number: '03', title: 'Refine & validate', detail: 'Use Data Tools for Power Query steps, value checks, key checks, and summaries.' },
      { number: '04', title: 'Save Dataset', detail: 'Click Save Dataset in the top banner to store a versioned entry in Data Hub.' },
    ],
    tip: 'Returning to Platform Hub preserves your mounted Datastream workspace and unsaved edits.',
  },
  {
    id: 'model-analytics',
    shortTitle: 'Model & Analytics',
    title: 'Model multi-source data and build Analytics',
    duration: '5 min',
    steps: [
      { number: '01', title: 'Join tables', detail: 'Open Data Model to add related sources and validate table relationships.' },
      { number: '02', title: 'Define measures', detail: 'Standardize metrics and Business Objects so charts and AI share definitions.' },
      { number: '03', title: 'Build layout', detail: 'In Analytics, arrange snapping panels, lock views, and customize palettes.' },
      { number: '04', title: 'Compare periods', detail: 'Use Change Explorer to diagnose shifts and export or print snapshots.' },
    ],
    tip: 'Use the Appearance panel inside Analytics to set currency/percent formats and target lines.',
  },
  {
    id: 'ai-chat-bi',
    shortTitle: 'Grounded AI Chat',
    title: 'Ask grounded questions with BI-first AI Chat',
    duration: '2 min',
    steps: [
      { number: '01', title: 'Open AI Chat', detail: 'Launch AI Chat from Datastream’s top banner in the docked pane or pop-out.' },
      { number: '02', title: 'Pick scope & mode', detail: 'Select a saved dataset beside New Chat and choose Auto, Quick, or Deep mode.' },
      { number: '03', title: 'Verify & draft', detail: 'Inspect returned tables, charts, and grounding metadata before turning into drafts.' },
    ],
    tip: 'Light/dark changes on this hub sync immediately across Datastream and detached pop-outs.',
  },
  {
    id: 'ml-experiment',
    shortTitle: 'Local ML Studio',
    title: 'Train, benchmark, and export a local ML model',
    duration: '6 min',
    steps: [
      { number: '01', title: 'New experiment', detail: 'With a dataset loaded, open ML Studio and start a versioned experiment draft.' },
      { number: '02', title: 'Prepare data', detail: 'Review grouped quality findings and apply bulk preprocessing or Power Query.' },
      { number: '03', title: 'Configure & train', detail: 'Pick one of five tasks, assign column roles, and benchmark against baselines.' },
      { number: '04', title: 'Review & export', detail: 'Audit holdout metrics and download the joblib bundle, schema, and Python script.' },
    ],
    tip: 'Forecasting enforces chronological splits automatically so future rows never leak into training.',
  },
];

export const ACCOUNT_PREVIEW = {
  currentMode: 'Local workspace mode',
  currentDescription:
    'Running locally with no login required. Saved Data Hub datasets and ML drafts persist in your local environment.',
  plannedItems: [
    { title: 'Google OAuth & Org SSO', detail: 'Authenticated server-side sessions for team workspaces.' },
    { title: 'Scoped Access & Roles', detail: 'Private drafts plus role-governed data products and reports.' },
    { title: 'Inspectable AI Memory', detail: 'Context Used transparency with clear and opt-out controls.' },
  ],
};
