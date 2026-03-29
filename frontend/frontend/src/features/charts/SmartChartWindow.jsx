import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDndMonitor, useDroppable } from '@dnd-kit/core';
import ChartComponent from './ChartComponent';
import { transformToChartData } from '../../utils/chartDataUtils';
import { buildSemanticChartData, formatSemanticValue } from '../../utils/semanticChartUtils';
import { normalizeSemanticMetric, normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import {
  applyDashboardFiltersToRows,
  buildResolverFilters,
  countActiveDashboardFilters,
} from '../../utils/dashboardFilterUtils';
import { TbChartBar, TbChartDots, TbChartLine, TbChartPie, TbChartDonut } from 'react-icons/tb';
import { IoAddCircleOutline } from 'react-icons/io5';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import './SmartChartWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SemanticDropOverlay = ({ id, label, helperText, currentValue, objectKinds, semanticRole, style }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `chart-${id}-${semanticRole}`,
    data: {
      targetChartId: id,
      semanticRole,
      acceptedObjectKinds: objectKinds,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`drop-overlay drop-overlay--semantic ${isOver ? 'is-over' : ''}`}
      style={style}
    >
      <strong className="drop-label">{label}</strong>
      <span className="drop-helper">{helperText}</span>
      {currentValue && (
        <span className="current-value-tag">
          {currentValue}
        </span>
      )}
    </div>
  );
};

const RawDropOverlay = ({ zoneId, axis, label, style, currentMapping }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `chart-${zoneId}-${axis}`,
    data: {
      targetChartId: zoneId,
      axis: axis === 'X-Axis' ? 'x' : 'y',
      allowedTypes: axis === 'Y-Axis' ? ['numeric'] : ['categorical', 'temporal'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`drop-overlay drop-overlay--raw ${isOver ? 'is-over' : ''}`}
      style={style}
    >
      <span className="drop-label">{label}</span>
      {currentMapping ? (
        <span className="current-value-tag">
          {currentMapping}
        </span>
      ) : (
        <span className="drop-helper">Drop field here</span>
      )}
    </div>
  );
};

const SmartChartWindow = ({
  id,
  data,
  type = 'Bar',
  mapping = {},
  isLocked,
  dataSourceMode = 'raw',
  semanticConfig = {},
  externalFilters = null,
}) => {
  const [activeDragPayload, setActiveDragPayload] = useState(null);
  const [semanticResolution, setSemanticResolution] = useState(null);
  const [semanticStatus, setSemanticStatus] = useState('idle');
  const [semanticError, setSemanticError] = useState('');
  const { updateChart, updateDashboardItem } = useWindowContext();
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();

  const semanticMetrics = useMemo(
    () => (semanticModel?.metrics || []).map(normalizeSemanticMetric),
    [semanticModel]
  );
  const semanticDimensions = useMemo(
    () => (semanticModel?.dimensions || []).map(normalizeSemanticDimension),
    [semanticModel]
  );
  const datasetRows = useMemo(
    () => normalizeDatasetRows(activeDataset || data),
    [activeDataset, data]
  );
  const filteredDatasetRows = useMemo(
    () => applyDashboardFiltersToRows(datasetRows, externalFilters, semanticModel),
    [datasetRows, externalFilters, semanticModel]
  );
  const dashboardResolverFilters = useMemo(
    () => buildResolverFilters(externalFilters, semanticModel),
    [externalFilters, semanticModel]
  );
  const activeDashboardFilterCount = useMemo(
    () => countActiveDashboardFilters(externalFilters),
    [externalFilters]
  );

  const selectedMetricId = semanticConfig?.metricId || '';
  const selectedGroupBy = semanticConfig?.groupBy || '';
  const selectedMetric = semanticMetrics.find((metric) => metric.id === selectedMetricId) || null;
  const selectedDimension = semanticDimensions.find((dimension) => dimension.id === selectedGroupBy) || null;

  useDndMonitor({
    onDragStart: (event) => {
      const current = event.active?.data?.current;
      if (current?.type === 'field' || current?.type === 'semantic-object') {
        setActiveDragPayload(current);
      }
    },
    onDragEnd: () => {
      setActiveDragPayload(null);
    },
    onDragCancel: () => {
      setActiveDragPayload(null);
    },
  });

  const handleChartTypeChange = useCallback((nextType) => {
    if (id.startsWith('dashboard-')) {
      updateDashboardItem(id, { chartType: nextType });
      return;
    }
    updateChart(id, { type: nextType });
  }, [id, updateChart, updateDashboardItem]);

  const handleModeChange = useCallback((nextMode) => {
    if (nextMode === dataSourceMode) return;
    if (id.startsWith('dashboard-')) {
      updateDashboardItem(id, { dataSourceMode: nextMode });
      return;
    }
    updateChart(id, { dataSourceMode: nextMode });
  }, [dataSourceMode, id, updateChart, updateDashboardItem]);

  const handleSemanticConfigChange = useCallback((updates) => {
    if (id.startsWith('dashboard-')) {
      updateDashboardItem(id, {
        dataSourceMode: 'semantic',
        semanticConfig: {
          metricId: semanticConfig?.metricId || '',
          groupBy: semanticConfig?.groupBy || '',
          ...updates,
        },
      });
      return;
    }

    updateChart(id, {
      dataSourceMode: 'semantic',
      semanticConfig: {
        metricId: semanticConfig?.metricId || '',
        groupBy: semanticConfig?.groupBy || '',
        ...updates,
      },
    });
  }, [id, semanticConfig, updateChart, updateDashboardItem]);

  const rawChartData = useMemo(() => {
    if (!filteredDatasetRows.length || !mapping['X-Axis'] || !mapping['Y-Axis']) return null;

    return transformToChartData(filteredDatasetRows, {
      labelField: mapping['X-Axis'],
      dataFields: [mapping['Y-Axis']],
    });
  }, [filteredDatasetRows, mapping]);

  useEffect(() => {
    if (dataSourceMode !== 'semantic') {
      setSemanticResolution(null);
      setSemanticError('');
      setSemanticStatus('idle');
      return;
    }

    if (!semanticModel || semanticMetrics.length === 0) {
      setSemanticResolution(null);
      setSemanticStatus('missing_model');
      setSemanticError('No semantic metrics are available for this dataset yet.');
      return;
    }

    if (!selectedMetricId) {
      setSemanticResolution(null);
      setSemanticStatus('awaiting_selection');
      setSemanticError('');
      return;
    }

    if (!selectedMetric) {
      setSemanticResolution(null);
      setSemanticStatus('invalid_selection');
      setSemanticError('The selected semantic metric is no longer available. Pick another metric to continue.');
      return;
    }

    if (selectedGroupBy && !selectedDimension) {
      setSemanticResolution(null);
      setSemanticStatus('invalid_selection');
      setSemanticError('The selected semantic dimension is no longer available. Choose another grouping.');
      return;
    }

    if (!datasetRows.length) {
      setSemanticResolution(null);
      setSemanticStatus('empty_dataset');
      setSemanticError('No dataset rows are available for semantic metric resolution.');
      return;
    }

    let isCancelled = false;

    const resolveMetric = async () => {
      setSemanticStatus('loading');
      setSemanticError('');

      try {
        const response = await fetch(`${API_URL}/api/semantic-metrics/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric_id: selectedMetricId,
            group_by: selectedGroupBy ? [selectedGroupBy] : [],
            dataset: datasetRows,
            semantic_model: semanticModel,
            filters: dashboardResolverFilters,
            sort: 'group_asc',
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to resolve semantic metric.');
        }

        if (!isCancelled) {
          setSemanticResolution(payload);
          setSemanticStatus('ready');
        }
      } catch (error) {
        if (!isCancelled) {
          setSemanticResolution(null);
          setSemanticStatus('error');
          setSemanticError(error.message);
        }
      }
    };

    resolveMetric();

    return () => {
      isCancelled = true;
    };
  }, [
    dataSourceMode,
    datasetRows,
    dashboardResolverFilters,
    semanticMetrics.length,
    semanticModel,
    selectedDimension,
    selectedGroupBy,
    selectedMetric,
    selectedMetricId,
  ]);

  const semanticChartData = useMemo(
    () => buildSemanticChartData(semanticResolution),
    [semanticResolution]
  );

  const chartData = dataSourceMode === 'semantic' ? semanticChartData : rawChartData;
  const isEmpty = !chartData;
  const isDraggingRawField = activeDragPayload?.type === 'field';
  const isDraggingSemanticObject = activeDragPayload?.type === 'semantic-object';
  const semanticDragLabel = activeDragPayload?.metadata?.label || activeDragPayload?.label || '';

  const semanticStatusCopy = useMemo(() => {
    if (dataSourceMode !== 'semantic') {
      return activeDashboardFilterCount > 0
        ? `Dashboard filters applied (${activeDashboardFilterCount})`
        : 'Drop raw fields to build chart';
    }

    if (semanticStatus === 'loading') return 'Resolving semantic metric...';
    if (semanticStatus === 'error') return semanticError;
    if (semanticStatus === 'invalid_selection') return semanticError;
    if (semanticStatus === 'missing_model') return 'Semantic model missing';
    if (semanticStatus === 'awaiting_selection') return 'Drop a business metric to start';
    
    if (semanticResolution) {
        const summaryValue = formatSemanticValue(
            semanticResolution.summary?.value,
            semanticResolution.metric?.format_hint
        );
        return `Summary: ${summaryValue} ${activeDashboardFilterCount > 0 ? `(${activeDashboardFilterCount} filters)` : ''}`;
    }
    return 'Semantic mode active';
  }, [activeDashboardFilterCount, dataSourceMode, semanticError, semanticResolution, semanticStatus]);

  const renderToolbar = () => (
    <div className="smart-chart-toolbar">
      <div className="chart-type-selector">
        {[
          { type: 'Bar', icon: <TbChartBar /> },
          { type: 'Line', icon: <TbChartLine /> },
          { type: 'Pie', icon: <TbChartPie /> },
          { type: 'Scatter', icon: <TbChartDots /> },
          { type: 'Doughnut', icon: <TbChartDonut /> },
        ].map((option) => (
          <button
            key={option.type}
            onClick={() => handleChartTypeChange(option.type)}
            className={`chart-type-btn ${type === option.type ? 'active' : ''}`}
            title={option.type}
          >
            {option.icon}
          </button>
        ))}
      </div>
    </div>
  );

  const renderSemanticControls = () => (
    <div className="semantic-controls">
      <div className="semantic-controls__header">
        <div className="semantic-controls__title">
          <strong>Business Definitions</strong>
          <p>Chart powered by semantic layer resolution</p>
        </div>
        <div className="semantic-controls__counts">
          <span className="semantic-controls__count semantic-controls__count--metric">{semanticMetrics.length} M</span>
          <span className="semantic-controls__count semantic-controls__count--dimension">{semanticDimensions.length} D</span>
        </div>
      </div>

      <div className="semantic-controls__inputs">
        <label className="semantic-field-group">
          <span>Metric</span>
          <select
            value={selectedMetricId}
            className="semantic-select"
            onChange={(event) => handleSemanticConfigChange({ metricId: event.target.value })}
            disabled={isLocked || semanticMetrics.length === 0}
          >
            <option value="">Select metric</option>
            {semanticMetrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>

        <label className="semantic-field-group">
          <span>Group By</span>
          <select
            value={selectedGroupBy}
            className="semantic-select"
            onChange={(event) => handleSemanticConfigChange({ groupBy: event.target.value })}
            disabled={isLocked || semanticDimensions.length === 0}
          >
            <option value="">No grouping</option>
            {semanticDimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={`semantic-status-bar ${semanticStatus === 'error' ? 'semantic-status--error' : ''}`}>
        <span>{semanticStatusCopy}</span>
        <span>Resolver: v1</span>
      </div>
    </div>
  );

  return (
    <div className="smart-chart-window">
      {renderToolbar()}
      {dataSourceMode === 'semantic' && renderSemanticControls()}

      <div className="chart-content-area">
        {!isEmpty && <ChartComponent chartType={type} chartData={chartData} />}

        {isEmpty && !isDraggingRawField && !isDraggingSemanticObject && (
          <div className="chart-placeholder">
            <IoAddCircleOutline size={48} />
            <p>
              {activeDashboardFilterCount > 0
                ? 'Current filters returned no data. Adjust filters or drop fields.'
                : 'Drag any field here from the explorer to start building your chart.'}
            </p>
          </div>
        )}

        {dataSourceMode === 'raw' && isDraggingRawField && (
          <>
            <RawDropOverlay
              zoneId={id}
              axis="Y-Axis"
              label="Values (Y)"
              style={{ top: '10px', bottom: '55%', left: '10px', right: '10px' }}
              currentMapping={mapping['Y-Axis']}
            />
            <RawDropOverlay
              zoneId={id}
              axis="X-Axis"
              label="Categories (X)"
              style={{ top: '45%', bottom: '10px', left: '10px', right: '10px' }}
              currentMapping={mapping['X-Axis']}
            />
          </>
        )}

        {isDraggingSemanticObject && (
          <>
            <SemanticDropOverlay
              id={id}
              semanticRole="metric"
              objectKinds={['metric']}
              label="Metric"
              helperText={semanticDragLabel ? `Set ${semanticDragLabel}` : 'Drop metric here'}
              currentValue={selectedMetric?.label}
              style={{ top: '10px', bottom: '55%', left: '10px', right: '10px' }}
            />
            <SemanticDropOverlay
              id={id}
              semanticRole="dimension"
              objectKinds={['dimension']}
              label="Group By"
              helperText={semanticDragLabel ? `Group by ${semanticDragLabel}` : 'Drop dimension here'}
              currentValue={selectedDimension?.label}
              style={{ top: '45%', bottom: '10px', left: '10px', right: '10px' }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SmartChartWindow;
