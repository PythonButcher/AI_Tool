import {
  captureVisibleChartImages,
  exportStructuredPdf,
  formatPdfTimestamp,
  readablePdfLabel,
  sanitizePdfText,
} from './appPdfExport';

const labelForRef = (ref) => {
  if (!ref) return '';
  return sanitizePdfText(ref.label || ref.name || ref.metric_id || ref.dimension_id || ref.field || ref.binding_label);
};

const labelForValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizePdfText(String(value));
  }
  return sanitizePdfText(
    value.label ||
    value.name ||
    value.metric ||
    value.field ||
    value.dimension_id ||
    value.metric_id ||
    value.binding_label ||
    value.statement ||
    value.summary ||
    value.title ||
    ''
  );
};

const listLabels = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map(labelForValue).filter(Boolean);
};

const conditionLabel = (condition) => {
  if (!condition) return '';
  const parts = [
    condition.operator,
    condition.value,
    condition.secondary_value ? `to ${condition.secondary_value}` : '',
    Array.isArray(condition.values) ? `[${condition.values.join(', ')}]` : '',
    condition.unit,
  ].filter((part) => part !== null && part !== undefined && sanitizePdfText(part));
  return parts.join(' ');
};

const bindingSummary = (binding) => {
  if (!binding) return '';
  return labelForRef(binding.metric_ref || binding.dimension_ref) || binding.binding_label || binding.status || '';
};

const readinessCards = (readiness = {}, capabilityState = {}) => {
  const cards = [];
  const readinessState = readiness.readiness_state || readiness.status;
  if (readinessState || readiness.truth_boundary) {
    cards.push({
      title: 'Readiness',
      body: [
        readinessState ? `State: ${readinessState.replace(/_/g, ' ')}` : '',
        readiness.truth_boundary ? `Boundary: ${readiness.truth_boundary.replace(/_/g, ' ')}` : '',
      ].filter(Boolean).join(' | '),
    });
  }

  Object.entries(capabilityState || {})
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .forEach(([key, value]) => {
      cards.push({
        title: readablePdfLabel(key),
        body: `${value.status || 'unknown'}${value.reason ? ` | ${value.reason}` : ''}`,
      });
    });

  return cards;
};

const readinessChecklistCards = (readiness = {}, decisionReadiness = {}) => [
  {
    title: 'Data Context Loaded',
    body: (readiness.dataset_ready || decisionReadiness.structural_readiness?.ready_for_observational_analysis) ? 'Ready' : 'Needs review',
  },
  {
    title: 'Semantic Logic Active',
    body: readiness.semantic_ready ? 'Ready' : 'Needs review',
  },
  {
    title: 'Business Goals Defined',
    body: readiness.objective_ready ? 'Ready' : 'Needs review',
  },
  {
    title: 'Structural Integrity Verified',
    body: decisionReadiness.structural_readiness?.ready_for_observational_analysis ? 'Ready for observational analysis' : 'Not ready',
  },
];

const workspacePreviewSections = (wp, readiness, capabilityState) => {
  const kickoff = wp.decision_kickoff;
  const unresolved = wp.drafting?.prompt_matches?.unresolved_mappings || wp.unresolved_mappings || [];

  return [
    {
      title: 'Decision Kickoff',
      keyValues: [
        { label: 'Title', value: wp.title || 'Untitled Decision Framework' },
        { label: 'Status', value: wp.status_label || wp.status },
        { label: 'Summary', value: kickoff?.summary || kickoff || wp.scope_summary || wp.summary },
        { label: 'Objective', value: labelForValue(wp.objective_metric) },
        { label: 'Time Horizon', value: wp.time_horizon || 'Ongoing' },
      ],
    },
    {
      title: 'Visible Frame',
      cards: [
        { title: 'Primary Levers', body: listLabels(wp.levers).join(' | ') || 'Not specified' },
        { title: 'Segmentation', body: listLabels(wp.segment_dimensions).join(' | ') || 'Not specified' },
        { title: 'Guardrails', body: listLabels(wp.guardrails).join(' | ') || 'Not specified' },
      ],
    },
    {
      title: 'Readiness And Capability Boundary',
      cards: readinessCards(readiness, capabilityState),
      items: readiness.allowed_next_actions,
      emptyText: 'No backend-approved next actions were shown.',
    },
    {
      title: 'Unresolved Semantic Mappings',
      items: unresolved.map((mapping) => {
        const candidates = Array.isArray(mapping.candidate_labels) ? mapping.candidate_labels.join(', ') : '';
        return `${mapping.mapping_type || 'mapping'}: ${mapping.term || mapping.label || mapping.field || 'unknown'}${mapping.reason ? ` | ${mapping.reason}` : ''}${candidates ? ` | Candidates: ${candidates}` : ''}`;
      }),
      emptyText: 'No unresolved mappings were shown.',
    },
  ];
};

const analysisSummarySections = (content) => [
  {
    title: 'Workspace Analysis Summary',
    keyValues: [
      { label: 'Headline', value: content?.summary?.headline || content?.headline },
      { label: 'Summary', value: content?.summary?.content || content?.summary },
      { label: 'Truthfulness Note', value: content?.truthfulness_note },
    ],
  },
  {
    title: 'Diagnostic Items',
    cards: Array.isArray(content?.items)
      ? content.items.map((item) => ({
        title: labelForValue(item.label || item.statement || item.headline || item.title || item),
        body: item.description || item.summary || item.reason || item.category,
      }))
      : [],
    emptyText: 'No diagnostic details were shown.',
  },
  {
    title: 'Missing Inputs',
    items: listLabels(content?.missing_inputs),
    emptyText: 'No missing inputs were shown.',
  },
];

const answerSections = (content) => [
  {
    title: 'Grounded Data Result',
    keyValues: [
      { label: 'Metric', value: content?.metric?.label || content?.metric?.name || content?.fieldsUsed?.value },
      { label: 'Summary Value', value: content?.summary?.value_formatted || content?.summary?.value || content?.value },
      { label: 'Top Result', value: content?.top_group?.label },
      { label: 'Message', value: content?.message },
    ],
  },
  {
    title: 'Visible Rows',
    items: Array.isArray(content?.rows)
      ? content.rows.slice(0, 30).map((row) => {
        const label = row.group_label || (row.group ? Object.values(row.group).join(' | ') : 'Segment');
        return `${label}: ${row.value_formatted || row.value}`;
      })
      : [],
    emptyText: 'No result rows were shown.',
  },
];

const chartSections = (content) => [
  {
    title: 'Chart Result',
    keyValues: [
      { label: 'Chart Type', value: content?.chartType },
      { label: 'Explanation', value: content?.explanation },
    ],
    images: captureVisibleChartImages(),
  },
  {
    title: 'Chart Data',
    items: Array.isArray(content?.chartData?.labels)
      ? content.chartData.labels.slice(0, 40).map((label, index) => {
        const firstDataset = content.chartData.datasets?.[0] || {};
        return `${label}: ${firstDataset.data?.[index] ?? ''}`;
      })
      : [],
    emptyText: 'No chart data labels were shown.',
  },
];

const workspaceSections = (workspace, analysis) => {
  const scope = workspace.decision_scope || {};
  const objective = scope.objective || {};
  const scopedContext = workspace.scoped_context || {};
  const readiness = workspace.decision_readiness || workspace.readiness?.decision_readiness || workspace.readiness || {};
  const rawReadiness = workspace.readiness || {};
  const capabilityState = readiness.capability_state || workspace.readiness?.capability_state || {};

  const sections = [
    {
      title: 'Workspace Header',
      keyValues: [
        { label: 'Title', value: workspace.title || 'Untitled Decision Workspace' },
        { label: 'Status', value: workspace.status },
        { label: 'Workspace ID', value: workspace.workspace_id },
        { label: 'Prepared', value: formatPdfTimestamp(workspace.created_at) },
        { label: 'Decision Prompt', value: workspace.decision_prompt },
      ],
    },
    {
      title: 'Reliability Boundary',
      keyValues: [
        { label: 'Readiness State', value: readiness.readiness_state || readiness.status },
        { label: 'Truth Boundary', value: readiness.truth_boundary },
        { label: 'Allowed Next Actions', value: Array.isArray(readiness.allowed_next_actions) ? readiness.allowed_next_actions.join(', ') : '' },
      ],
    },
    {
      title: 'Scope Summary',
      body: workspace.scope_summary,
    },
    {
      title: 'Success Objective',
      keyValues: [
        { label: 'Statement', value: objective.statement },
        { label: 'Direction', value: objective.direction },
        { label: 'Target', value: conditionLabel(objective.target) },
        { label: 'Time Horizon', value: objective.time_horizon?.label || objective.time_horizon },
        { label: 'Metric', value: labelForRef(objective.metric_ref) },
      ],
    },
    {
      title: 'Strategic Levers',
      cards: Array.isArray(scope.levers)
        ? scope.levers.map((lever) => ({
          title: lever.label || 'Lever',
          body: [
            lever.description,
            lever.desired_change ? `Intent: ${lever.desired_change}` : '',
            bindingSummary(lever.binding) ? `Binding: ${bindingSummary(lever.binding)}` : '',
          ].filter(Boolean).join(' | '),
          meta: [
            { label: 'Type', value: lever.lever_type },
            { label: 'Status', value: lever.binding?.status },
          ],
        }))
        : [],
      emptyText: 'No strategic levers are currently shown.',
    },
    {
      title: 'Segment Dimensions',
      cards: Array.isArray(scope.segment_dimensions)
        ? scope.segment_dimensions.map((segment) => ({
          title: segment.label || 'Segment',
          body: [
            segment.segment_role || 'segment',
            bindingSummary(segment.binding) ? `Binding: ${bindingSummary(segment.binding)}` : '',
          ].filter(Boolean).join(' | '),
          meta: [
            { label: 'Role', value: segment.segment_role || 'segment' },
            { label: 'Status', value: segment.binding?.status },
          ],
        }))
        : [],
      emptyText: 'No segmentation dimensions are currently shown.',
    },
    {
      title: 'Guardrails',
      cards: Array.isArray(scope.constraints)
        ? scope.constraints.map((constraint) => ({
          title: constraint.label || 'Guardrail',
          body: [
            constraint.condition?.value_status === 'unparsed'
              ? 'Threshold required: Could not parse numeric limit'
              : (conditionLabel(constraint.condition) ? `Condition: ${conditionLabel(constraint.condition)}` : ''),
            constraint.rationale,
            bindingSummary(constraint.binding) ? `Binding: ${bindingSummary(constraint.binding)}` : '',
          ].filter(Boolean).join(' | '),
          meta: [
            { label: 'Hardness', value: constraint.hardness },
            { label: 'Status', value: constraint.binding?.status },
          ],
        }))
        : [],
      emptyText: 'No guardrails are currently shown.',
    },
    {
      title: 'Scoped Context',
      cards: [
        { title: 'Relevant Metrics', body: listLabels(scopedContext.relevant_metrics).join(' | ') || 'None shown' },
        { title: 'Dimensions And Segments', body: listLabels(scopedContext.relevant_dimensions).join(' | ') || 'None shown' },
        { title: 'Comparison Dimensions', body: listLabels(scopedContext.comparison_dimensions).join(' | ') || 'None shown' },
        { title: 'Temporal Anchoring', body: labelForValue(scopedContext.period_context) || labelForValue(scopedContext.time_context) || 'None shown' },
      ],
    },
    {
      title: 'Assumptions',
      cards: [
        { title: 'Assumptions', body: listLabels(workspace.assumptions).join(' | ') || 'No explicit assumptions shown' },
      ],
    },
    {
      title: 'Information Gaps',
      cards: [
        { title: 'Information Gaps', body: listLabels(workspace.unknowns).join(' | ') || 'No information gaps shown' },
      ],
    },
    {
      title: 'Engine Readiness Checklist',
      cards: readinessChecklistCards(rawReadiness, readiness),
    },
    {
      title: 'Workspace Readiness Architecture',
      cards: [
        { title: 'Objective', body: rawReadiness.objective_ready ? 'Ready' : 'Needs review' },
        { title: 'Levers', body: rawReadiness.lever_ready ? 'Ready' : 'Needs review' },
        { title: 'Guardrails', body: rawReadiness.constraint_ready ? 'Ready' : 'Needs review' },
      ],
    },
    {
      title: 'Capability Matrix',
      cards: readinessCards(readiness, capabilityState),
      items: readiness.allowed_next_actions,
      emptyText: 'No allowed next actions were shown.',
    },
    {
      title: 'Analyze Workspace Area',
      body: readiness.allowed_next_actions?.includes('analyze_workspace')
        ? 'Analyze Workspace is available for observational analysis.'
        : 'Analyze Workspace is disabled until backend readiness allows it.',
    },
  ];

  if (analysis) {
    sections.push({
      title: 'Workspace Analysis Summary',
      keyValues: [
        { label: 'Summary', value: analysis.summary },
        { label: 'Truthfulness Note', value: analysis.truthfulness_note },
      ],
      cards: Array.isArray(analysis.scoped_diagnostics)
        ? analysis.scoped_diagnostics.map((diagnostic) => ({
          title: diagnostic.summary || labelForValue(diagnostic.metric_ref) || 'Scoped Diagnostic',
          body: diagnostic.evidence ? labelForValue(diagnostic.evidence) : '',
          meta: [{ label: 'Status', value: diagnostic.status }],
        }))
        : [],
    });
  }

  return sections;
};

export const generateDecisionArtifactPdf = async ({
  artifact,
  contextCapabilityState,
  contextDecisionReadiness,
}) => {
  if (!artifact) return;

  const content = artifact.content || artifact;
  const typeLabel = readablePdfLabel(artifact.type || 'Decision Result');
  const title = content?.title || content?.summary?.headline || content?.metric?.label || typeLabel;

  const sections = [
    {
      title: 'Visible Result Context',
      keyValues: [
        { label: 'Type', value: typeLabel },
        { label: 'Source', value: artifact.source },
        { label: 'Mode', value: artifact.mode },
      ],
    },
  ];

  if (artifact.type === 'workspace_preview') {
    sections.push(...workspacePreviewSections(content, contextDecisionReadiness || content.decision_readiness || {}, contextCapabilityState || content.capability_state || {}));
  } else if (artifact.type === 'workspace_analysis_summary') {
    sections.push(...analysisSummarySections(content));
  } else if (artifact.type === 'answer') {
    sections.push(...answerSections(content));
  } else if (artifact.type === 'chart') {
    sections.push(...chartSections(content));
  } else {
    sections.push({
      title: 'Artifact Content',
      body: labelForValue(content) || 'This artifact has no compact visible export adapter yet.',
    });
  }

  exportStructuredPdf({
    title: `Decision Intelligence: ${title}`,
    subtitle: typeLabel,
    fileName: 'decision_ai_result',
    footerLabel: 'Decision Intelligence Export',
    sections,
  });
};

export const generateDecisionWorkspacePdf = async ({ workspace, analysis }) => {
  if (!workspace) return;

  exportStructuredPdf({
    title: workspace.title || 'Decision Workspace Export',
    subtitle: workspace.workspace_id || workspace.status,
    fileName: 'decision_workspace_export',
    footerLabel: 'Decision Workspace Export',
    sections: workspaceSections(workspace, analysis),
  });
};
