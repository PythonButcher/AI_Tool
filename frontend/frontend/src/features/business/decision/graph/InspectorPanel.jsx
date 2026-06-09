import React from 'react';
import { FiAlertTriangle, FiBarChart2, FiInfo, FiLink2, FiShield, FiTarget } from 'react-icons/fi';

const formatLabel = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
};

const relationshipCopy = (edge) => {
  if (edge?.relationship_type === 'evidence_coverage') {
    return 'This edge shows that an Evidence Board item covers the selected decision variable. It is evidence coverage, not a causal claim.';
  }
  return 'This edge shows a conservative observed association in the available dataset. It is descriptive and non-causal.';
};

const reliabilityTone = (label) => {
  if (label?.includes('supported')) return 'supported';
  if (label?.includes('insufficient')) return 'insufficient';
  return 'limited';
};

const InspectorPanel = ({ selectedElement }) => {
  if (!selectedElement) {
    return (
      <aside className="graph-inspector" aria-label="Decision graph inspector">
        <div className="inspector-heading">
          <span className="inspector-heading__icon"><FiInfo aria-hidden="true" /></span>
          <div>
            <h3>Inspector</h3>
            <p>Select a graph item to inspect evidence and limits.</p>
          </div>
        </div>
        <div className="inspector-empty-state">
          <FiTarget aria-hidden="true" />
          <h4>No selection</h4>
          <p>Choose a node or relationship to see what the graph can and cannot support.</p>
        </div>
      </aside>
    );
  }

  const { type, data } = selectedElement;
  const rawNode = data?.rawNodeData;
  const rawEdge = data?.rawEdgeData;

  return (
    <aside className="graph-inspector" aria-label="Decision graph inspector">
      {type === 'node' ? <NodeInspector node={rawNode} label={data?.label} /> : <EdgeInspector edge={rawEdge} label={data?.label} />}
    </aside>
  );
};

const NodeInspector = ({ node, label }) => {
  if (!node) return <InspectorUnavailable title={label || 'Node'} />;

  const sufficiency = node.data_sufficiency || {};
  const limitations = node.limitations || [];

  return (
    <>
      <div className="inspector-heading">
        <span className="inspector-heading__icon"><FiBarChart2 aria-hidden="true" /></span>
        <div>
          <h3>{node.label || label || 'Variable'}</h3>
          <p>{formatLabel(node.node_type || node.variable_type || 'Variable')}</p>
        </div>
      </div>

      <section className="inspector-section inspector-section--summary">
        <h4>What This Node Represents</h4>
        <p>{node.summary || 'This variable is included in the current graph inspection scope.'}</p>
      </section>

      <section className="inspector-section">
        <h4>Variable Details</h4>
        <dl className="inspector-kv">
          <div><dt>Variable ID</dt><dd>{node.variable_id || node.node_id}</dd></div>
          {node.field && <div><dt>Field</dt><dd>{node.field}</dd></div>}
          {node.semantic_role && <div><dt>Semantic role</dt><dd>{formatLabel(node.semantic_role)}</dd></div>}
          {node.data_type && <div><dt>Data type</dt><dd>{formatLabel(node.data_type)}</dd></div>}
        </dl>
      </section>

      <SufficiencySection sufficiency={sufficiency} />
      <LimitationsSection limitations={limitations} />
    </>
  );
};

const EdgeInspector = ({ edge, label }) => {
  if (!edge) return <InspectorUnavailable title={label || 'Relationship'} />;

  const metrics = edge.metrics || {};
  const sufficiency = edge.data_sufficiency || {};
  const limitations = edge.limitations || [];
  const tone = reliabilityTone(edge.reliability_label);

  return (
    <>
      <div className="inspector-heading">
        <span className="inspector-heading__icon"><FiLink2 aria-hidden="true" /></span>
        <div>
          <h3>{edge.label || label || 'Relationship'}</h3>
          <p>{formatLabel(edge.relationship_type || 'Observed relationship')}</p>
        </div>
      </div>

      <section className="inspector-section inspector-section--summary">
        <div className={`reliability-pill reliability-pill--${tone}`}>
          <FiShield aria-hidden="true" />
          {formatLabel(edge.reliability_label || 'Observed limited')}
        </div>
        <h4>Interpretation</h4>
        <p>{edge.summary || relationshipCopy(edge)}</p>
        <p className="inspector-boundary">{relationshipCopy(edge)}</p>
      </section>

      <section className="inspector-section">
        <h4>Evidence Basis</h4>
        <dl className="inspector-kv">
          <div><dt>Basis</dt><dd>{formatLabel(edge.evidence_basis)}</dd></div>
          <div><dt>Causal status</dt><dd>{formatLabel(edge.causal_status || 'not_causal_claim')}</dd></div>
          <div><dt>Relationship type</dt><dd>{formatLabel(edge.relationship_type)}</dd></div>
        </dl>
      </section>

      <MetricsSection metrics={metrics} />
      <SufficiencySection sufficiency={sufficiency} />
      <LimitationsSection limitations={limitations} />
    </>
  );
};

const MetricsSection = ({ metrics }) => {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  const primaryMetrics = [
    ['method', 'Method'],
    ['strength', 'Strength'],
    ['direction', 'Direction'],
    ['sample_size', 'Sample size'],
    ['row_count', 'Row count'],
    ['correlation', 'Correlation'],
    ['trend_correlation', 'Trend correlation'],
    ['cramers_v', "Cramer's V"],
    ['group_count', 'Group count'],
    ['top_bottom_delta', 'Top-bottom delta'],
    ['evidence_strength', 'Evidence strength'],
  ].filter(([key]) => metrics[key] !== undefined && metrics[key] !== null);

  const extraMetrics = Object.entries(metrics)
    .filter(([key, value]) => !primaryMetrics.some(([primaryKey]) => primaryKey === key) && key !== 'top_groups' && key !== 'data_sufficiency' && typeof value !== 'object');

  return (
    <section className="inspector-section">
      <h4>Edge Metrics</h4>
      <dl className="inspector-kv inspector-kv--metrics">
        {primaryMetrics.map(([key, metricLabel]) => (
          <div key={key}>
            <dt>{metricLabel}</dt>
            <dd>{formatValue(metrics[key])}</dd>
          </div>
        ))}
        {extraMetrics.map(([key, value]) => (
          <div key={key}>
            <dt>{formatLabel(key)}</dt>
            <dd>{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
      <TopGroups groups={metrics.top_groups} />
    </section>
  );
};

const TopGroups = ({ groups }) => {
  if (!Array.isArray(groups) || groups.length === 0) return null;

  return (
    <div className="top-groups">
      <h5>Top groups</h5>
      <div className="top-groups__table">
        <div className="top-groups__row top-groups__row--header">
          <span>Group</span>
          <span>Mean</span>
          <span>Sample</span>
        </div>
        {groups.map((group, index) => (
          <div className="top-groups__row" key={`${group.group || 'group'}-${index}`}>
            <span>{formatValue(group.group || group.name || group.group_name)}</span>
            <span>{formatValue(group.mean_value)}</span>
            <span>{formatValue(group.sample_size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SufficiencySection = ({ sufficiency }) => {
  if (!sufficiency || Object.keys(sufficiency).length === 0) return null;

  return (
    <section className="inspector-section">
      <h4>Data Sufficiency</h4>
      <dl className="inspector-kv">
        {sufficiency.status && <div><dt>Status</dt><dd>{formatLabel(sufficiency.status)}</dd></div>}
        {sufficiency.row_count !== undefined && <div><dt>Rows</dt><dd>{formatValue(sufficiency.row_count)}</dd></div>}
        {sufficiency.sample_size !== undefined && <div><dt>Sample</dt><dd>{formatValue(sufficiency.sample_size)}</dd></div>}
        {sufficiency.non_null_count !== undefined && <div><dt>Non-null</dt><dd>{formatValue(sufficiency.non_null_count)}</dd></div>}
      </dl>
      {sufficiency.summary && <p className="inspector-muted">{sufficiency.summary}</p>}
    </section>
  );
};

const LimitationsSection = ({ limitations }) => {
  if (!Array.isArray(limitations) || limitations.length === 0) return null;

  return (
    <section className="inspector-section inspector-section--limitations">
      <h4><FiAlertTriangle aria-hidden="true" /> Limitations</h4>
      <ul>
        {limitations.map((limitation, index) => <li key={`${limitation}-${index}`}>{limitation}</li>)}
      </ul>
    </section>
  );
};

const InspectorUnavailable = ({ title }) => (
  <div className="inspector-empty-state">
    <FiInfo aria-hidden="true" />
    <h4>{title}</h4>
    <p>No detailed contract data is available for this graph item.</p>
  </div>
);

export default InspectorPanel;
