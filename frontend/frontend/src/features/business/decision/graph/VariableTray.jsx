import React, { useMemo, useState } from 'react';
import { FiBarChart2, FiDatabase, FiSearch, FiX } from 'react-icons/fi';

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

  const canBuild = selectedVariableIds.size > 0 && !loading;

  return (
    <aside className="vt-container" aria-label="Build Scope Selection">
      <div className="vt-header">
        <h3 className="vt-title">Build Scope</h3>
        {!hasDecisionContext && (
          <div className="vt-context-warning">
            Evidence coverage unavailable (No AI Chat context)
          </div>
        )}
      </div>

      <div className="vt-search-box">
        <FiSearch className="vt-search-icon" aria-hidden="true" />
        <input
          type="text"
          className="vt-search-input"
          placeholder="Search metrics or dimensions..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {searchTerm && (
          <button className="vt-search-clear" onClick={() => setSearchTerm('')}>
            <FiX aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="vt-actions">
        <button
          className="vt-btn vt-btn--primary"
          type="button"
          onClick={onBuildGraph}
          disabled={!canBuild}
        >
          {loading ? 'Building graph...' : 'Build graph'}
        </button>

        {selectedVariableIds.size === 2 && onAddHypothesis && (
          <button
            className="vt-btn vt-btn--secondary"
            type="button"
            onClick={onAddHypothesis}
            disabled={loading}
          >
            Add Hypothesis
          </button>
        )}
      </div>

      <div className="vt-selected-status">
        <span>{selectedVariableIds.size} selected variables</span>
      </div>

      <div className="vt-list">
        {filteredGroups.length === 0 ? (
          <div className="vt-empty-state">No variables found</div>
        ) : filteredGroups.map(([type, groupCandidates]) => (
          <div className="vt-group" key={type}>
            <div className="vt-group-title">{groupTitle(type)}</div>
            {groupCandidates.map((candidate) => {
              const selected = selectedVariableIds.has(candidate.variable_id);
              const label = candidate.label || candidate.name || candidate.variable_id;
              return (
                <label
                  key={candidate.variable_id}
                  className={`vt-item ${selected ? 'is-selected' : ''}`}
                >
                  <div className="vt-item-icon">
                    {candidate.variable_type === 'metric' ? <FiBarChart2 aria-hidden="true" /> : <FiDatabase aria-hidden="true" />}
                  </div>
                  <div className="vt-item-content">
                    <div className="vt-item-name">{label}</div>
                    <div className="vt-item-type">{variableTypeLabel(candidate)}</div>
                  </div>
                  <div className="vt-item-control">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleVariableSelection(candidate.variable_id)}
                      className="vt-checkbox"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default VariableTray;
