import React from 'react';
import { 
  FaCircleCheck, FaCircleExclamation, FaTriangleExclamation, FaCircleInfo, 
  FaGears, FaShieldHalved, FaChartLine, FaLayerGroup, FaPlus, FaCalendarDays, FaFileLines, FaLink, FaClock 
} from 'react-icons/fa6';
import './DecisionWorkspace.css';

/**
 * DecisionWorkspaceView
 * 
 * High-fidelity "Decision Brief" rendering for DI 2.0 V1.
 * Emphasizes the strategic framing over raw data schema.
 */
const DecisionWorkspaceView = ({ workspace, onCreateNew }) => {
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
    created_at
  } = workspace;

  const renderStatusBadge = () => {
    switch (status) {
      case 'ready':
        return <span className="workspace-status workspace-status--ready"><FaCircleCheck /> Ready for Analysis</span>;
      case 'needs_input':
        return <span className="workspace-status workspace-status--needs-input"><FaCircleExclamation /> Definition Incomplete</span>;
      case 'limited':
        return <span className="workspace-status workspace-status--limited"><FaTriangleExclamation /> Structurally Limited</span>;
      default:
        return <span className="workspace-status">{status}</span>;
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
    <div className={`workspace-view workspace-view--${status}`}>
      <div className="workspace-header">
        <div className="header-top">
          <div className="status-group">
            {renderStatusBadge()}
            <span className="workspace-id">ID: {workspace_id.slice(-8)}</span>
          </div>
          <div className="header-actions">
            <button className="add-btn" onClick={onCreateNew}>
              <FaPlus /> New Decision
            </button>
            <span className="contract-version">DI 2.0 v1.0</span>
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
                  <FaLink /> Anchor Metric: <strong>{decision_scope.objective.metric_ref.label}</strong>
                </div>
              ) : (
                <div className="binding-unresolved" style={{ marginTop: '20px' }}>
                  <FaCircleExclamation /> Unresolved Metric: {decision_scope.objective.reason || "Manual ID entry required"}
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
                      <FaLink /> Bound to {lever.binding.binding_type}: <strong>{lever.binding.metric_ref?.label || lever.binding.dimension_ref?.label || lever.binding.field}</strong>
                    </div>
                  ) : (
                    <div className="binding-unresolved">
                      <FaCircleExclamation /> Unresolved Lever Binding
                    </div>
                  )}
                </div>
              ))}
              {decision_scope.levers.length === 0 && <div className="simulation-notice">No controllable levers defined for this decision.</div>}
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
                      <FaLink /> Bound to {constraint.binding.binding_type}: <strong>{constraint.binding.metric_ref?.label || constraint.binding.dimension_ref?.label || constraint.binding.field}</strong>
                    </div>
                  ) : (
                    <div className="binding-unresolved">
                      <FaCircleExclamation /> Unresolved Guardrail Binding
                    </div>
                  )}
                </div>
              ))}
              {decision_scope.constraints.length === 0 && <div className="simulation-notice">No active guardrails or constraints applied.</div>}
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
                <div className="tag-cloud">
                  {scoped_context.relevant_metrics.map(m => (
                    <span key={m.metric_id} className="context-tag">{m.label}</span>
                  ))}
                </div>
              </div>
              <div className="context-group">
                <label>Dimensions & Segments</label>
                <div className="tag-cloud">
                  {scoped_context.relevant_dimensions.map(d => (
                    <span key={d.dimension_id} className="context-tag">{d.label}</span>
                  ))}
                  {scoped_context.comparison_dimensions?.map(d => (
                    <span key={`comp-${d.dimension_id}`} className="context-tag context-tag--comparison">{d.label}</span>
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
              {assumptions.length === 0 && <div className="simulation-notice" style={{ padding: '12px', fontSize: '0.85rem' }}>No explicit assumptions recorded.</div>}
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
                    {u.blocks_simulation && <span className="blocker-badge" style={{ marginLeft: '8px', color: '#ef4444' }}>[BLOCKER]</span>}
                  </div>
                </div>
              ))}
              {unknowns.length === 0 && <div className="simulation-notice" style={{ padding: '12px', fontSize: '0.85rem' }}>All required information resolved.</div>}
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
          
          {readiness.missing_inputs.length > 0 && (
            <div className="missing-inputs">
              <FaCircleExclamation /> 
              <div>
                <strong>Action Required:</strong> The workspace definition is missing high-materiality inputs: {readiness.missing_inputs.join(', ')}
              </div>
            </div>
          )}
          
          {!readiness.can_run_simulation && (
            <div className="simulation-notice">
              <FaTriangleExclamation /> Simulation and trade-off analysis engines are locked until the decision architecture is structurally complete.
            </div>
          )}
          
          {readiness.can_run_simulation && (
            <div className="simulation-notice" style={{ background: 'color-mix(in srgb, var(--accent-green) 5%, var(--bg-primary))', borderColor: 'var(--accent-green)', color: 'var(--text-primary)' }}>
              <FaCircleCheck /> Decision architecture is structurally sound. Ready for simulation and objective optimization.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecisionWorkspaceView;
