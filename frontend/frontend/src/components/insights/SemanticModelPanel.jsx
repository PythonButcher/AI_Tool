import React from 'react';
import PropTypes from 'prop-types';
import './SemanticModelPanel.css';

const renderChipLabel = (item, suffix = null) => {
  const label = item?.label || item?.name || item?.field || 'Unnamed';
  return suffix ? `${label} · ${suffix}` : label;
};

function SemanticModelPanel({ semanticModel, status, onCreateSemanticChart }) {
  const metrics = semanticModel?.metrics || [];
  const dimensions = semanticModel?.dimensions || [];
  const entities = semanticModel?.entities || [];
  const datasetMeta = semanticModel?.dataset || {};
  const canCreateChart = typeof onCreateSemanticChart === 'function' && metrics.length > 0;

  let statusCopy = 'Business definitions will appear here once a dataset is available.';
  if (status === 'loading') {
    statusCopy = 'Inferring business metrics and dimensions from the active dataset.';
  } else if (status === 'error') {
    statusCopy = 'Semantic inference failed. Dataset-first workflows remain available.';
  } else if (status === 'ready') {
    statusCopy = metrics.length || dimensions.length
      ? 'Business-level definitions are now available alongside raw dataset fields.'
      : 'The dataset loaded, but no semantic metrics or dimensions were inferred yet.';
  }

  return (
    <section className={`semantic-model-panel semantic-model-panel--${status}`}>
      <div className="semantic-model-panel__header">
        <div>
          <p className="semantic-model-panel__eyebrow">Semantic Layer</p>
          <h3 className="semantic-model-panel__title">Business Definitions</h3>
        </div>
        {onCreateSemanticChart && (
          <button
            type="button"
            className="semantic-model-panel__action"
            onClick={onCreateSemanticChart}
            disabled={!canCreateChart}
          >
            New semantic chart
          </button>
        )}
      </div>

      <p className="semantic-model-panel__status">{statusCopy}</p>

      <div className="semantic-model-panel__stats" aria-label="Semantic model counts">
        <div className="semantic-model-panel__stat">
          <span className="semantic-model-panel__stat-value">{entities.length}</span>
          <span className="semantic-model-panel__stat-label">Entities</span>
        </div>
        <div className="semantic-model-panel__stat">
          <span className="semantic-model-panel__stat-value">{dimensions.length}</span>
          <span className="semantic-model-panel__stat-label">Dimensions</span>
        </div>
        <div className="semantic-model-panel__stat">
          <span className="semantic-model-panel__stat-value">{metrics.length}</span>
          <span className="semantic-model-panel__stat-label">Metrics</span>
        </div>
      </div>

      {(datasetMeta.name || entities.length > 0) && (
        <div className="semantic-model-panel__meta">
          <span>
            Dataset: <strong>{datasetMeta.name || entities[0]?.label || 'Active Dataset'}</strong>
          </span>
          <span>
            Grain: <strong>{entities[0]?.grain || 'record'}</strong>
          </span>
        </div>
      )}

      <div className="semantic-model-panel__list-grid">
        <div className="semantic-model-panel__list-block">
          <h4>Metrics</h4>
          {metrics.length > 0 ? (
            <div className="semantic-model-panel__chips">
              {metrics.slice(0, 6).map((metric) => (
                <span className="semantic-model-panel__chip semantic-model-panel__chip--metric" key={metric.id || metric.name}>
                  {renderChipLabel(metric, metric.default_aggregation || metric.expression?.aggregation || 'metric')}
                </span>
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic metrics inferred yet.</p>
          )}
        </div>

        <div className="semantic-model-panel__list-block">
          <h4>Dimensions</h4>
          {dimensions.length > 0 ? (
            <div className="semantic-model-panel__chips">
              {dimensions.slice(0, 6).map((dimension) => (
                <span className="semantic-model-panel__chip semantic-model-panel__chip--dimension" key={dimension.id || dimension.name}>
                  {renderChipLabel(dimension, dimension.semantic_kind || dimension.data_type || 'dimension')}
                </span>
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic dimensions inferred yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

SemanticModelPanel.propTypes = {
  semanticModel: PropTypes.shape({
    dataset: PropTypes.object,
    entities: PropTypes.array,
    dimensions: PropTypes.array,
    metrics: PropTypes.array,
  }),
  status: PropTypes.string,
  onCreateSemanticChart: PropTypes.func,
};

SemanticModelPanel.defaultProps = {
  semanticModel: null,
  status: 'idle',
  onCreateSemanticChart: null,
};

export default SemanticModelPanel;
