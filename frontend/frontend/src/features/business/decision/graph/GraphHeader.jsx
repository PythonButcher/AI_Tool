import React from 'react';
import { FiActivity, FiGitBranch, FiInfo, FiRefreshCw, FiShield, FiSidebar } from 'react-icons/fi';

const GraphHeader = ({ loading, error, graphStats, hasDecisionContext, onClearGraph, isInspectorOpen, onToggleInspector }) => {
  const selectedCount = graphStats?.selectedCount || 0;
  const nodeCount = graphStats?.nodeCount || 0;
  const edgeCount = graphStats?.edgeCount || 0;

  return (
    <div className="graph-header">
      <div className="graph-header__identity">
        <div className="graph-header__mark">
          <FiGitBranch aria-hidden="true" />
        </div>
        <div>
          <h2>Decision Graph</h2>
          <p>Inspect variables, evidence coverage, and observed associations.</p>
        </div>
      </div>

      <div className="graph-header__stats" aria-label="Graph summary">
        <span><strong>{selectedCount}</strong> selected</span>
        <span><strong>{nodeCount}</strong> nodes</span>
        <span><strong>{edgeCount}</strong> edges</span>
      </div>

      <div className="graph-header__right">
        <div className="graph-legend" aria-label="Graph edge legend">
          <span className="graph-legend__item">
            <span className="graph-legend__line graph-legend__line--coverage" />
            Evidence coverage
          </span>
          <span className="graph-legend__item">
            <span className="graph-legend__line graph-legend__line--association" />
            Observed association
          </span>
        </div>

        <div className={`graph-status ${error ? 'graph-status--error' : loading ? 'graph-status--loading' : 'graph-status--ready'}`}>
          {error ? <FiInfo aria-hidden="true" /> : loading ? <FiActivity aria-hidden="true" /> : <FiShield aria-hidden="true" />}
          <span>{error || (loading ? 'Working' : hasDecisionContext ? 'Decision context' : 'Dataset only')}</span>
        </div>

        {nodeCount > 0 && (
          <button className="graph-icon-button" type="button" onClick={onClearGraph} title="Clear graph">
            <FiRefreshCw aria-hidden="true" />
          </button>
        )}
        <button className={`graph-icon-button ${isInspectorOpen ? 'is-active' : ''}`} type="button" onClick={onToggleInspector} title="Toggle inspector">
          <FiSidebar aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default GraphHeader;
