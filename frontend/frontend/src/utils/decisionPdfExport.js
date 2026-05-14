import { jsPDF } from 'jspdf';

const PAGE = {
  width: 612,
  height: 792,
  marginX: 46,
  marginY: 48,
  lineHeight: 14,
};

const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const MAX_APPENDIX_CHARS = 12000;

const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return Array.from(raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join('')
    .replace(/[ \t]+/g, ' ')
    .trim();
};

const formatTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return sanitizeText(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fileDate = () => new Date().toISOString().slice(0, 10);

const readableKey = (key) => sanitizeText(key)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const labelForRef = (ref) => {
  if (!ref) return '';
  return sanitizeText(ref.label || ref.name || ref.metric_id || ref.dimension_id || ref.field || ref.binding_label);
};

const labelForValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizeText(String(value));
  }
  return sanitizeText(value.label || value.name || value.metric || value.field || value.dimension_id || value.metric_id || value.binding_label || value.statement || value.summary || value.title || JSON.stringify(value));
};

const safeJson = (value) => {
  try {
    const text = sanitizeText(JSON.stringify(value, null, 2));
    return text.length > MAX_APPENDIX_CHARS ? `${text.slice(0, MAX_APPENDIX_CHARS)}\n...truncated for PDF length...` : text;
  } catch (error) {
    return `Unable to serialize export payload: ${error.message}`;
  }
};

const ensureRoom = (pdf, y, spaceNeeded = PAGE.lineHeight) => {
  if (y + spaceNeeded <= PAGE.height - PAGE.marginY) return y;
  pdf.addPage();
  return PAGE.marginY;
};

const writeLines = (pdf, lines, y, fontSize = 10, options = {}) => {
  let nextY = y;
  pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(options.color || 26, options.color || 32, options.color || 44);

  lines.forEach((line) => {
    nextY = ensureRoom(pdf, nextY);
    pdf.text(line, PAGE.marginX + (options.indent || 0), nextY);
    nextY += PAGE.lineHeight;
  });

  pdf.setTextColor(26, 32, 44);
  return nextY;
};

const writeParagraph = (pdf, text, y, fontSize = 10, options = {}) => {
  const safeText = sanitizeText(text);
  if (!safeText) return y;
  const maxWidth = CONTENT_WIDTH - (options.indent || 0);
  const lines = pdf.splitTextToSize(safeText, maxWidth);
  return writeLines(pdf, lines, y, fontSize, options);
};

const writeSection = (pdf, title, y) => {
  let nextY = ensureRoom(pdf, y + 8, 28);
  pdf.setDrawColor(218, 226, 238);
  pdf.setLineWidth(0.7);
  pdf.line(PAGE.marginX, nextY - 11, PAGE.width - PAGE.marginX, nextY - 11);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(16, 33, 58);
  pdf.text(sanitizeText(title), PAGE.marginX, nextY);
  pdf.setTextColor(26, 32, 44);
  return nextY + 18;
};

const writeSubsection = (pdf, title, y) => {
  const nextY = ensureRoom(pdf, y, 18);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(sanitizeText(title), PAGE.marginX, nextY);
  return nextY + 14;
};

const writeKeyValue = (pdf, key, value, y) => {
  const label = sanitizeText(key);
  const text = labelForValue(value);
  if (!text) return y;
  return writeParagraph(pdf, `${label}: ${text}`, y);
};

const writeList = (pdf, items, y, emptyText = 'None recorded.') => {
  if (!Array.isArray(items) || items.length === 0) {
    return writeParagraph(pdf, emptyText, y, 10, { color: 92 });
  }

  let nextY = y;
  items.forEach((item) => {
    nextY = writeParagraph(pdf, `- ${labelForValue(item)}`, nextY);
  });
  return nextY;
};

const writeRef = (pdf, title, ref, y) => {
  if (!ref) return y;
  let nextY = writeSubsection(pdf, title, y);
  nextY = writeKeyValue(pdf, 'Label', labelForRef(ref), nextY);
  nextY = writeKeyValue(pdf, 'Field', ref.field, nextY);
  nextY = writeKeyValue(pdf, 'Aggregation', ref.default_aggregation, nextY);
  nextY = writeKeyValue(pdf, 'Binding confidence', ref.semantic_binding_confidence ?? ref.confidence, nextY);
  nextY = writeKeyValue(pdf, 'Binding reason', ref.semantic_binding_reason ?? ref.reason, nextY);
  nextY = writeList(pdf, ref.semantic_role_warnings || ref.decision_semantics?.unresolved_reasons, nextY, 'No warnings recorded.');
  return nextY + 4;
};

const writeCapabilityState = (pdf, capabilityState, y) => {
  if (!capabilityState || typeof capabilityState !== 'object') return y;
  let nextY = y;
  Object.entries(capabilityState)
    .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
    .forEach(([key, value]) => {
      nextY = writeParagraph(
        pdf,
        `${readableKey(key)}: ${value.status || 'unknown'} - ${value.reason || ''}`,
        nextY
      );
    });
  return nextY;
};

const addFooter = (pdf) => {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(95, 104, 122);
    pdf.text(`Decision Intelligence Export | Page ${i} of ${pageCount}`, PAGE.marginX, PAGE.height - 22);
  }
  pdf.setTextColor(26, 32, 44);
};

const createPdf = (title, subtitle) => {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  let y = PAGE.marginY;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(16, 33, 58);
  pdf.text(sanitizeText(title), PAGE.marginX, y);
  y += 22;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(95, 104, 122);
  pdf.text(`Generated: ${formatTimestamp()}${subtitle ? ` | ${sanitizeText(subtitle)}` : ''}`, PAGE.marginX, y);
  y += 22;
  pdf.setTextColor(26, 32, 44);

  return { pdf, y };
};

const savePdf = (pdf, name) => {
  addFooter(pdf);
  pdf.save(`${name}_${fileDate()}.pdf`);
};

const writeWorkspacePreview = (pdf, wp, y) => {
  let nextY = writeSection(pdf, 'Decision Workspace Preview', y);
  nextY = writeKeyValue(pdf, 'Title', wp.title, nextY);
  nextY = writeKeyValue(pdf, 'Status', wp.status_label || wp.status, nextY);
  nextY = writeKeyValue(pdf, 'Summary', wp.decision_kickoff?.summary || wp.scope_summary || wp.summary, nextY);
  nextY = writeKeyValue(pdf, 'Objective', wp.objective_metric, nextY);
  nextY = writeKeyValue(pdf, 'Time horizon', wp.time_horizon, nextY);

  nextY = writeSubsection(pdf, 'Levers', nextY + 4);
  nextY = writeList(pdf, wp.levers, nextY);
  nextY = writeSubsection(pdf, 'Segments', nextY + 4);
  nextY = writeList(pdf, wp.segment_dimensions, nextY);
  nextY = writeSubsection(pdf, 'Guardrails', nextY + 4);
  nextY = writeList(pdf, wp.guardrails, nextY);

  const unresolved = wp.drafting?.prompt_matches?.unresolved_mappings || wp.unresolved_mappings || [];
  nextY = writeSubsection(pdf, 'Unresolved Semantic Mappings', nextY + 4);
  if (!unresolved.length) {
    nextY = writeParagraph(pdf, 'No unresolved mappings were reported.', nextY, 10, { color: 92 });
  } else {
    unresolved.forEach((mapping) => {
      const candidates = Array.isArray(mapping.candidate_labels) ? mapping.candidate_labels.join(', ') : '';
      nextY = writeParagraph(
        pdf,
        `- ${mapping.mapping_type || 'mapping'}: ${mapping.term || mapping.label || mapping.field || 'unknown'} | ${mapping.reason || 'No reason provided.'}${candidates ? ` | Candidates: ${candidates}` : ''}`,
        nextY
      );
    });
  }

  nextY = writeSection(pdf, 'Readiness And Capability Boundary', nextY + 6);
  const readiness = wp.decision_readiness || wp.readiness || {};
  nextY = writeKeyValue(pdf, 'Readiness state', readiness.readiness_state || wp.readiness_state, nextY);
  nextY = writeKeyValue(pdf, 'Truth boundary', readiness.truth_boundary || wp.truth_boundary, nextY);
  nextY = writeList(pdf, readiness.allowed_next_actions || wp.allowed_next_actions, nextY, 'No backend-approved next actions were reported.');
  nextY = writeCapabilityState(pdf, wp.capability_state || readiness.capability_state, nextY + 4);

  return nextY;
};

const writeAnalysisSummary = (pdf, content, y) => {
  let nextY = writeSection(pdf, 'Workspace Analysis Summary', y);
  nextY = writeKeyValue(pdf, 'Headline', content?.summary?.headline || content?.headline, nextY);
  nextY = writeKeyValue(pdf, 'Summary', content?.summary?.content || content?.summary, nextY);
  nextY = writeKeyValue(pdf, 'Truthfulness note', content?.truthfulness_note, nextY);

  nextY = writeSubsection(pdf, 'Diagnostic Items', nextY + 4);
  if (Array.isArray(content?.items) && content.items.length > 0) {
    content.items.forEach((item, index) => {
      const label = labelForValue(item.label || item.statement || item.headline || item.title || item);
      const detail = item.description || item.summary || item.reason || item.category;
      nextY = writeParagraph(pdf, `${index + 1}. ${label}${detail ? ` - ${detail}` : ''}`, nextY);
    });
  } else {
    nextY = writeParagraph(pdf, 'No diagnostic details were reported.', nextY, 10, { color: 92 });
  }

  nextY = writeSubsection(pdf, 'Missing Inputs', nextY + 4);
  nextY = writeList(pdf, content?.missing_inputs, nextY, 'No missing inputs reported.');
  return nextY;
};

const writeAnswerArtifact = (pdf, content, y) => {
  let nextY = writeSection(pdf, 'Grounded Data Result', y);
  nextY = writeKeyValue(pdf, 'Metric', content?.metric?.label || content?.metric?.name || content?.fieldsUsed?.value, nextY);
  nextY = writeKeyValue(pdf, 'Summary value', content?.summary?.value_formatted || content?.summary?.value, nextY);
  nextY = writeKeyValue(pdf, 'Top result', content?.top_group?.label, nextY);
  nextY = writeKeyValue(pdf, 'Message', content?.message, nextY);

  if (Array.isArray(content?.rows) && content.rows.length > 0) {
    nextY = writeSubsection(pdf, 'Rows', nextY + 4);
    content.rows.slice(0, 40).forEach((row) => {
      const label = row.group_label || (row.group ? Object.values(row.group).join(' | ') : 'Segment');
      nextY = writeParagraph(pdf, `- ${label}: ${row.value_formatted || row.value}`, nextY);
    });
  }
  return nextY;
};

const writeChartArtifact = (pdf, content, y) => {
  let nextY = writeSection(pdf, 'Chart Result', y);
  nextY = writeKeyValue(pdf, 'Chart type', content?.chartType, nextY);
  nextY = writeKeyValue(pdf, 'Explanation', content?.explanation, nextY);

  const chartData = content?.chartData;
  if (Array.isArray(chartData?.labels) && Array.isArray(chartData?.datasets)) {
    nextY = writeSubsection(pdf, 'Chart Data', nextY + 4);
    const firstDataset = chartData.datasets[0] || {};
    chartData.labels.slice(0, 60).forEach((label, index) => {
      nextY = writeParagraph(pdf, `- ${label}: ${firstDataset.data?.[index] ?? ''}`, nextY);
    });
  }
  return nextY;
};

export const generateDecisionArtifactPdf = ({
  artifact,
  contextSessionState,
  contextCapabilityState,
  contextDecisionReadiness,
}) => {
  if (!artifact) return;

  const { pdf, y: startY } = createPdf('Decision Intelligence Result', artifact.type || 'artifact');
  let y = startY;
  const content = artifact.content || artifact;

  y = writeSection(pdf, 'Artifact Metadata', y);
  y = writeKeyValue(pdf, 'Type', artifact.type, y);
  y = writeKeyValue(pdf, 'Source', artifact.source, y);
  y = writeKeyValue(pdf, 'Mode', artifact.mode, y);

  if (artifact.type === 'workspace_preview') {
    y = writeWorkspacePreview(pdf, content, y + 4);
  } else if (artifact.type === 'workspace_analysis_summary') {
    y = writeAnalysisSummary(pdf, content, y + 4);
  } else if (artifact.type === 'answer') {
    y = writeAnswerArtifact(pdf, content, y + 4);
  } else if (artifact.type === 'chart') {
    y = writeChartArtifact(pdf, content, y + 4);
  } else {
    y = writeSection(pdf, 'Artifact Content', y + 4);
    y = writeParagraph(pdf, safeJson(content), y, 8.5);
  }

  const responseState = {
    contextSessionState,
    contextCapabilityState,
    contextDecisionReadiness,
  };
  y = writeSection(pdf, 'Raw Contract Snapshot', y + 6);
  writeParagraph(pdf, safeJson({ artifact, responseState }), y, 8.2);

  savePdf(pdf, 'decision_ai_result');
};

export const generateDecisionWorkspacePdf = ({ workspace, analysis }) => {
  if (!workspace) return;

  const { pdf, y: startY } = createPdf('Decision Workspace Export', workspace.workspace_id || workspace.status);
  let y = startY;

  y = writeSection(pdf, 'Workspace Overview', y);
  y = writeKeyValue(pdf, 'Title', workspace.title || 'Untitled Decision Workspace', y);
  y = writeKeyValue(pdf, 'Workspace ID', workspace.workspace_id, y);
  y = writeKeyValue(pdf, 'Status', workspace.status, y);
  y = writeKeyValue(pdf, 'Prepared', formatTimestamp(workspace.created_at), y);
  y = writeKeyValue(pdf, 'Decision prompt', workspace.decision_prompt, y);
  y = writeKeyValue(pdf, 'Scope summary', workspace.scope_summary, y);

  const scope = workspace.decision_scope || {};
  const objective = scope.objective || {};
  y = writeSection(pdf, 'Success Objective', y + 4);
  y = writeKeyValue(pdf, 'Statement', objective.statement, y);
  y = writeKeyValue(pdf, 'Direction', objective.direction, y);
  y = writeKeyValue(pdf, 'Target', objective.target, y);
  y = writeKeyValue(pdf, 'Time horizon', objective.time_horizon?.label || objective.time_horizon, y);
  y = writeRef(pdf, 'Objective Metric', objective.metric_ref, y + 4);

  y = writeSection(pdf, 'Strategic Levers', y + 4);
  if (Array.isArray(scope.levers) && scope.levers.length > 0) {
    scope.levers.forEach((lever, index) => {
      y = writeSubsection(pdf, `${index + 1}. ${lever.label || 'Lever'}`, y);
      y = writeKeyValue(pdf, 'Type', lever.lever_type, y);
      y = writeKeyValue(pdf, 'Description', lever.description, y);
      y = writeKeyValue(pdf, 'Desired change', lever.desired_change, y);
      y = writeKeyValue(pdf, 'Binding status', lever.binding?.status, y);
      y = writeRef(pdf, 'Binding', lever.binding?.metric_ref || lever.binding?.dimension_ref, y + 2);
    });
  } else {
    y = writeParagraph(pdf, 'No strategic levers are currently defined.', y, 10, { color: 92 });
  }

  y = writeSection(pdf, 'Guardrails', y + 4);
  if (Array.isArray(scope.constraints) && scope.constraints.length > 0) {
    scope.constraints.forEach((constraint, index) => {
      y = writeSubsection(pdf, `${index + 1}. ${constraint.label || 'Guardrail'}`, y);
      y = writeKeyValue(pdf, 'Hardness', constraint.hardness, y);
      y = writeKeyValue(pdf, 'Condition', constraint.condition, y);
      y = writeKeyValue(pdf, 'Rationale', constraint.rationale, y);
      y = writeKeyValue(pdf, 'Binding status', constraint.binding?.status, y);
      y = writeRef(pdf, 'Binding', constraint.binding?.metric_ref || constraint.binding?.dimension_ref, y + 2);
    });
  } else {
    y = writeParagraph(pdf, 'No guardrails are currently defined.', y, 10, { color: 92 });
  }

  const scopedContext = workspace.scoped_context || {};
  y = writeSection(pdf, 'Scoped Context', y + 4);
  y = writeSubsection(pdf, 'Relevant Metrics', y);
  y = writeList(pdf, scopedContext.relevant_metrics, y, 'No relevant metrics recorded.');
  y = writeSubsection(pdf, 'Relevant Dimensions', y + 4);
  y = writeList(pdf, scopedContext.relevant_dimensions, y, 'No relevant dimensions recorded.');
  y = writeSubsection(pdf, 'Comparison Dimensions', y + 4);
  y = writeList(pdf, scopedContext.comparison_dimensions, y, 'No comparison dimensions recorded.');
  y = writeKeyValue(pdf, 'Time context', scopedContext.time_context, y + 4);
  y = writeKeyValue(pdf, 'Period context', scopedContext.period_context, y);

  y = writeSection(pdf, 'Assumptions And Information Gaps', y + 4);
  y = writeSubsection(pdf, 'Assumptions', y);
  y = writeList(pdf, workspace.assumptions, y, 'No assumptions recorded.');
  y = writeSubsection(pdf, 'Information Gaps', y + 4);
  y = writeList(pdf, workspace.unknowns, y, 'No information gaps recorded.');

  const readiness = workspace.decision_readiness || workspace.readiness || {};
  y = writeSection(pdf, 'Readiness And Capabilities', y + 4);
  y = writeKeyValue(pdf, 'Readiness state', readiness.readiness_state || workspace.status, y);
  y = writeKeyValue(pdf, 'Truth boundary', readiness.truth_boundary, y);
  y = writeList(pdf, readiness.allowed_next_actions, y, 'No allowed next actions recorded.');
  y = writeCapabilityState(pdf, readiness.capability_state || workspace.readiness?.capability_state, y + 4);

  if (analysis) {
    y = writeSection(pdf, 'Analysis Results', y + 4);
    y = writeKeyValue(pdf, 'Summary', analysis.summary, y);
    y = writeKeyValue(pdf, 'Truthfulness note', analysis.truthfulness_note, y);
    y = writeSubsection(pdf, 'Scoped Diagnostics', y + 4);
    if (Array.isArray(analysis.scoped_diagnostics) && analysis.scoped_diagnostics.length > 0) {
      analysis.scoped_diagnostics.forEach((diagnostic, index) => {
        y = writeParagraph(pdf, `${index + 1}. ${diagnostic.summary || labelForValue(diagnostic)}`, y);
        y = writeKeyValue(pdf, 'Status', diagnostic.status, y);
        y = writeKeyValue(pdf, 'Evidence', diagnostic.evidence, y);
      });
    } else {
      y = writeParagraph(pdf, labelForValue(analysis.scoped_diagnostics) || 'No scoped diagnostics were generated.', y, 10, { color: 92 });
    }
  }

  y = writeSection(pdf, 'Raw Contract Snapshot', y + 6);
  writeParagraph(pdf, safeJson({ workspace, analysis }), y, 8.2);

  savePdf(pdf, 'decision_workspace_export');
};
