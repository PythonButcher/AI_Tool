import React, { useState, useEffect } from 'react';
import { 
  FaArrowRight, FaLightbulb, FaGears, FaShieldHalved, 
  FaBullseye, FaWandMagic, FaWandMagicSparkles, FaRotateLeft,
  FaCircleCheck, FaCircleExclamation, FaPlus, FaPen, FaFileSignature
} from 'react-icons/fa6';
import DecisionWorkspaceComposer from './DecisionWorkspaceComposer';
import { createDecisionWorkspace } from './decisionApi';
import './DecisionWorkspace.css';

/**
 * DecisionIntakeFlow
 * 
 * Phase 3.5: Prompt-First Decision Intake.
 * Replaces the heavy structured form with a guided, assisted flow.
 */
const DecisionIntakeFlow = ({ onCreateWorkspace, datasetContext, onReset }) => {
  const [step, setStep] = useState('hero'); // 'hero' | 'draft' | 'advanced'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Intake Prompt State
  const [intake, setIntake] = useState({
    decision_prompt: '',
    what_matters: '',
    what_to_avoid: '',
    additional_context: ''
  });

  // Local workspace draft returned from prompt-first API
  const [draft, setDraft] = useState(null);

  // Starter examples
  const examples = [
    "How should we grow revenue next quarter without hurting margin?",
    "Which products are most at risk of stocking out?",
    "Should we discount slow-moving inventory?",
    "How can we reduce delivery costs while maintaining SLA?",
    "Which regions should we prioritize for the new product launch?"
  ];

  const handleStartDraft = async (promptOverride = null) => {
    const activePrompt = promptOverride || intake.decision_prompt;
    if (!activePrompt) return;

    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...datasetContext,
        intake_mode: 'prompt_first',
        decision_prompt: activePrompt,
        decision_intake: {
          what_matters: intake.what_matters,
          what_to_avoid: intake.what_to_avoid,
          additional_context: intake.additional_context
        }
      };

      const result = await createDecisionWorkspace(payload);
      if (result.status === 'success') {
        setDraft(result.decision_workspace);
        setStep('draft');
      } else {
        setError(result.error?.message || 'Failed to generate draft.');
      }
    } catch (err) {
      setError(err?.message || 'Connection error while drafting.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefineDraft = (updates) => {
    // Local refinement of the draft before finalization
    setDraft(prev => ({
      ...prev,
      decision_scope: {
        ...prev.decision_scope,
        ...updates
      }
    }));
  };

  /**
   * Finalizes the draft by converting the system-generated draft workspace
   * back into the structured creation payload expected by the Decision API.
   * This ensures the finalize step follows the same contract as the Advanced Composer.
   */
  const handleFinalize = () => {
    if (!draft) return;

    const { objective, levers, constraints } = draft.decision_scope;
    // Scoped filters are primarily found in scoped_context.applied_filters in normalized responses.
    const filters = draft.scoped_context?.applied_filters || draft.decision_scope.filters || [];

    // We map the draft structure back to the 'composer-style' creation payload.
    // This allows the backend to perform its standard validation and final 'ready' status checks.
    const payload = {
      ...datasetContext,
      decision_prompt: draft.decision_prompt,
      objective: {
        statement: objective.statement,
        metric_id: objective.metric_ref?.metric_id || objective.metric_id || null,
        direction: objective.direction,
        target: objective.target ? {
          operator: objective.target.operator,
          value: objective.target.value,
          secondary_value: objective.target.secondary_value,
          unit: objective.target.unit
        } : null,
        time_horizon: {
          kind: objective.time_horizon?.kind || 'relative_period',
          label: objective.time_horizon?.label || 'Next quarter',
          grain: objective.time_horizon?.grain || 'quarter',
          start: objective.time_horizon?.start || null,
          end: objective.time_horizon?.end || null
        }
      },
      // Levers and constraints are mapped back to their creation format (binding IDs, etc.)
      levers: levers.map(l => ({
        label: l.label,
        description: l.description,
        lever_type: l.lever_type,
        binding: l.binding ? {
          [l.binding.binding_type === 'field' ? 'field' : `${l.binding.binding_type}_id`]: 
            l.binding.metric_ref?.metric_id || l.binding.dimension_ref?.dimension_id || l.binding.field
        } : null,
        desired_change: l.desired_change,
        current_value: l.current_value,
        bounds: l.bounds,
        controllable: l.controllable
      })),
      constraints: constraints.map(c => ({
        label: c.label,
        description: c.description,
        rationale: c.rationale,
        constraint_type: c.constraint_type || 'metric_guardrail',
        hardness: c.hardness,
        binding: c.binding ? {
          [c.binding.binding_type === 'field' ? 'field' : `${c.binding.binding_type}_id`]: 
            c.binding.metric_ref?.metric_id || c.binding.dimension_ref?.dimension_id || c.binding.field
        } : null,
        condition: c.condition
      })),
      filters: filters || [],
      scope_preferences: draft.scope_preferences || {
        max_candidate_metrics: 8,
        max_candidate_dimensions: 6,
        include_diagnostics: true // Default to true on assisted finalize
      }
    };

    onCreateWorkspace(payload);
  };

  /**
   * Screen 1: The Hero Intake
   */
  if (step === 'hero') {
    return (
      <div className="workspace-composer workspace-composer--hero">
        <div className="composer-header">
          <div className="header-badge"><FaWandMagicSparkles /> Decision Intelligence V3</div>
          <h2>What are you trying to decide?</h2>
          <p>State your business problem in plain English. AI will help structure the metrics, levers, and guardrails.</p>
        </div>

        <div className="hero-intake-form">
          <div className="hero-main-input">
            <textarea 
              className="composer-input composer-textarea"
              placeholder="e.g. How should we optimize our marketing spend across channels for Q4?"
              value={intake.decision_prompt}
              onChange={(e) => setIntake({ ...intake, decision_prompt: e.target.value })}
              autoFocus
            />
          </div>

          <div className="hero-starter-chips">
            <label>Try an example:</label>
            <div className="chips-grid">
              {examples.map((ex, i) => (
                <button key={i} className="starter-chip" onClick={() => {
                  setIntake({ ...intake, decision_prompt: ex });
                  handleStartDraft(ex);
                }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="hero-helpers">
            <div className="helper-input-group">
              <label><FaBullseye /> What matters most?</label>
              <input 
                type="text" 
                placeholder="e.g. Maximize ROI, improve customer acquisition cost"
                value={intake.what_matters}
                onChange={(e) => setIntake({ ...intake, what_matters: e.target.value })}
              />
            </div>
            <div className="helper-input-group">
              <label><FaShieldHalved /> Anything to avoid or protect?</label>
              <input 
                type="text" 
                placeholder="e.g. Keep total budget under $50k, don't hurt retention"
                value={intake.what_to_avoid}
                onChange={(e) => setIntake({ ...intake, what_to_avoid: e.target.value })}
              />
            </div>
          </div>

          <div className="hero-footer">
            <button 
              className="create-workspace-btn" 
              onClick={() => handleStartDraft()}
              disabled={!intake.decision_prompt || loading}
            >
              {loading ? 'Drafting Strategy...' : 'Draft Decision Strategy'} <FaWandMagic />
            </button>
            {error && <div className="intake-error"><FaCircleExclamation /> {error}</div>}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Screen 2: Draft Preview
   */
  if (step === 'draft' && draft) {
    const { objective, levers, constraints } = draft.decision_scope;
    const { drafting, readiness, unknowns } = draft;

    return (
      <div className="workspace-composer workspace-composer--draft">
        <div className="composer-header">
          <div className="header-badge header-badge--success"><FaCircleCheck /> Strategy Drafted</div>
          <h2>Review your decision draft</h2>
          <p>We've structured your problem into a measurable goal with controllable levers and guardrails.</p>
        </div>

        <div className="draft-preview-grid">
          {/* Objective Preview */}
          <div className="draft-card draft-card--objective">
            <div className="draft-card-label"><FaBullseye /> Drafted Goal</div>
            <h3>{objective.statement}</h3>
            <div className="draft-card-meta">
              <span className="meta-item">Direction: <strong>{objective.direction}</strong></span>
              {objective.metric_ref && <span className="meta-item">Metric: <strong>{objective.metric_ref.label}</strong></span>}
            </div>
          </div>

          {/* Levers & Constraints */}
          <div className="draft-split">
            <div className="draft-card">
              <div className="draft-card-label"><FaGears /> Candidate Levers</div>
              <ul className="draft-item-list">
                {levers.map((l, i) => (
                  <li key={i}>
                    <strong>{l.label}</strong>
                    <span>{l.lever_type} • {l.desired_change}</span>
                  </li>
                ))}
                {levers.length === 0 && <li className="empty-li">No levers inferred.</li>}
              </ul>
            </div>
            <div className="draft-card">
              <div className="draft-card-label"><FaShieldHalved /> Guardrails</div>
              <ul className="draft-item-list">
                {constraints.map((c, i) => (
                  <li key={i}>
                    <strong>{c.label}</strong>
                    <span>{c.condition.operator} {c.condition.value} {c.condition.unit}</span>
                  </li>
                ))}
                {constraints.length === 0 && <li className="empty-li">No constraints inferred.</li>}
              </ul>
            </div>
          </div>

          {/* Uncertainties / Hints */}
          {(unknowns.length > 0 || drafting.clarification_hints?.length > 0) && (
            <div className="draft-card draft-card--uncertain">
              <div className="draft-card-label"><FaCircleExclamation /> Clarifications & Gaps</div>
              <div className="hints-cloud">
                {drafting.clarification_hints?.map((hint, i) => (
                  <div key={i} className="hint-chip"><FaLightbulb /> {hint}</div>
                ))}
                {unknowns.map((u, i) => (
                  <div key={i} className="hint-chip hint-chip--warning"><FaCircleExclamation /> {u.label}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="draft-footer">
          <div className="draft-actions-main">
            <button className="create-workspace-btn" onClick={handleFinalize}>
              Initialize Workspace <FaArrowRight />
            </button>
            <button className="secondary-btn" onClick={() => setStep('advanced')}>
              <FaPen /> Open Advanced Setup
            </button>
          </div>
          <button className="text-btn" onClick={() => setStep('hero')}>
            <FaRotateLeft /> Start Over
          </button>
        </div>
      </div>
    );
  }

  /**
   * Screen 3: Advanced Composer (Fallback)
   */
  if (step === 'advanced') {
    return (
      <div className="advanced-composer-wrapper">
        <div className="advanced-header">
          <button className="back-btn" onClick={() => setStep('draft')}>
            <FaRotateLeft /> Back to Draft
          </button>
          <div className="header-info">
            <h3>Advanced Decision Configuration</h3>
            <p>Manually tune every metric, binding, and threshold for maximum precision.</p>
          </div>
        </div>
        <DecisionWorkspaceComposer 
          onCreateWorkspace={onCreateWorkspace} 
          datasetContext={datasetContext}
          initialData={draft} // We'll need to update Composer to accept initialData
        />
      </div>
    );
  }

  return null;
};

export default DecisionIntakeFlow;
