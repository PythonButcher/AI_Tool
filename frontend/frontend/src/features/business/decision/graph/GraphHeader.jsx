import React from 'react';
import { FiActivity, FiGitBranch, FiInfo, FiRefreshCw, FiShield, FiSidebar } from 'react-icons/fi';

const GraphHeader = ({ loading, error, graphStats, hasDecisionContext, onClearGraph, isInspectorOpen, onToggleInspector }) => {
  const selectedCount = graphStats?.selectedCount || 0;
  const nodeCount = graphStats?.nodeCount || 0;
  const edgeCount = graphStats?.edgeCount || 0;

  return (
    <header className="graph-header">
      <div className="graph-header__identity">
        <div className="graph-header__mark">
          <FiGitBranch aria-hidden="true" size={20} />
        </div>
        <div className="graph-header__title-group">
          <h2>Decision Graph</h2>
          <div className="graph-header__meta">
            <span>{selectedCount} selected variables</span>
            <span>&bull;</span>
            <span>{nodeCount} nodes</span>
            <span>&bull;</span>
            <span>{edgeCount} edges</span>
          </div>
        </div>
      </div>

      <div className="graph-header__right">
        <div className="graph-header__legend">
          <span>
            <span className="legend-line legend-line--coverage" />
            Coverage
          </span>
          <span>
            <span className="legend-line legend-line--observed" />
            Observed
          </span>
        </div>

        <div className={`graph-header__status ${error ? 'is-error' : loading ? 'is-loading' : 'is-ready'}`}>
          {error ? <FiInfo size={16} aria-hidden="true" /> : loading ? <FiActivity size={16} aria-hidden="true" /> : <FiShield size={16} aria-hidden="true" />}
          <span>{error || (loading ? 'Working...' : hasDecisionContext ? 'Decision context active' : 'Dataset only')}</span>
        </div>

        <div className="graph-header__actions">
          {nodeCount > 0 && (
            <button type="button" className="graph-icon-button" onClick={onClearGraph} title="Clear graph">
              <FiRefreshCw size={20} aria-hidden="true" />
            </button>
          )}
          <button type="button" className={`graph-icon-button ${isInspectorOpen ? 'is-active' : ''}`} onClick={onToggleInspector} title="Toggle inspector">
            <FiSidebar size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default GraphHeader;
