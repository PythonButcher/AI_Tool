import React, { useState } from 'react';
import { 
  FaPlus, FaTrash, FaCheck, FaCircleXmark, FaArrowRight, FaLightbulb, 
  FaGears, FaShieldHalved, FaClock, FaBullseye, FaLink, FaCircleInfo,
  FaCircleCheck, FaCircleExclamation
} from 'react-icons/fa6';
import './DecisionWorkspace.css';

/**
 * DecisionWorkspaceComposer
 * 
 * Rebuilt for DI 2.0 V1 with a "Guided Brief" UX.
 * Collects objective, levers, and constraints with high-fidelity layout and polish.
 */
const DecisionWorkspaceComposer = ({ onCreateWorkspace, datasetContext, initialData }) => {
  const [prompt, setPrompt] = useState(initialData?.decision_prompt || '');
  
  // Objective State
  const [objective, setObjective] = useState({
    statement: initialData?.decision_scope?.objective?.statement || '',
    metric_id: initialData?.decision_scope?.objective?.metric_ref?.metric_id || initialData?.decision_scope?.objective?.metric_id || '',
    direction: initialData?.decision_scope?.objective?.direction || 'maximize',
    target_value: initialData?.decision_scope?.objective?.target?.value || '',
    target_secondary_value: initialData?.decision_scope?.objective?.target?.secondary_value || '',
    target_operator: initialData?.decision_scope?.objective?.target?.operator || 'gte',
    target_unit: initialData?.decision_scope?.objective?.target?.unit || 'ratio',
    time_horizon_label: initialData?.decision_scope?.objective?.time_horizon?.label || 'Next quarter',
    time_horizon_kind: initialData?.decision_scope?.objective?.time_horizon?.kind || 'relative_period',
    time_horizon_grain: initialData?.decision_scope?.objective?.time_horizon?.grain || 'quarter',
    time_horizon_start: initialData?.decision_scope?.objective?.time_horizon?.start || '',
    time_horizon_end: initialData?.decision_scope?.objective?.time_horizon?.end || ''
  });

  // Levers State
  const [levers, setLevers] = useState(initialData?.decision_scope?.levers?.map(l => ({
    id: l.lever_id || `lever_${Math.random().toString(36).substr(2, 9)}`,
    label: l.label || '',
    description: l.description || '',
    lever_type: l.lever_type || 'numeric_input',
    binding_type: l.binding?.binding_type || 'metric',
    binding_id: l.binding?.metric_ref?.metric_id || l.binding?.dimension_ref?.dimension_id || l.binding?.field || '',
    desired_change: l.desired_change || 'increase',
    current_value: l.current_value || '',
    min_value: l.bounds?.min_value || '',
    max_value: l.bounds?.max_value || '',
    allowed_values: l.bounds?.allowed_values?.join(', ') || '',
    unit: l.bounds?.unit || l.unit || '',
    controllable: l.controllable !== undefined ? l.controllable : true
  })) || []);
  
  // Constraints State
  const [constraints, setConstraints] = useState(initialData?.decision_scope?.constraints?.map(c => ({
    id: c.constraint_id || `constraint_${Math.random().toString(36).substr(2, 9)}`,
    label: c.label || '',
    description: c.description || '',
    rationale: c.rationale || '',
    constraint_type: c.constraint_type || 'metric_guardrail',
    binding_type: c.binding?.binding_type || 'metric',
    binding_id: c.binding?.metric_ref?.metric_id || c.binding?.dimension_ref?.dimension_id || c.binding?.field || '',
    operator: c.condition?.operator || 'gte',
    value: c.condition?.value || '',
    secondary_value: c.condition?.secondary_value || '',
    values: c.condition?.values?.join(', ') || '',
    unit: c.condition?.unit || '',
    hardness: c.hardness || 'hard'
  })) || []);

  // Global Context & Preferences
  const [filters, setFilters] = useState(initialData?.scoped_context?.applied_filters || initialData?.decision_scope?.filters || []);
  const [scopePreferences, setScopePreferences] = useState(initialData?.scope_preferences || {
    max_candidate_metrics: 8,
    max_candidate_dimensions: 6,
    include_diagnostics: false
  });

  // Detailed UI states (item IDs that show detailed fields)
  const [detailedItems, setDetailedItems] = useState(new Set());

  const toggleDetails = (id) => {
    const next = new Set(detailedItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDetailedItems(next);
  };

  const addLever = () => {
    const id = `lever_${Date.now()}`;
    setLevers([...levers, { 
      id,
      label: '', 
      description: '',
      lever_type: 'numeric_input', 
      binding_type: 'metric',
      binding_id: '',
      desired_change: 'increase',
      current_value: '',
      min_value: '',
      max_value: '',
      allowed_values: '', // Comma separated
      unit: '',
      controllable: true
    }]);
    toggleDetails(id);
  };

  const removeLever = (id) => {
    setLevers(levers.filter(l => l.id !== id));
  };

  const updateLever = (id, updates) => {
    setLevers(levers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addConstraint = () => {
    const id = `constraint_${Date.now()}`;
    setConstraints([...constraints, { 
      id,
      label: '', 
      description: '',
      rationale: '',
      constraint_type: 'metric_guardrail', 
      binding_type: 'metric',
      binding_id: '',
      operator: 'gte',
      value: '',
      secondary_value: '',
      values: '', // Comma separated
      unit: '',
      hardness: 'hard'
    }]);
    toggleDetails(id);
  };

  const removeConstraint = (id) => {
    setConstraints(constraints.filter(c => c.id !== id));
  };

  const updateConstraint = (id, updates) => {
    setConstraints(constraints.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
  };

  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index, updates) => {
    setFilters(filters.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const handleSubmit = () => {
    if (!prompt || !objective.statement) {
      alert('Decision prompt and objective statement are required.');
      return;
    }

    const payload = {
      ...datasetContext,
      decision_prompt: prompt,
      objective: {
        statement: objective.statement,
        metric_id: objective.metric_id || null,
        direction: objective.direction,
        target: objective.target_value ? {
          operator: objective.target_operator,
          value: parseFloat(objective.target_value) || objective.target_value,
          secondary_value: objective.target_secondary_value ? parseFloat(objective.target_secondary_value) : null,
          unit: objective.target_unit || null
        } : null,
        time_horizon: {
          kind: objective.time_horizon_kind,
          label: objective.time_horizon_label,
          grain: objective.time_horizon_grain || null,
          start: objective.time_horizon_start || null,
          end: objective.time_horizon_end || null
        }
      },
      levers: levers.map(({ 
        id, binding_type, binding_id, min_value, max_value, allowed_values, current_value, ...rest 
      }) => ({
        ...rest,
        current_value: current_value !== '' ? (parseFloat(current_value) || current_value) : null,
        binding: binding_id ? {
          [binding_type === 'field' ? 'field' : `${binding_type}_id`]: binding_id
        } : null,
        bounds: {
          min_value: min_value ? parseFloat(min_value) : null,
          max_value: max_value ? parseFloat(max_value) : null,
          allowed_values: allowed_values ? allowed_values.split(',').map(v => v.trim()) : null,
          unit: rest.unit || null
        }
      })),
      constraints: constraints.map(({ 
        id, binding_type, binding_id, operator, value, secondary_value, values, ...rest 
      }) => ({
        ...rest,
        binding: binding_id ? {
          [binding_type === 'field' ? 'field' : `${binding_type}_id`]: binding_id
        } : null,
        condition: {
          operator,
          value: parseFloat(value) || value,
          secondary_value: secondary_value ? parseFloat(secondary_value) : null,
          values: values ? values.split(',').map(v => v.trim()) : null,
          unit: rest.unit || null
        }
      })),
      filters: filters.filter(f => f.field),
      scope_preferences: scopePreferences
    };

    onCreateWorkspace(payload);
  };

  return (
    <div className="workspace-composer">
      <div className="composer-header">
        <h2>Frame Your Decision</h2>
        <p>A structured workspace to define objectives, levers, and guardrails for strategic intelligence.</p>
      </div>

      <div className="composer-section">
        <div className="section-label"><FaLightbulb /> 1. The Business Problem</div>
        <p className="section-desc">Start by stating the core question or problem this decision workspace aims to solve.</p>
        <textarea 
          className="composer-input composer-textarea"
          placeholder="e.g. How should we grow Q3 revenue without hurting gross margin?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="input-hint">
          {prompt.length > 10 ? <span className="text-success"><FaCircleCheck /> Problem defined</span> : <span className="text-warning"><FaCircleExclamation /> Provide a clear business question</span>}
        </div>
      </div>

      <div className="composer-section">
        <div className="section-label"><FaBullseye /> 2. Success Objective</div>
        <p className="section-desc">What is the primary measurable goal of this decision?</p>
        
        <div className="objective-fields">
          <div className="input-group">
            <label>Objective Statement</label>
            <input 
              type="text" 
              className="composer-input composer-input--large" 
              placeholder="e.g. Increase revenue next quarter"
              value={objective.statement}
              onChange={(e) => setObjective({ ...objective, statement: e.target.value })}
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Direction</label>
              <select 
                className="composer-select"
                value={objective.direction}
                onChange={(e) => setObjective({ ...objective, direction: e.target.value })}
              >
                <option value="maximize">Maximize</option>
                <option value="minimize">Minimize</option>
                <option value="maintain">Maintain</option>
                <option value="achieve_target">Achieve Target</option>
              </select>
            </div>
            <div className="input-group">
              <label>Anchor Metric ID</label>
              <div className="compound-input">
                <div className="inner-icon"><FaLink /></div>
                <input 
                  type="text" 
                  className="composer-input input--with-icon" 
                  placeholder="e.g. metric_revenue"
                  value={objective.metric_id}
                  onChange={(e) => setObjective({ ...objective, metric_id: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div className="input-row secondary-inputs">
            <div className="input-group">
              <label>Target Threshold</label>
              <div className="compound-input compound-input--compact">
                <select 
                  className="composer-select select--compact"
                  value={objective.target_operator}
                  onChange={(e) => setObjective({ ...objective, target_operator: e.target.value })}
                >
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                  <option value="eq">=</option>
                  <option value="between">between</option>
                </select>
                <input 
                  type="number" 
                  className="composer-input" 
                  placeholder="Value"
                  value={objective.target_value}
                  onChange={(e) => setObjective({ ...objective, target_value: e.target.value })}
                />
                {objective.target_operator === 'between' && (
                  <>
                    <div className="input-separator">to</div>
                    <input 
                      type="number" 
                      className="composer-input" 
                      placeholder="Max"
                      value={objective.target_secondary_value}
                      onChange={(e) => setObjective({ ...objective, target_secondary_value: e.target.value })}
                    />
                  </>
                )}
                <select 
                  className="composer-select select--compact"
                  value={objective.target_unit}
                  onChange={(e) => setObjective({ ...objective, target_unit: e.target.value })}
                >
                  <option value="ratio">Ratio</option>
                  <option value="currency">$</option>
                  <option value="units">Units</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label>Decision Horizon</label>
              <div className="compound-input">
                <div className="inner-icon"><FaClock /></div>
                <input 
                  type="text" 
                  className="composer-input input--with-icon" 
                  placeholder="e.g. Next Quarter"
                  value={objective.time_horizon_label}
                  onChange={(e) => setObjective({ ...objective, time_horizon_label: e.target.value })}
                />
                <select 
                  className="composer-select select--compact"
                  value={objective.time_horizon_grain}
                  onChange={(e) => setObjective({ ...objective, time_horizon_grain: e.target.value })}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="input-row secondary-inputs">
            <div className="input-group">
              <label>Specific Horizon Range</label>
              <div className="compound-input">
                <input 
                  type="date" 
                  className="composer-input" 
                  value={objective.time_horizon_start}
                  onChange={(e) => setObjective({ ...objective, time_horizon_start: e.target.value })}
                />
                <div className="input-separator">to</div>
                <input 
                  type="date" 
                  className="composer-input" 
                  value={objective.time_horizon_end}
                  onChange={(e) => setObjective({ ...objective, time_horizon_end: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="composer-section">
        <div className="section-header">
          <div className="section-label"><FaGears /> 3. Candidate Levers</div>
          <button className="add-btn" onClick={addLever}><FaPlus /> Add Lever</button>
        </div>
        <p className="section-desc">Levers are the variables you can control. A robust decision should have at least one controllable lever.</p>
        
        <div className="items-list">
          {levers.map((lever) => (
            <div key={lever.id} className={`item-card ${detailedItems.has(lever.id) ? 'is-detailed' : ''}`}>
              <div className="item-row">
                <div className="input-group" style={{ flex: 2 }}>
                  <input 
                    type="text" 
                    className="composer-input" 
                    placeholder="Lever Name (e.g. ASP / Pricing)"
                    value={lever.label}
                    onChange={(e) => updateLever(lever.id, { label: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <select 
                    className="composer-select"
                    value={lever.lever_type}
                    onChange={(e) => updateLever(lever.id, { lever_type: e.target.value })}
                  >
                    <option value="numeric_input">Numeric</option>
                    <option value="policy_choice">Policy</option>
                    <option value="allocation">Allocation</option>
                    <option value="timing">Timing</option>
                    <option value="mix">Mix</option>
                  </select>
                </div>
                <button className="icon-btn" onClick={() => toggleDetails(lever.id)} title="Configure Binding & Constraints">
                  <FaGears />
                </button>
                <button className="remove-btn" onClick={() => removeLever(lever.id)} title="Remove Lever">
                  <FaTrash />
                </button>
              </div>

              {detailedItems.has(lever.id) && (
                <div className="item-details">
                  <div className="input-group">
                    <label>Description & Intent</label>
                    <textarea 
                      className="composer-input composer-textarea--small"
                      placeholder="Why is this a lever? What is the intended movement?"
                      value={lever.description}
                      onChange={(e) => updateLever(lever.id, { description: e.target.value })}
                    />
                  </div>
                  
                  <div className="input-row">
                    <div className="input-group">
                      <label>Semantic Binding</label>
                      <div className="compound-input compound-input--compact">
                        <select 
                          className="composer-select select--compact"
                          value={lever.binding_type}
                          onChange={(e) => updateLever(lever.id, { binding_type: e.target.value })}
                        >
                          <option value="metric">Metric</option>
                          <option value="dimension">Dim</option>
                          <option value="field">Field</option>
                        </select>
                        <input 
                          type="text" 
                          className="composer-input" 
                          placeholder="ID or Field Name"
                          value={lever.binding_id}
                          onChange={(e) => updateLever(lever.id, { binding_id: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Desired Direction</label>
                      <select 
                        className="composer-select"
                        value={lever.desired_change}
                        onChange={(e) => updateLever(lever.id, { desired_change: e.target.value })}
                      >
                        <option value="increase">Increase</option>
                        <option value="decrease">Decrease</option>
                        <option value="tighten">Tighten</option>
                        <option value="loosen">Loosen</option>
                        <option value="shift">Shift</option>
                        <option value="set">Set Fixed</option>
                        <option value="test">Test Sensitivity</option>
                      </select>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Current Value</label>
                      <div className="compound-input">
                        <input 
                          type="text" 
                          className="composer-input" 
                          placeholder="e.g. 0.85"
                          value={lever.current_value}
                          onChange={(e) => updateLever(lever.id, { current_value: e.target.value })}
                        />
                        <div className="input-separator">unit</div>
                        <input 
                          type="text" 
                          className="composer-input" 
                          placeholder="ratio"
                          style={{ maxWidth: '80px' }}
                          value={lever.unit}
                          onChange={(e) => updateLever(lever.id, { unit: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Allowable Bounds</label>
                      <div className="compound-input">
                        <input 
                          type="number" 
                          className="composer-input" 
                          placeholder="Min"
                          value={lever.min_value}
                          onChange={(e) => updateLever(lever.id, { min_value: e.target.value })}
                        />
                        <div className="input-separator">to</div>
                        <input 
                          type="number" 
                          className="composer-input" 
                          placeholder="Max"
                          value={lever.max_value}
                          onChange={(e) => updateLever(lever.id, { max_value: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {lever.lever_type === 'policy_choice' && (
                    <div className="input-group">
                      <label>Allowed Values (comma-separated)</label>
                      <input 
                        type="text" 
                        className="composer-input" 
                        placeholder="Option A, Option B, Option C"
                        value={lever.allowed_values}
                        onChange={(e) => updateLever(lever.id, { allowed_values: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="input-group checkbox-group">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={lever.controllable}
                        onChange={(e) => updateLever(lever.id, { controllable: e.target.checked })}
                      />
                      Explicitly controllable variable
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
          {levers.length === 0 && (
            <div className="empty-items" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              <FaCircleExclamation /> No candidate levers defined yet.
            </div>
          )}
        </div>
      </div>

      <div className="composer-section">
        <div className="section-header">
          <div className="section-label"><FaShieldHalved /> 4. Guardrails & Constraints</div>
          <button className="add-btn" onClick={addConstraint}><FaPlus /> Add Constraint</button>
        </div>
        <p className="section-desc">Hard and soft limits the system must respect during analysis.</p>
        
        <div className="items-list">
          {constraints.map((constraint) => (
            <div key={constraint.id} className={`item-card ${detailedItems.has(constraint.id) ? 'is-detailed' : ''}`}>
              <div className="item-row">
                <div className="input-group" style={{ flex: 2 }}>
                  <input 
                    type="text" 
                    className="composer-input" 
                    placeholder="Constraint Name (e.g. Budget Floor)"
                    value={constraint.label}
                    onChange={(e) => updateConstraint(constraint.id, { label: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ flex: 2 }}>
                  <div className="compound-input compound-input--compact">
                    <select 
                      className="composer-select select--compact"
                      value={constraint.operator}
                      onChange={(e) => updateConstraint(constraint.id, { operator: e.target.value })}
                    >
                      <option value="gte">≥</option>
                      <option value="lte">≤</option>
                      <option value="eq">=</option>
                      <option value="between">between</option>
                      <option value="in">in</option>
                    </select>
                    {constraint.operator !== 'in' ? (
                      <>
                        <input 
                          type="text" 
                          className="composer-input" 
                          placeholder="Value"
                          value={constraint.value}
                          onChange={(e) => updateConstraint(constraint.id, { value: e.target.value })}
                        />
                        {constraint.operator === 'between' && (
                          <>
                            <div className="input-separator">to</div>
                            <input 
                              type="text" 
                              className="composer-input" 
                              placeholder="Max"
                              value={constraint.secondary_value}
                              onChange={(e) => updateConstraint(constraint.id, { secondary_value: e.target.value })}
                            />
                          </>
                        )}
                      </>
                    ) : (
                      <input 
                        type="text" 
                        className="composer-input" 
                        placeholder="Val 1, Val 2..."
                        value={constraint.values}
                        onChange={(e) => updateConstraint(constraint.id, { values: e.target.value })}
                      />
                    )}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => toggleDetails(constraint.id)} title="Edit Condition & Rationale">
                  <FaShieldHalved />
                </button>
                <button className="remove-btn" onClick={() => removeConstraint(constraint.id)}>
                  <FaTrash />
                </button>
              </div>

              {detailedItems.has(constraint.id) && (
                <div className="item-details">
                  <div className="input-row">
                    <div className="input-group" style={{ flex: 2 }}>
                      <label>Constraint Rationale</label>
                      <textarea 
                        className="composer-input composer-textarea--small"
                        placeholder="Why is this limit required? (e.g. Board requirement, Capacity limit)"
                        value={constraint.rationale}
                        onChange={(e) => updateConstraint(constraint.id, { rationale: e.target.value })}
                      />
                    </div>
                    <div className="input-group" style={{ flex: 1 }}>
                      <label>Hardness</label>
                      <select 
                        className="composer-select"
                        value={constraint.hardness}
                        onChange={(e) => updateConstraint(constraint.id, { hardness: e.target.value })}
                      >
                        <option value="hard">Hard (Required)</option>
                        <option value="soft">Soft (Optimizable)</option>
                      </select>
                    </div>
                  </div>

                  <div className="input-row">
                    <div className="input-group">
                      <label>Binding</label>
                      <div className="compound-input compound-input--compact">
                        <select 
                          className="composer-select select--compact"
                          value={constraint.binding_type}
                          onChange={(e) => updateConstraint(constraint.id, { binding_type: e.target.value })}
                        >
                          <option value="metric">Metric</option>
                          <option value="dimension">Dim</option>
                          <option value="field">Field</option>
                        </select>
                        <input 
                          type="text" 
                          className="composer-input" 
                          placeholder="ID or Field Name"
                          value={constraint.binding_id}
                          onChange={(e) => updateConstraint(constraint.id, { binding_id: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Unit</label>
                      <input 
                        type="text" 
                        className="composer-input" 
                        placeholder="e.g. ratio, currency"
                        value={constraint.unit}
                        onChange={(e) => updateConstraint(constraint.id, { unit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Additional Context (Optional)</label>
                    <input 
                      type="text" 
                      className="composer-input" 
                      placeholder="Brief clarifying description"
                      value={constraint.description}
                      onChange={(e) => updateConstraint(constraint.id, { description: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {constraints.length === 0 && (
            <div className="empty-items" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
              <FaCircleExclamation /> No guardrails or constraints defined.
            </div>
          )}
        </div>
      </div>

      <div className="composer-section">
        <div className="section-header">
          <div className="section-label"><FaLink /> 5. Scope & Preferences</div>
          <button className="add-btn" onClick={addFilter}><FaPlus /> Add Filter</button>
        </div>
        <p className="section-desc">Apply slice filters and tune the workspace resolution depth.</p>
        
        <div className="filters-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filters.map((filter, idx) => (
            <div key={idx} className="filter-row" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="compound-input" style={{ flex: 3 }}>
                <input 
                  type="text" 
                  className="composer-input" 
                  placeholder="Field"
                  value={filter.field}
                  onChange={(e) => updateFilter(idx, { field: e.target.value })}
                />
                <select 
                  className="composer-select"
                  style={{ maxWidth: '80px' }}
                  value={filter.operator}
                  onChange={(e) => updateFilter(idx, { operator: e.target.value })}
                >
                  <option value="eq">=</option>
                  <option value="neq">≠</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                  <option value="in">in</option>
                </select>
                <input 
                  type="text" 
                  className="composer-input" 
                  placeholder="Value"
                  value={filter.value}
                  onChange={(e) => updateFilter(idx, { value: e.target.value })}
                />
              </div>
              <button className="remove-btn" onClick={() => removeFilter(idx)} title="Remove Filter">
                <FaTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="scope-prefs" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
          <div className="input-row">
            <div className="input-group">
              <label>Resolution Depth</label>
              <div className="compound-input">
                <div className="inner-icon" style={{ fontSize: '0.7rem', fontWeight: 800 }}>METRICS</div>
                <input 
                  type="number" 
                  className="composer-input" 
                  value={scopePreferences.max_candidate_metrics}
                  onChange={(e) => setScopePreferences({ ...scopePreferences, max_candidate_metrics: parseInt(e.target.value) })}
                />
                <div className="inner-icon" style={{ fontSize: '0.7rem', fontWeight: 800 }}>DIMS</div>
                <input 
                  type="number" 
                  className="composer-input" 
                  value={scopePreferences.max_candidate_dimensions}
                  onChange={(e) => setScopePreferences({ ...scopePreferences, max_candidate_dimensions: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="input-group checkbox-group" style={{ justifyContent: 'flex-end', paddingBottom: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={scopePreferences.include_diagnostics}
                  onChange={(e) => setScopePreferences({ ...scopePreferences, include_diagnostics: e.target.checked })}
                />
                Run Initial Diagnostic Scan
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="composer-footer">
        <button className="create-workspace-btn" onClick={handleSubmit}>
          Initialize Decision Workspace <FaArrowRight />
        </button>
      </div>
    </div>
  );
};

export default DecisionWorkspaceComposer;
