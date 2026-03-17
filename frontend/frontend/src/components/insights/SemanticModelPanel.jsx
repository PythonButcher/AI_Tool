import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { normalizeSemanticMetric, normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import SemanticMetricEditor from '../../features/semantic/SemanticMetricEditor';
import './SemanticModelPanel.css';

const renderChipLabel = (item, suffix = null) => {
  const label = item?.label || item?.name || item?.field || 'Unnamed';
  return suffix ? `${label} · ${suffix}` : label;
};

function SemanticModelPanel({ semanticModel, status, onCreateSemanticChart, onCreateKpiCard }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const metrics = useMemo(
    () => (semanticModel?.metrics || []).map(normalizeSemanticMetric),
    [semanticModel]
  );
  const dimensions = useMemo(
    () => (semanticModel?.dimensions || []).map(normalizeSemanticDimension),
    [semanticModel]
  );
  const entities = semanticModel?.entities || [];
  const datasetMeta = semanticModel?.dataset || {};
  const canCreateChart = typeof onCreateSemanticChart === 'function' && metrics.length > 0;
  const canCreateKpi = typeof onCreateKpiCard === 'function' && metrics.length > 0;

  let statusCopy = 'Business definitions will appear here once a dataset is available.';
  if (status === 'loading') {
    statusCopy = 'Inferring business metrics and dimensions from the active dataset.';
  } else if (status === 'error') {
    statusCopy = 'Semantic inference failed. Dataset-first workflows remain available.';
  } else if (status === 'ready') {
    statusCopy = metrics.length || dimensions.length
      ? 'Business-level definitions are now available alongside raw dataset fields. Create semantic charts or KPI cards directly from these definitions.'
      : 'The dataset loaded, but no semantic metrics or dimensions were inferred yet.';
  }

  return (
    <section className={`semantic-model-panel semantic-model-panel--${status}`}>
      <div className="semantic-model-panel__header">
        <div>
          <p className="semantic-model-panel__eyebrow">Semantic Layer</p>
          <h3 className="semantic-model-panel__title">Business Definitions</h3>
        </div>
        <div className="semantic-model-panel__actions">
          {onCreateKpiCard && (
            <button
              type="button"
              className="semantic-model-panel__action semantic-model-panel__action--monitoring"
              onClick={() => onCreateKpiCard()}
              disabled={!canCreateKpi}
            >
              New KPI card
            </button>
          )}
          {onCreateSemanticChart && (
            <button
              type="button"
              className="semantic-model-panel__action"
              onClick={() => onCreateSemanticChart()}
              disabled={!canCreateChart}
            >
              New semantic chart
            </button>
          )}
          <button
            type="button"
            className="semantic-model-panel__action semantic-model-panel__action--editor"
            onClick={() => setIsEditorOpen(true)}
            disabled={!semanticModel}
          >
            Manage metrics
          </button>
        </div>
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
          <div className="semantic-model-panel__list-header">
            <h4>Metrics</h4>
            <span className="semantic-model-panel__list-hint">Open a semantic chart or KPI card with a metric preselected</span>
          </div>
          {metrics.length > 0 ? (
            <div className="semantic-model-panel__chip-actions-grid">
              {metrics.slice(0, 6).map((metric) => (
                <div className="semantic-model-panel__chip-row" key={metric.id}>
                  <button
                    type="button"
                    className="semantic-model-panel__chip semantic-model-panel__chip--metric semantic-model-panel__chip-button"
                    onClick={() => onCreateSemanticChart && onCreateSemanticChart({ metricId: metric.id })}
                  >
                    {renderChipLabel(metric, `${metric.helperLabel} · ${metric.is_user_defined ? 'custom' : 'inferred'}`)}
                  </button>
                  {onCreateKpiCard && (
                    <button
                      type="button"
                      className="semantic-model-panel__mini-action"
                      onClick={() => onCreateKpiCard({ metricId: metric.id })}
                    >
                      KPI
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic metrics available yet.</p>
          )}
        </div>

        <div className="semantic-model-panel__list-block">
          <div className="semantic-model-panel__list-header">
            <h4>Dimensions</h4>
            <span className="semantic-model-panel__list-hint">Seed grouping into a semantic chart</span>
          </div>
          {dimensions.length > 0 ? (
            <div className="semantic-model-panel__chips">
              {dimensions.slice(0, 6).map((dimension) => (
                <button
                  type="button"
                  className="semantic-model-panel__chip semantic-model-panel__chip--dimension semantic-model-panel__chip-button"
                  key={dimension.id}
                  onClick={() => onCreateSemanticChart && onCreateSemanticChart({ groupBy: dimension.id })}
                >
                  {renderChipLabel(dimension, dimension.helperLabel)}
                </button>
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic dimensions inferred yet.</p>
          )}
        </div>
      </div>

      <SemanticMetricEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        semanticModel={semanticModel}
      />
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
  onCreateKpiCard: PropTypes.func,
};

SemanticModelPanel.defaultProps = {
  semanticModel: null,
  status: 'idle',
  onCreateSemanticChart: null,
  onCreateKpiCard: null,
};

export default SemanticModelPanel;
