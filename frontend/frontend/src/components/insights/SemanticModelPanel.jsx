import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  AiOutlineEdit,
  AiOutlineFilter,
  AiOutlineFundProjectionScreen,
  AiOutlineLineChart,
  AiOutlinePlusSquare,
  AiOutlineTag,
  AiOutlineHolder,
} from 'react-icons/ai';
import { normalizeSemanticMetric, normalizeSemanticDimension, toSemanticDragData } from '../../utils/semanticObjectUtils';
import SemanticMetricEditor from '../../features/semantic/SemanticMetricEditor';
import './SemanticModelPanel.css';

const MetricActionButton = ({ icon, label, onClick, tone, title }) => (
  <button
    type="button"
    className={`semantic-model-panel__mini-action semantic-model-panel__mini-action--${tone}`}
    onClick={onClick}
    title={title || label}
  >
    <span aria-hidden="true">{icon}</span>
    <span>{label}</span>
  </button>
);

MetricActionButton.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  tone: PropTypes.oneOf(['metric', 'dimension', 'neutral']),
  title: PropTypes.string,
};

MetricActionButton.defaultProps = {
  onClick: null,
  tone: 'neutral',
  title: '',
};

const DefinitionCard = ({
  item,
  icon,
  defaultMetricId,
  onCreateSemanticChart,
  onCreateKpiCard,
  onEditSemanticMetric,
  onAddDashboardFilter,
}) => {
  const isMetric = item.objectKind === 'metric';
  const dragData = toSemanticDragData({
    ...item,
    dragId: `semantic:${item.objectKind}:${item.id}`,
    dragType: 'semantic-object',
    type: isMetric ? 'numeric' : (item.fieldType || 'categorical'),
    source: 'semantic',
  });

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `semantic:${item.objectKind}:${item.id}`,
    data: dragData,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
    cursor: 'grab',
  };

  return (
    <article 
      ref={setNodeRef}
      style={style}
      className={`semantic-model-panel__definition-card semantic-model-panel__definition-card--${isMetric ? 'metric' : 'dimension'} ${isDragging ? 'is-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="semantic-model-panel__definition-header">
        <span className={`semantic-model-panel__definition-icon semantic-model-panel__definition-icon--${isMetric ? 'metric' : 'dimension'}`} aria-hidden="true">
          {icon}
        </span>
        <div className="semantic-model-panel__definition-copy">
          <h5>{item.label}</h5>
          <div className="semantic-model-panel__definition-meta">
            <span className={`semantic-model-panel__badge semantic-model-panel__badge--${isMetric ? 'metric' : 'dimension'}`}>
              {item.definitionLabel}
            </span>
            {item.field && (
              <span className="semantic-model-panel__badge semantic-model-panel__badge--field">
                {item.field}
              </span>
            )}
          </div>
        </div>
        <div className="semantic-model-panel__drag-hint">
          <AiOutlineHolder />
        </div>
      </div>

      <div className="semantic-model-panel__definition-actions" onPointerDown={e => e.stopPropagation()}>
        {typeof onCreateSemanticChart === 'function' && (
          <MetricActionButton
            icon={<AiOutlineLineChart />}
            label="Chart"
            tone={isMetric ? 'metric' : 'dimension'}
            onClick={() => onCreateSemanticChart(
              isMetric
                ? { metricId: item.id }
                : { metricId: defaultMetricId || '', groupBy: item.id }
            )}
          />
        )}
        {typeof onCreateKpiCard === 'function' && isMetric && (
          <MetricActionButton
            icon={<AiOutlinePlusSquare />}
            label="KPI"
            tone="metric"
            onClick={() => onCreateKpiCard({ metricId: item.id })}
          />
        )}
        {typeof onAddDashboardFilter === 'function' && (
          <MetricActionButton
            icon={<AiOutlineFilter />}
            label="Filter"
            tone="neutral"
            onClick={() => onAddDashboardFilter(item)}
          />
        )}
      </div>
    </article>
  );
};

DefinitionCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    field: PropTypes.string,
    objectKind: PropTypes.oneOf(['metric', 'dimension']).isRequired,
    definitionLabel: PropTypes.string,
    statusLabel: PropTypes.string,
    is_user_defined: PropTypes.bool,
  }).isRequired,
  icon: PropTypes.node.isRequired,
  defaultMetricId: PropTypes.string,
  onCreateSemanticChart: PropTypes.func,
  onCreateKpiCard: PropTypes.func,
  onEditSemanticMetric: PropTypes.func,
  onAddDashboardFilter: PropTypes.func,
};

DefinitionCard.defaultProps = {
  defaultMetricId: '',
  onCreateSemanticChart: null,
  onCreateKpiCard: null,
  onEditSemanticMetric: null,
  onAddDashboardFilter: null,
};

function SemanticModelPanel({
  semanticModel,
  status,
  onCreateSemanticChart,
  onCreateKpiCard,
  onEditSemanticMetric,
  onAddDashboardFilter,
  editorRequest,
  onEditorClose,
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorInitialMetricId, setEditorInitialMetricId] = useState('__new__');
  const [editorInitialDraft, setEditorInitialDraft] = useState(null);

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
  const summary = semanticModel?.summary || {};
  const defaultMetricId = metrics[0]?.id || '';
  const canCreateChart = typeof onCreateSemanticChart === 'function' && (metrics.length > 0 || dimensions.length > 0);
  const canCreateKpi = typeof onCreateKpiCard === 'function' && metrics.length > 0;

  useEffect(() => {
    if (!editorRequest?.isOpen) return;

    setEditorInitialMetricId(editorRequest.initialMetricId || '__new__');
    setEditorInitialDraft(editorRequest.initialDraft || null);
    setIsEditorOpen(true);
  }, [editorRequest]);

  let statusCopy = 'Business definitions will appear here once a dataset is available.';
  if (status === 'loading') {
    statusCopy = 'Inferring business metrics and dimensions from the active dataset.';
  } else if (status === 'error') {
    statusCopy = 'Semantic inference failed. Raw field workflows remain available.';
  } else if (status === 'ready') {
    statusCopy = metrics.length || dimensions.length
      ? 'Use these business definitions to start semantic charts, KPI cards, and reusable dashboard filters without hunting through raw columns.'
      : 'The dataset loaded, but no semantic metrics or dimensions were inferred yet.';
  }

  const handleOpenEditor = (metric = null) => {
    setEditorInitialMetricId(metric?.id || '__new__');
    setEditorInitialDraft(null);
    setIsEditorOpen(true);
    if (typeof onEditSemanticMetric === 'function' && metric) {
      onEditSemanticMetric(metric);
    }
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditorInitialMetricId('__new__');
    setEditorInitialDraft(null);
    if (typeof onEditorClose === 'function') {
      onEditorClose();
    }
  };

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
              onClick={() => onCreateSemanticChart({ metricId: defaultMetricId })}
              disabled={!canCreateChart}
            >
              New semantic chart
            </button>
          )}
          <button
            type="button"
            className="semantic-model-panel__action semantic-model-panel__action--editor"
            onClick={() => {
              setEditorInitialMetricId('__new__');
              setEditorInitialDraft(null);
              setIsEditorOpen(true);
            }}
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
          <span>
            Custom metrics: <strong>{summary.user_defined_metric_count || metrics.filter((metric) => metric.is_user_defined).length}</strong>
          </span>
        </div>
      )}

      <div className="semantic-model-panel__insight-strip">
        <div className="semantic-model-panel__insight">
          <strong>Start with metrics</strong>
          <span>Metrics are resolver-backed and ready for charts, KPIs, and business monitoring.</span>
        </div>
        <div className="semantic-model-panel__insight">
          <strong>Use dimensions to filter or group</strong>
          <span>Dimensions can seed chart grouping and dashboard filters in one click.</span>
        </div>
      </div>

      <div className="semantic-model-panel__list-grid">
        <div className="semantic-model-panel__list-block">
          <div className="semantic-model-panel__list-header">
            <h4>Metrics</h4>
            <span className="semantic-model-panel__list-hint">Create charts, KPI cards, or edit custom definitions directly</span>
          </div>
          {metrics.length > 0 ? (
            <div className="semantic-model-panel__definition-grid">
              {metrics.slice(0, 8).map((metric) => (
                <DefinitionCard
                  key={metric.id}
                  item={metric}
                  icon={<AiOutlineFundProjectionScreen />}
                  defaultMetricId={defaultMetricId}
                  onCreateSemanticChart={onCreateSemanticChart}
                  onCreateKpiCard={onCreateKpiCard}
                  onEditSemanticMetric={handleOpenEditor}
                  onAddDashboardFilter={onAddDashboardFilter}
                />
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic metrics available yet.</p>
          )}
        </div>

        <div className="semantic-model-panel__list-block">
          <div className="semantic-model-panel__list-header">
            <h4>Dimensions</h4>
            <span className="semantic-model-panel__list-hint">Group semantic charts or add dashboard filters without leaving the workflow</span>
          </div>
          {dimensions.length > 0 ? (
            <div className="semantic-model-panel__definition-grid">
              {dimensions.slice(0, 8).map((dimension) => (
                <DefinitionCard
                  key={dimension.id}
                  item={dimension}
                  icon={<AiOutlineTag />}
                  defaultMetricId={defaultMetricId}
                  onCreateSemanticChart={onCreateSemanticChart}
                  onAddDashboardFilter={onAddDashboardFilter}
                />
              ))}
            </div>
          ) : (
            <p className="semantic-model-panel__empty">No semantic dimensions inferred yet.</p>
          )}
        </div>
      </div>

      <SemanticMetricEditor
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        semanticModel={semanticModel}
        initialMetricId={editorInitialMetricId}
        initialDraft={editorInitialDraft}
        openRequestKey={editorRequest?.requestKey || 0}
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
    summary: PropTypes.object,
  }),
  status: PropTypes.string,
  onCreateSemanticChart: PropTypes.func,
  onCreateKpiCard: PropTypes.func,
  onEditSemanticMetric: PropTypes.func,
  onAddDashboardFilter: PropTypes.func,
  editorRequest: PropTypes.shape({
    isOpen: PropTypes.bool,
    initialMetricId: PropTypes.string,
    initialDraft: PropTypes.object,
    requestKey: PropTypes.number,
  }),
  onEditorClose: PropTypes.func,
};

SemanticModelPanel.defaultProps = {
  semanticModel: null,
  status: 'idle',
  onCreateSemanticChart: null,
  onCreateKpiCard: null,
  onEditSemanticMetric: null,
  onAddDashboardFilter: null,
  editorRequest: null,
  onEditorClose: null,
};

export default SemanticModelPanel;
