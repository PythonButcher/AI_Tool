import React, { useMemo, useState } from 'react';
import { FiBarChart2, FiCheck, FiDatabase, FiSearch } from 'react-icons/fi';

const variableTypeLabel = (candidate) => {
  const type = candidate?.variable_type || candidate?.type || 'variable';
  if (type === 'metric') return 'Metric';
  if (type === 'dimension') return 'Dimension';
  return 'Variable';
};

const groupTitle = (type) => {
  if (type === 'metric') return 'Metrics';
  if (type === 'dimension') return 'Dimensions';
  return 'Other variables';
};

const VariableTray = ({
  candidates,
  selectedVariableIds,
  toggleVariableSelection,
  onBuildGraph,
  loading,
  hasDecisionContext,
  onAddHypothesis,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const groups = new Map();

    candidates
      .filter((candidate) => {
        if (!normalizedSearch) return true;
        const text = [
          candidate.label,
          candidate.name,
          candidate.variable_id,
          candidate.field,
          candidate.variable_type,
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes(normalizedSearch);
      })
      .forEach((candidate) => {
        const type = candidate.variable_type || candidate.type || 'variable';
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(candidate);
      });

    return Array.from(groups.entries());
  }, [candidates, searchTerm]);

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedVariableIds.has(candidate.variable_id)),
    [candidates, selectedVariableIds]
  );

  const canBuild = selectedVariableIds.size > 0 && !loading;

  return (
    <aside className="variable-tray" aria-label="Decision graph variable selection">
      <div className="variable-tray__header">
        <div>
          <h3>Build Scope</h3>
          <p>Select variables to inspect as a graph.</p>
        </div>
        <span className="variable-tray__count">{selectedVariableIds.size}</span>
      </div>

      {!hasDecisionContext && (
        <div className="graph-context-note">
          Evidence coverage is unavailable because this graph was opened without AI Chat decision context.
        </div>
      )}

      <label className="graph-search">
        <FiSearch aria-hidden="true" />
        <input
          type="text"
          placeholder="Search metrics or dimensions"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </label>

      <button
        className="graph-build-button"
        type="button"
        onClick={onBuildGraph}
        disabled={!canBuild}
      >
        <FiGitBranchIcon />
        <span>{loading ? 'Building graph' : 'Build graph'}</span>
      </button>

      {selectedVariableIds.size === 2 && onAddHypothesis && (
        <button
          className="graph-build-button"
          type="button"
          onClick={onAddHypothesis}
          disabled={loading}
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', marginBottom: '14px' }}
        >
          <FiGitBranchIcon />
          <span>Add Hypothesis</span>
        </button>
      )}

      <div className="selected-strip" aria-label="Selected variables">
        <div className="selected-strip__label">Selected</div>
        {selectedCandidates.length === 0 ? (
          <p>No variables selected yet.</p>
        ) : (
          <div className="selected-strip__chips">
            {selectedCandidates.map((candidate) => (
              <span key={candidate.variable_id}>{candidate.label || candidate.name || candidate.variable_id}</span>
            ))}
          </div>
        )}
      </div>

      <div className="variable-groups">
        {filteredGroups.length === 0 ? (
          <p className="variable-empty">No variables match this search.</p>
        ) : filteredGroups.map(([type, groupCandidates]) => (
          <section className="variable-group" key={type}>
            <div className="variable-group__title">
              <span>{groupTitle(type)}</span>
              <small>{groupCandidates.length}</small>
            </div>
            {groupCandidates.map((candidate) => {
              const selected = selectedVariableIds.has(candidate.variable_id);
              const label = candidate.label || candidate.name || candidate.variable_id;
              return (
                <button
                  key={candidate.variable_id}
                  type="button"
                  className={`variable-option ${selected ? 'is-selected' : ''}`}
                  onClick={() => toggleVariableSelection(candidate.variable_id)}
                >
                  <span className="variable-option__icon">
                    {candidate.variable_type === 'metric' ? <FiBarChart2 aria-hidden="true" /> : <FiDatabase aria-hidden="true" />}
                  </span>
                  <span className="variable-option__body">
                    <span className="variable-option__label">{label}</span>
                    <span className="variable-option__meta">{variableTypeLabel(candidate)}</span>
                  </span>
                  <span className="variable-option__check">
                    {selected && <FiCheck aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
};

const FiGitBranchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v10a3 3 0 1 0 3 3H7m10-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0c0 2.5-2 4-5 4H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default VariableTray;
