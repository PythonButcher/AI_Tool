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
    onPointerDown={e => e.stopPropagation()}
    onMouseDown={e => e.stopPropagation()}
  >
    <span aria-hidden="true">{icon}</span>
    <span className="sr-only">{label}</span>
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
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <article 
      ref={setNodeRef}
      style={style}
      className={`semantic-model-panel__definition-card semantic-model-panel__definition-card--${isMetric ? 'metric' : 'dimension'} ${isDragging ? 'is-dragging' : ''}`}
      title={`Drag to add ${item.label} to canvas`}
      {...listeners}
      {...attributes}
    >
      <div className="semantic-model-panel__drag-handle">
        <AiOutlineHolder />
      </div>
      
      <div className="semantic-model-panel__definition-content">
        <div className="semantic-model-panel__definition-header">
          <span className={`semantic-model-panel__definition-icon semantic-model-panel__definition-icon--${isMetric ? 'metric' : 'dimension'}`} aria-hidden="true">
            {icon}
          </span>
          <div className="semantic-model-panel__definition-copy">
            <h5>{item.label}</h5>
            <div className="semantic-model-panel__definition-meta">
              <span className={`semantic-model-panel__badge semantic-model-panel__badge--${isMetric ? 'metric' : 'dimension'}`}>
                {item.definitionLabel || (isMetric ? 'Metric' : 'Dimension')}
              </span>
            </div>
          </div>
        </div>

        <div className="semantic-model-panel__definition-actions" onPointerDown={e => e.stopPropagation()}>
          {typeof onCreateSemanticChart === 'function' && (
            <MetricActionButton
              icon={<AiOutlineLineChart />}
              label="Chart"
              tone={isMetric ? 'metric' : 'dimension'}
              title="Create Chart"
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
              title="Create KPI"
              onClick={() => onCreateKpiCard({ metricId: item.id })}
            />
          )}
          {typeof onAddDashboardFilter === 'function' && (
            <MetricActionButton
              icon={<AiOutlineFilter />}
              label="Filter"
              tone="neutral"
              title="Add to Dashboard Filters"
              onClick={() => onAddDashboardFilter(item)}
            />
          )}
          {typeof onEditSemanticMetric === 'function' && isMetric && (
            <MetricActionButton
              icon={<AiOutlineEdit />}
              label="Edit"
              tone="neutral"
              title="Edit Definition"
              onClick={() => onEditSemanticMetric(item)}
            />
          )}
        </div>
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
    fieldType: PropTypes.string,
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
  const defaultMetricId = metrics[0]?.id || '';

  useEffect(() => {
    if (!editorRequest?.isOpen) return;

    setEditorInitialMetricId(editorRequest.initialMetricId || '__new__');
    setEditorInitialDraft(editorRequest.initialDraft || null);
    setIsEditorOpen(true);
  }, [editorRequest]);

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
      <div className="semantic-model-panel__header-modern">
        <div className="semantic-model-panel__header-actions">
          <button
            type="button"
            className="semantic-model-panel__pill-btn"
            onClick={() => handleOpenEditor()}
            disabled={!semanticModel}
          >
            + New Metric
          </button>
        </div>
      </div>

      <div className="semantic-model-panel__list-grid">
        {metrics.length > 0 && (
          <div className="semantic-model-panel__list-block">
            <div className="semantic-model-panel__list-header">
              <h4>Metrics</h4>
              <span className="semantic-model-panel__list-hint">Drag into workspace or click actions</span>
            </div>
            <div className="semantic-model-panel__definition-grid">
              {metrics.map((metric) => (
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
          </div>
        )}

        {dimensions.length > 0 && (
          <div className="semantic-model-panel__list-block">
            <div className="semantic-model-panel__list-header">
              <h4>Dimensions</h4>
              <span className="semantic-model-panel__list-hint">Drag to group charts or filter</span>
            </div>
            <div className="semantic-model-panel__definition-grid">
              {dimensions.map((dimension) => (
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
          </div>
        )}
        
        {metrics.length === 0 && dimensions.length === 0 && (
          <div className="semantic-model-panel__empty-state">
            <div className="empty-icon-pulse">
              <AiOutlineHolder />
            </div>
            <p>Connect a dataset to infer semantics</p>
          </div>
        )}
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
