import React from 'react';
import Typography from '@mui/material/Typography';
import {
  FaCircleCheck, FaCircleExclamation, FaTriangleExclamation, FaCircleInfo,
  FaGears, FaShieldHalved, FaChartLine, FaLayerGroup, FaPlus, FaCalendarDays, FaFileLines, FaClock,
  FaMagnifyingGlassChart, FaFlask, FaScaleBalanced, FaLightbulb, FaBrain, FaFilePdf
} from 'react-icons/fa6';
import './DecisionWorkspace.css';
import DecisionSignals from './DecisionSignals';
import DecisionRecommendations from './DecisionRecommendations';
import SemanticRef from './SemanticRef';
import { generateDecisionWorkspacePdf } from '../../../utils/decisionPdfExport';

/**
 * ScopedDiagnosticCard
 *
 * Renders a single structured diagnostic item from the workspace analysis.
 * Follows the DI 2.0 V3 contract for truthful, scoped observational diagnostics.
 */
const ScopedDiagnosticCard = ({ diagnostic }) => {
  const { summary, metric_ref, status, evidence } = diagnostic;

  const getStatusConfig = () => {
    switch (status) {
      case 'observed_change':
        return {
          icon: <FaChartLine style={{ color: 'var(--accent-blue)' }} />,
          badgeClass: 'status-badge--info',
          label: 'Observed Change'
        };
      case 'insufficient_history':
        return {
          icon: <FaTriangleExclamation style={{ color: '#f59e0b' }} />,
          badgeClass: 'status-badge--warning',
          label: 'Insufficient History'
        };
      case 'metric_unavailable':
        return {
          icon: <FaCircleExclamation style={{ color: '#ef4444' }} />,
          badgeClass: 'status-badge--critical',
          label: 'Metric Unavailable'
        };
      default:
        return {
          icon: <FaCircleInfo style={{ color: 'var(--accent-blue)' }} />,
          badgeClass: 'status-badge--info',
          label: status
        };
    }
  };

  const config = getStatusConfig();

  const renderEvidence = () => {
    if (status !== 'observed_change' || !evidence) return null;

    const { delta_pct, current_value, previous_value, delta_value } = evidence;
    const isPositive = (delta_value || 0) > 0;

    return (
      <div className="diagnostic-evidence">
        <div className="evidence-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
          <div className="evidence-stat">
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Current</label>
            <span style={{ fontWeight: 700 }}>{typeof current_value === 'number' ? current_value.toLocaleString() : current_value}</span>
          </div>
          <div className="evidence-stat">
            <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Previous</label>
            <span style={{ fontWeight: 700 }}>{typeof previous_value === 'number' ? previous_value.toLocaleString() : previous_value}</span>
          </div>
          {delta_pct !== undefined && (
            <div className="evidence-stat">
              <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Change</label>
              <span style={{ fontWeight: 900, color: isPositive ? 'var(--accent-green)' : '#ef4444' }}>
                {isPositive ? '+' : ''}{(delta_pct * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`scoped-diagnostic-card status--${status === 'observed_change' ? 'info' : status === 'insufficient_history' ? 'warning' : 'critical'}`}>
      <div className="diagnostic-header">
        <div className="diagnostic-status-icon">{config.icon}</div>
        <div className="diagnostic-metric-label">
          {metric_ref ? <SemanticRef metric_ref={metric_ref} type="diagnostic" compact /> : 'Workspace Observation'}
        </div>
        <div className={`diagnostic-status-badge ${config.badgeClass}`}>{config.label}</div>
      </div>
      <div className="diagnostic-summary">{summary}</div>
      {renderEvidence()}
    </div>
  );
};

/**
 * DecisionWorkspaceView
 *
 * High-fidelity "Decision Brief" rendering for DI 2.0 V1/V3.
 * Emphasizes the strategic framing over raw data schema.
 */
const DecisionWorkspaceView = ({ workspace, analysis, onCreateNew, onAnalyze, setIsDataPaneOpen }) => {
  const workspaceExportRef = React.useRef(null);

  if (!workspace) return null;

  const {
    workspace_id,
    title,
    decision_prompt,
    status,
    decision_scope,
    scope_summary,
    scoped_context,
    assumptions,
    unknowns,
    readiness,
    decision_readiness,
    created_at
  } = workspace;

  const dr = decision_readiness || readiness?.decision_readiness || readiness;
  const cs = dr?.capability_state || readiness?.capability_state;

  const handleExportWorkspacePdf = () => {
    generateDecisionWorkspacePdf({ workspace, analysis, sourceElement: workspaceExportRef.current });
  };

  const renderStatusBadge = () => {
    const currentState = dr?.readiness_state || status;
    switch (currentState) {
      case 'analysis_ready':
      case 'ready':
        return <span className="workspace-status workspace-status--ready"><FaCircleCheck /> Analysis Ready</span>;
      case 'blocked':
      case 'needs_input':
        return <span className="workspace-status workspace-status--needs-input"><FaCircleExclamation /> Definition Incomplete</span>;
      case 'limited':
        return <span className="workspace-status workspace-status--limited"><FaTriangleExclamation /> Structurally Limited</span>;
      case 'analyzed':
        return <span className="workspace-status workspace-status--analyzed" style={{ background: 'var(--accent-blue)', color: 'white' }}><FaMagnifyingGlassChart /> Analysis Complete</span>;
      default:
        return <span className="workspace-status">{currentState.replace('_', ' ')}</span>;
    }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className={`workspace-view workspace-view--${status}`} ref={workspaceExportRef}>
      <div className="workspace-header">
        <div className="header-top">
          <div className="status-group">
            {renderStatusBadge()}
            <span className="workspace-id">ID: {workspace_id.slice(-8)}</span>
          </div>
          <div className="header-actions">
            <button
              className="decision-export-btn"
              onClick={handleExportWorkspacePdf}
              aria-label="Export decision workspace as PDF"
              title="Export decision workspace as PDF"
            >
              <FaFilePdf /> Export PDF
            </button>
            <button className="add-btn" onClick={onCreateNew}>
              <FaPlus /> New Decision
            </button>
            <span className="contract-version">DI 2.0 v1.1 • Reliability Phase 1</span>
          </div>
        </div>
        <h2 className="workspace-title">{title || "Untitled Decision Workspace"}</h2>
        <div className="workspace-prompt">
          <FaCircleInfo className="summary-icon" />
          <span>"{decision_prompt}"</span>
        </div>
        <div className="workspace-timestamp">
          <FaCalendarDays /> Prepared: {formatDate(created_at)}
        </div>
      </div>

      {dr?.truth_boundary === 'observational_analysis_only' && (
        <div className="workspace-boundary-banner" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0, 102, 255, 0.05)', border: '1px solid var(--accent-blue)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <FaShieldHalved style={{ fontSize: '1.5rem', color: 'var(--accent-blue)' }} />
          <div>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observational Reliability Boundary</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              This workspace is currently restricted to <strong>observational analysis</strong>. Simulation, optimization, and autonomous decisioning are disabled in this runtime to ensure output integrity.
            </Typography>
          </div>
        </div>
      )}

      <div className="workspace-summary">
        <FaFileLines className="summary-icon" />
        <p>{scope_summary}</p>
      </div>

      <div className="workspace-grid">
        {/* Primary Scope: Objective, Levers, Constraints */}
        <div className="workspace-column main-scope">
          <section className="scope-section">
            <h3 className="section-label"><FaChartLine /> Success Objective</h3>
            <div className="objective-card">
              <p className="objective-statement">{decision_scope.objective.statement}</p>
              <div className="objective-details">
                <div className="detail-item">
                  <label>Direction</label>
                  <span>{decision_scope.objective.direction}</span>
                </div>
                {decision_scope.objective.target && (
                  <div className="detail-item">
                    <label>Target</label>
                    <span>
                      {decision_scope.objective.target.operator} {decision_scope.objective.target.value}
                      {decision_scope.objective.target.secondary_value && ` to ${decision_scope.objective.target.secondary_value}`}
                      {' '}{decision_scope.objective.target.unit}
                    </span>
                  </div>
                )}
                <div className="detail-item">
                  <label>Horizon</label>
                  <span>
                    {decision_scope.objective.time_horizon?.label}
                    {decision_scope.objective.time_horizon?.grain && ` (${decision_scope.objective.time_horizon.grain})`}
                  </span>
                </div>
              </div>
              {(decision_scope.objective.time_horizon?.start || decision_scope.objective.time_horizon?.end) && (
                <div className="horizon-range">
                  <FaClock /> Range: {decision_scope.objective.time_horizon.start || '...'} to {decision_scope.objective.time_horizon.end || '...'}
                </div>
              )}
              {decision_scope.objective.metric_ref ? (
                <div className="binding-resolved" style={{ marginTop: '20px' }}>
                  <SemanticRef metric_ref={decision_scope.objective.metric_ref} type="objective" />
                </div>
              ) : (
                <div className="binding-unresolved" style={{ marginTop: '20px' }}>
                  <SemanticRef type="unresolved" metric_ref={{ label: decision_scope.objective.reason || "Manual ID entry required" }} />
                </div>
              )}
            </div>
          </section>

          <section className="scope-section">
            <h3 className="section-label" style={{ marginTop: '32px' }}><FaGears /> Strategic Levers</h3>
            <div className="levers-list">
              {decision_scope.levers.map((lever, idx) => (
                <div key={lever.lever_id || idx} className="lever-card">
                  <div className="lever-header">
                    <span className="lever-label">{lever.label}</span>
                    <span className="lever-type">{lever.lever_type}</span>
                  </div>
                  {lever.description && <p className="item-description">{lever.description}</p>}

                  <div className="lever-meta">
                    {lever.desired_change && (
                      <span className="intent-tag">Intent: {lever.desired_change}</span>
                    )}
                    {lever.current_value !== null && (
                      <span className="current-tag">Current Baseline: {lever.current_value}</span>
                    )}
                    {lever.bounds && (
                      <span className="bounds-tag">
                        Operational Bounds: {lever.bounds.min_value ?? '-∞'} to {lever.bounds.max_value ?? '+∞'} {lever.bounds.unit}
                      </span>
                    )}
                  </div>

                  {lever.binding && lever.binding.status !== 'unresolved' ? (
                    <div className="binding-resolved">
                      <SemanticRef
                        metric_ref={lever.binding.metric_ref}
                        dimension_ref={lever.binding.dimension_ref}
                        type="lever"
                      />
                    </div>
                  ) : (
                    <div className="binding-unresolved">
                      <SemanticRef
                        type="unresolved"
                        metric_ref={{ label: lever.binding?.binding_label || lever.label || "Unresolved Lever Binding" }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {decision_scope.levers.length === 0 && <div className="analysis-notice">No controllable levers defined for this decision.</div>}
            </div>
          </section>

          <section className="scope-section">
            <h3 className="section-label" style={{ marginTop: '32px' }}><FaShieldHalved /> Guardrails</h3>
            <div className="constraints-list">
              {decision_scope.constraints.map((constraint, idx) => (
                <div key={constraint.constraint_id || idx} className="constraint-card">
                  <div className="constraint-header">
                    <span className="constraint-label">{constraint.label}</span>
                    <span className={`constraint-hardness hardness--${constraint.hardness}`}>
                      {constraint.hardness} Limit
                    </span>
                  </div>
                  {constraint.rationale && (
                    <div className="rationale-box">
                      <FaCircleInfo style={{ marginRight: '8px', opacity: 0.7 }} />
                      <strong>Constraint Rationale:</strong> {constraint.rationale}
                    </div>
                  )}

                  <div className="constraint-rule">
                    Condition: {constraint.condition.operator} {constraint.condition.value}
                    {constraint.condition.secondary_value && ` and ${constraint.condition.secondary_value}`}
                    {constraint.condition.values && ` [${constraint.condition.values.join(', ')}]`}
                    {' '}{constraint.condition.unit}
                  </div>

                  {constraint.binding && constraint.binding.status !== 'unresolved' ? (
                    <div className="binding-resolved">
                      <SemanticRef
                        metric_ref={constraint.binding.metric_ref}
                        dimension_ref={constraint.binding.dimension_ref}
                        type="guardrail"
                      />
                    </div>
                  ) : (
                    <div className="binding-unresolved">
                      <SemanticRef
                        type="unresolved"
                        metric_ref={{ label: constraint.binding?.binding_label || constraint.label || "Unresolved Guardrail Binding" }}
                      />
                    </div>
                  )}
                </div>
              ))}
              {decision_scope.constraints.length === 0 && <div className="analysis-notice">No active guardrails or constraints applied.</div>}
            </div>
          </section>
        </div>

        {/* Side Panel: Context, Assumptions, Unknowns */}
        <div className="workspace-column side-context">
          <section className="context-section">
            <h3 className="section-label"><FaLayerGroup /> Scoped Context</h3>
            <div className="context-card">
              <div className="context-group">
                <label>Relevant Metrics</label>
                <div className="tag-cloud" style={{ gap: '12px' }}>
                  {scoped_context.relevant_metrics.map(m => (
                    <SemanticRef key={m.metric_id} metric_ref={m} type="relevant" compact />
                  ))}
                </div>
              </div>
              <div className="context-group">
                <label>Dimensions & Segments</label>
                <div className="tag-cloud" style={{ gap: '12px' }}>
                  {scoped_context.relevant_dimensions.map(d => (
                    <SemanticRef key={d.dimension_id} dimension_ref={d} type="relevant" compact />
                  ))}
                  {scoped_context.comparison_dimensions?.map(d => (
                    <SemanticRef key={`comp-${d.dimension_id}`} dimension_ref={d} type="comparison" compact />
                  ))}
                </div>
              </div>

              {scoped_context.applied_filters?.length > 0 && (
                <div className="context-group">
                  <label>Active Slice Filters</label>
                  <div className="filters-list--compact">
                    {scoped_context.applied_filters.map((f, i) => (
                      <div key={i} className="filter-tag">
                        {f.field} {f.operator} {f.value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(scoped_context.time_context || scoped_context.period_context) && (
                <div className="context-group">
                  <label>Temporal Anchoring</label>
                  <div className="temporal-info">
                    {scoped_context.period_context && (
                      <div className="period-label">
                        {scoped_context.period_context.label}
                        <span style={{ opacity: 0.5, fontWeight: 500, margin: '0 8px' }}>vs</span>
                        {scoped_context.period_context.comparison_label}
                      </div>
                    )}
                    {scoped_context.time_context && (
                      <div className="time-details">
                        Temporal dimension: <strong>{scoped_context.time_context.field}</strong> ({scoped_context.time_context.grain})
                      </div>
                    )}
                  </div>
                </div>
              )}

              {scoped_context.notes && scoped_context.notes.length > 0 && (
                <div className="context-group">
                  <label>Scoping Intelligence</label>
                  <ul className="scoping-notes">
                    {scoped_context.notes.map((note, i) => <li key={i}>{note}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="context-section">
            <h3 className="section-label" style={{ marginTop: '24px' }}>Assumptions</h3>
            <div className="assumptions-list">
              {assumptions.map(a => (
                <div key={a.assumption_id} className="assumption-item" style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div className="assumption-label" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.label}</div>
                  <div className={`assumption-meta materiality--${a.materiality}`} style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7, textTransform: 'uppercase', fontWeight: 800 }}>
                    {a.category} • {a.materiality} materiality
                  </div>
                </div>
              ))}
              {assumptions.length === 0 && <div className="analysis-notice" style={{ padding: '12px', fontSize: '0.85rem' }}>No explicit assumptions recorded.</div>}
            </div>
          </section>

          <section className="context-section">
            <h3 className="section-label" style={{ marginTop: '24px' }}>Information Gaps</h3>
            <div className="unknowns-list">
              {unknowns.map(u => (
                <div key={u.unknown_id} className="unknown-item" style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div className="unknown-label" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.label}</div>
                  <div className={`unknown-meta severity--${u.severity}`} style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7, textTransform: 'uppercase', fontWeight: 800 }}>
                    {u.category} • {u.severity} severity
                    {(u.blocks_simulation || dr?.blocked_state?.blocking_unknown_ids?.includes(u.unknown_id)) && <span className="blocker-badge" style={{ marginLeft: '8px', color: '#ef4444' }}>[BLOCKER]</span>}
                  </div>
                </div>
              ))}
              {unknowns.length === 0 && <div className="analysis-notice" style={{ padding: '12px', fontSize: '0.85rem' }}>All required information resolved.</div>}
            </div>
          </section>

          <section className="context-section di-checklist-section" style={{ marginTop: '32px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h3 className="section-label" style={{ margin: '0 0 16px 0', fontSize: '0.85rem', letterSpacing: '0.05em' }}>Engine Readiness Checklist</h3>
            <ul className="di-checklist" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                <FaCircleCheck style={{ color: (readiness.dataset_ready || dr?.structural_readiness?.ready_for_observational_analysis) ? 'var(--accent-green)' : 'var(--text-secondary)', opacity: (readiness.dataset_ready || dr?.structural_readiness?.ready_for_observational_analysis) ? 1 : 0.3 }} />
                <span style={{ opacity: readiness.dataset_ready ? 1 : 0.6 }}>Data Context Loaded</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                <FaCircleCheck style={{ color: readiness.semantic_ready ? 'var(--accent-green)' : 'var(--text-secondary)', opacity: readiness.semantic_ready ? 1 : 0.3 }} />
                <span style={{ opacity: readiness.semantic_ready ? 1 : 0.6 }}>Semantic Logic Active</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                <FaCircleCheck style={{ color: readiness.objective_ready ? 'var(--accent-green)' : 'var(--text-secondary)', opacity: readiness.objective_ready ? 1 : 0.3 }} />
                <span style={{ opacity: readiness.objective_ready ? 1 : 0.6 }}>Business Goals Defined</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                <FaCircleCheck style={{ color: dr?.structural_readiness?.ready_for_observational_analysis ? 'var(--accent-green)' : 'var(--text-secondary)', opacity: dr?.structural_readiness?.ready_for_observational_analysis ? 1 : 0.3 }} />
                <span style={{ opacity: dr?.structural_readiness?.ready_for_observational_analysis ? 1 : 0.6 }}>Structural Integrity Verified</span>
              </li>
            </ul>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent)' }}>
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '8px' }}>How it works</h4>
              <p style={{ fontSize: '0.8rem', lineHeight: '1.5', margin: 0, opacity: 0.8 }}>
                The engine evaluates recent signals against your defined metrics,
                detects cross-field trends, and surfaces observational analysis based on statistical importance.
              </p>
            </div>
          </section>
        </div>
      </div>

      <div className="workspace-footer" style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--border-color)' }}>
        <div className="readiness-panel">
          <div className="readiness-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.1em' }}>Workspace Readiness Architecture</label>
            <div className="readiness-indicators">
              <span className={`indicator ${readiness.objective_ready ? 'is-ready' : 'not-ready'}`}>Objective</span>
              <span className={`indicator ${readiness.lever_ready ? 'is-ready' : 'not-ready'}`}>Levers</span>
              <span className={`indicator ${readiness.constraint_ready ? 'is-ready' : 'not-ready'}`}>Guardrails</span>
            </div>
          </div>

          {(dr?.blocked_state?.is_blocked || readiness.missing_inputs?.length > 0) && (
            <div className="missing-inputs" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FaCircleExclamation />
                <div>
                  <strong>Action Required:</strong> The workspace definition is missing high-materiality inputs: {dr?.blocked_state?.blocking_missing_inputs?.join(', ') || readiness.missing_inputs.join(', ')}
                </div>
              </div>
              <div style={{ paddingLeft: '32px' }}>
                <Typography variant="caption" sx={{ opacity: 0.8, cursor: 'pointer', textDecoration: 'underline', '&:hover': { opacity: 1 } }} onClick={() => setIsDataPaneOpen(true)}>
                  Review semantic definitions to resolve bindings
                </Typography>
              </div>
            </div>
          )}

          <div className="capability-matrix" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div className={`capability-tag ${cs?.observational_analysis?.available ? 'is-allowed' : 'is-blocked'}`}>
              <FaMagnifyingGlassChart /> Observational Analysis: {cs?.observational_analysis?.status || (dr?.structural_readiness?.ready_for_observational_analysis ? 'allowed' : 'blocked')}
            </div>
            <div className={`capability-tag is-unsupported`}>
              <FaFlask /> Causal Simulation: {cs?.simulation?.status || 'unsupported'}
            </div>
            <div className={`capability-tag is-unsupported`}>
              <FaScaleBalanced /> Optimization: {cs?.optimization?.status || 'unsupported'}
            </div>
            <div className={`capability-tag is-unsupported`}>
              <FaBrain /> Autonomous: {cs?.autonomous_decisioning?.status || 'unsupported'}
            </div>
          </div>

          {dr?.truth_boundary === 'observational_analysis_only' && (
            <div className="analysis-notice" style={{ marginTop: '16px' }}>
              <FaTriangleExclamation /> This decision frame is limited to <strong>observational analysis</strong>. Causal simulation and recommendation engines are currently unsupported.
            </div>
          )}

          {(dr?.structural_readiness?.ready_for_observational_analysis || (readiness.can_run_simulation && !analysis)) && (
            <div className="analysis-notice" style={{ background: 'color-mix(in srgb, var(--accent-green) 5%, var(--bg-primary))', borderColor: 'var(--accent-green)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <div>
                <FaCircleCheck /> Decision architecture is structurally sound. Ready for observational analysis.
              </div>
              <button
                className="analyze-workspace-btn"
                onClick={onAnalyze}
                data-pdf-keep="true"
                disabled={dr?.allowed_next_actions && !dr.allowed_next_actions.includes('analyze_workspace')}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent-green)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (dr?.allowed_next_actions && !dr.allowed_next_actions.includes('analyze_workspace')) ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (dr?.allowed_next_actions && !dr.allowed_next_actions.includes('analyze_workspace')) ? 0.5 : 1
                }}
              >
                <FaMagnifyingGlassChart /> Analyze Workspace
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Results Area (DI 2.0 V3) */}
      {analysis && (
        <div className="workspace-analysis-results" style={{ marginTop: '40px', paddingTop: '40px', borderTop: '2px solid var(--accent-blue)' }}>
          <div className="analysis-header" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <FaMagnifyingGlassChart style={{ fontSize: '1.5rem', color: 'var(--accent-blue)' }} />
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Workspace Analysis Summary</h3>
            </div>
            <p className="analysis-summary" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', opacity: 0.9 }}>
              {analysis.summary}
            </p>
            <div className="truthfulness-note" style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-blue)', borderRadius: '4px', fontSize: '0.85rem', fontStyle: 'italic', marginTop: '16px' }}>
              <FaCircleInfo style={{ marginRight: '8px', color: 'var(--accent-blue)' }} />
              {analysis.truthfulness_note}
            </div>
          </div>

          <div className="analysis-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
            {/* Scoped Diagnostics: Primary Area */}
            <section className="analysis-section--primary">
              <h4 className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)' }}>
                <FaFlask /> Scoped Diagnostics
              </h4>

              <div className="scoped-diagnostics-list">
                {Array.isArray(analysis.scoped_diagnostics) ? (
                  analysis.scoped_diagnostics.map((diag, idx) => (
                    <ScopedDiagnosticCard key={idx} diagnostic={diag} />
                  ))
                ) : (
                  <div className="scoped-diagnostic-card status--info">
                    <p style={{ margin: 0, fontSize: '1rem', lineHeight: '1.6' }}>{analysis.scoped_diagnostics}</p>
                  </div>
                )}
                {(!analysis.scoped_diagnostics || analysis.scoped_diagnostics.length === 0) && (
                  <div className="analysis-notice">
                    No scoped diagnostics were generated for this workspace.
                  </div>
                )}
              </div>
            </section>

            {/* Legacy Signals: Secondary Area */}
            {analysis.legacy_diagnostics?.signals && (
              <section className="analysis-section--secondary" style={{ marginTop: '16px', opacity: 0.85 }}>
                <h4 className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', opacity: 0.7 }}>
                  <FaScaleBalanced /> Supporting Observational Evidence (Legacy)
                </h4>
                <div style={{ pointerEvents: 'auto' }}>
                  <DecisionSignals signals={analysis.legacy_diagnostics.signals} />
                </div>
              </section>
            )}

            {/* Recommendations if present in legacy */}
            {analysis.legacy_diagnostics?.recommendations && (
              <section className="analysis-section--recommendations" style={{ marginTop: '16px' }}>
                <h4 className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaLightbulb style={{ color: 'var(--accent-yellow)' }} /> Strategic Recommendations
                </h4>
                <DecisionRecommendations recommendations={analysis.legacy_diagnostics.recommendations} />
              </section>
            )}
          </div>

          <div className="analysis-footer" style={{ marginTop: '32px', textAlign: 'right', fontSize: '0.75rem', opacity: 0.5 }}>
            Analysis ID: {analysis.analysis_id} • Generated at: {formatDate(analysis.generated_at)}
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionWorkspaceView;
