import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useDndMonitor } from '@dnd-kit/core';
import ChartComponent from './ChartComponent';
import { transformToChartData } from '../../utils/chartDataUtils';
import { buildSemanticChartData, formatSemanticValue } from '../../utils/semanticChartUtils';
import { normalizeSemanticMetric, normalizeSemanticDimension } from '../../utils/semanticObjectUtils';
import {
  applyDashboardFiltersToRows,
  buildResolverFilters,
  countActiveDashboardFilters,
  getSlicerConflict,
} from '../../utils/dashboardFilterUtils';
import { TbChartBar, TbChartDots, TbChartLine, TbChartPie, TbChartDonut } from 'react-icons/tb';
import { AiOutlineFundProjectionScreen, AiOutlineTag, AiOutlineFileSearch, AiOutlineLineChart } from 'react-icons/ai';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import DropZone from '../../utils/DropZone';
import './SmartChartWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const SmartChartWindow = ({
  id,
  data,
  type = 'Bar',
  mapping = {},
  isLocked,
  dataSourceMode = 'raw',
  semanticConfig = {},
  externalFilters = null,
  chartSpec = null,
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
    onDragEnd: () => setActiveDragPayload(null),
    onDragCancel: () => setActiveDragPayload(null),
  });

  const handleChartTypeChange = useCallback((nextType) => {
    if (id.startsWith('dashboard-')) {
      updateDashboardItem(id, { chartType: nextType });
      return;
    }
    updateChart(id, { type: nextType });
  }, [id, updateChart, updateDashboardItem]);

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

  const slicerConflictDimensionId = useMemo(() => {
    return getSlicerConflict(externalFilters, chartSpec?.slicers);
  }, [externalFilters, chartSpec?.slicers]);

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
      setSemanticError('Selected metric no longer available.');
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
          }),
        });

        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Resolution failed');

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
    return () => { isCancelled = true; };
  }, [dataSourceMode, datasetRows, dashboardResolverFilters, semanticMetrics.length, semanticModel, selectedGroupBy, selectedMetricId, selectedMetric]);

  const semanticChartData = useMemo(
    () => buildSemanticChartData(semanticResolution),
    [semanticResolution]
  );

  const chartData = dataSourceMode === 'semantic' ? semanticChartData : rawChartData;
  const isPopulated = dataSourceMode === 'semantic' ? !!selectedMetricId : (!!mapping['X-Axis'] && !!mapping['Y-Axis']);
  const isEmpty = !chartData;
  const isDraggingAny = !!activeDragPayload;
  const isDraggingRawField = activeDragPayload?.type === 'field';
  const isDraggingSemanticObject = activeDragPayload?.type === 'semantic-object';

  const semanticStatusCopy = useMemo(() => {
    if (dataSourceMode !== 'semantic') return activeDashboardFilterCount > 0 ? `Filters applied (${activeDashboardFilterCount})` : 'Ready for fields';
    if (semanticStatus === 'loading') return 'Resolving...';
    if (semanticStatus === 'error') return semanticError;
    if (semanticStatus === 'awaiting_selection') return 'Drop metric to start';
    
    if (semanticResolution) {
        const val = formatSemanticValue(semanticResolution.summary?.value, semanticResolution.metric?.format_hint);
        return `Value: ${val} ${activeDashboardFilterCount > 0 ? `(${activeDashboardFilterCount} filters)` : ''}`;
    }
    return 'Semantic layer active';
  }, [activeDashboardFilterCount, dataSourceMode, semanticError, semanticResolution, semanticStatus]);

  const isDashboardItem = id.startsWith('dashboard-') || !!externalFilters;

  const handleDataSourceModeChange = useCallback((nextMode) => {
    if (isDashboardItem) return; // Prevent switching in dashboard context
    updateChart(id, { dataSourceMode: nextMode });
  }, [id, isDashboardItem, updateChart]);

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

      {!isDashboardItem && (
        <div className="data-source-modes">
          <button
            className={`mode-btn ${dataSourceMode === 'raw' ? 'active-raw' : ''}`}
            onClick={() => handleDataSourceModeChange('raw')}
            title="Raw Explorer"
          >
            Raw Data
          </button>
          <button
            className={`mode-btn ${dataSourceMode === 'semantic' ? 'active-semantic' : ''}`}
            onClick={() => handleDataSourceModeChange('semantic')}
            title="Semantic Insight"
          >
            Intelligence
          </button>
        </div>
      )}

      <div className="semantic-status-mini">
        {semanticStatusCopy}
      </div>
      
      {chartSpec?.schemaVersion === 'chart_spec_v1' && (
        <div className="chart-actions-mini">
          <button className="mode-btn" onClick={() => {
            updateDashboardItem(`dashboard-chart-${Date.now()}`, {
              chartType: type,
              mapping,
              dataSourceMode,
              semanticConfig,
              chartSpec,
            });
          }}>Pin to Dashboard</button>
          <button className="mode-btn" onClick={() => {
             // duplicate logic could go here
          }}>Duplicate</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="smart-chart-window">
      {renderToolbar()}

      {dataSourceMode === 'raw' && !isDashboardItem && (
        <div className="semantic-controls" style={{ background: 'var(--bg-secondary-soft)', borderBottomColor: 'var(--border-color-soft)' }}>
          <div className="semantic-controls__title">
            <strong style={{ color: 'var(--accent-blue)' }}>Raw Data Mapping</strong>
          </div>
          <div className="semantic-controls__inputs">
            <div className="semantic-field-group">
              <span>Y-Axis</span>
              <select
                className="semantic-select"
                value={mapping['Y-Axis'] || ''}
                onChange={(e) => {
                  const newMapping = { ...mapping, 'Y-Axis': e.target.value };
                  if (id.startsWith('dashboard-')) {
                    updateDashboardItem(id, { mapping: newMapping });
                  } else {
                    updateChart(id, { mapping: newMapping });
                  }
                }}
                disabled={isLocked}
              >
                <option value="">Select field</option>
                {Object.keys(datasetRows[0] || {}).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="semantic-field-group">
              <span>X-Axis</span>
              <select
                className="semantic-select"
                value={mapping['X-Axis'] || ''}
                onChange={(e) => {
                  const newMapping = { ...mapping, 'X-Axis': e.target.value };
                  if (id.startsWith('dashboard-')) {
                    updateDashboardItem(id, { mapping: newMapping });
                  } else {
                    updateChart(id, { mapping: newMapping });
                  }
                }}
                disabled={isLocked}
              >
                <option value="">Select field</option>
                {Object.keys(datasetRows[0] || {}).map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {dataSourceMode === 'semantic' && (
        <div className="semantic-controls">
          <div className="semantic-controls__header">
            <div className="semantic-controls__title">
              <strong>Field Intelligence</strong>
            </div>
            <div className="semantic-controls__counts">
              <span className="semantic-controls__count semantic-controls__count--metric" title="Available Metrics">
                {semanticMetrics.length}
              </span>
              <span className="semantic-controls__count semantic-controls__count--dimension" title="Available Dimensions">
                {semanticDimensions.length}
              </span>
            </div>
          </div>

          <div className="semantic-controls__inputs">
            <div className="semantic-field-group">
              <span>Metric</span>
              <select
                className="semantic-select"
                value={selectedMetricId}
                onChange={(e) => handleSemanticConfigChange({ metricId: e.target.value })}
                disabled={isLocked || semanticMetrics.length === 0}
              >
                <option value="">Select metric</option>
                {semanticMetrics.map((metric) => (
                  <option key={metric.id} value={metric.id}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="semantic-field-group">
              <span>Group By</span>
              <select
                className="semantic-select"
                value={selectedGroupBy}
                onChange={(e) => handleSemanticConfigChange({ groupBy: e.target.value })}
                disabled={isLocked || semanticDimensions.length === 0}
              >
                <option value="">None (Summary)</option>
                {semanticDimensions.map((dim) => (
                  <option key={dim.id} value={dim.id}>
                    {dim.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {semanticStatus === 'error' && (
            <div className="semantic-status-bar semantic-status--error">
              {semanticError}
            </div>
          )}
        </div>
      )}

      <div className="chart-content-area">
        {slicerConflictDimensionId && (
          <div className="chart-empty-state">
             <AiOutlineFileSearch className="empty-icon" />
             <h4>Slicer Conflict</h4>
             <p>Dashboard filter and chart-local slicer conflict on <strong>{slicerConflictDimensionId}</strong>. No data overlap.</p>
          </div>
        )}
      
        {!isEmpty && !slicerConflictDimensionId && <ChartComponent chartType={type} chartData={chartData} />}

        {isEmpty && !isDraggingAny && !slicerConflictDimensionId && (
          <div className="chart-placeholder">
            <AiOutlineFileSearch size={40} />
            <p>
              {dataSourceMode === 'semantic' 
                ? 'Drop a business metric here from the Definitions pane.'
                : 'Drop raw fields from the explorer to build your chart.'}
            </p>
          </div>
        )}

        {dataSourceMode === 'raw' && isDraggingRawField && (
          <div className="drop-overlay-container">
            <DropZone
              axis="y"
              roleLabel="Values (Y)"
              helperText="Drop numeric field"
              allowedTypes={['numeric']}
              currentField={mapping['Y-Axis']}
            />
            <DropZone
              axis="x"
              roleLabel="Categories (X)"
              helperText="Drop grouping field"
              allowedTypes={['categorical', 'temporal']}
              currentField={mapping['X-Axis']}
            />
          </div>
        )}

        {isDraggingSemanticObject && (
          <div className="drop-overlay-container">
            <DropZone
              id={`drop-${id}-metric`}
              axis="y"
              roleLabel="Metric"
              helperText="Drop business metric"
              allowedTypes={['numeric']}
              currentField={selectedMetric?.label}
              icon={<AiOutlineFundProjectionScreen />}
              targetChartId={id}
              semanticRole="metric"
              acceptedObjectKinds={['metric']}
            />
            <DropZone
              id={`drop-${id}-groupBy`}
              axis="x"
              roleLabel="Group By"
              helperText="Drop business grouping"
              allowedTypes={['categorical', 'temporal']}
              currentField={selectedDimension?.label}
              icon={<AiOutlineTag />}
              targetChartId={id}
              semanticRole="dimension"
              acceptedObjectKinds={['dimension']}
            />
          </div>
        )}

        {!isPopulated && !isDraggingSemanticObject && (
          <div className="chart-empty-state">
            <AiOutlineLineChart className="empty-icon" />
            <h4>Ready to Visualize</h4>
            <p>Drag metrics or dimensions from the {dataSourceMode === 'semantic' ? 'Semantic Layer' : 'Field Catalog'} to start building.</p>
            
            <div className="empty-state-zones">
              <DropZone
                id={`empty-drop-${id}-y`}
                axis="y"
                roleLabel="Metric"
                allowedTypes={['numeric']}
                targetChartId={id}
                semanticRole="metric"
                acceptedObjectKinds={['metric']}
              />
              <DropZone
                id={`empty-drop-${id}-x`}
                axis="x"
                roleLabel="Group By"
                allowedTypes={['categorical', 'temporal']}
                targetChartId={id}
                semanticRole="dimension"
                acceptedObjectKinds={['dimension']}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartChartWindow;
