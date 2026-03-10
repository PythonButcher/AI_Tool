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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const MODE_BUTTON_STYLE = {
  padding: '6px 10px',
  borderRadius: '999px',
  border: '1px solid #d9dde7',
  background: '#ffffff',
  color: '#445',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
};

const SELECT_STYLE = {
  padding: '9px 10px',
  borderRadius: '8px',
  border: '1px solid #d9dde7',
  background: '#ffffff',
};

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
      style={{
        ...style,
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: '12px',
        border: isOver ? '2px dashed #2e7d32' : '1px dashed rgba(46, 125, 50, 0.35)',
        background: isOver ? 'rgba(46, 125, 50, 0.14)' : 'rgba(248, 252, 249, 0.92)',
        color: '#23432a',
        textAlign: 'center',
        padding: '14px',
        backdropFilter: 'blur(4px)',
        zIndex: 11,
      }}
    >
      <strong>{label}</strong>
      <span style={{ fontSize: '0.8rem', color: '#47604d' }}>{helperText}</span>
      {currentValue && (
        <span
          style={{
            fontSize: '0.76rem',
            padding: '4px 8px',
            borderRadius: '999px',
            background: 'rgba(46, 125, 50, 0.12)',
          }}
        >
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
      style={{
        ...style,
        position: 'absolute',
        backgroundColor: isOver ? 'rgba(52, 168, 83, 0.2)' : 'rgba(255, 255, 255, 0.85)',
        border: isOver ? '2px dashed #34a853' : '1px dashed #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        zIndex: 10,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        borderRadius: '8px',
        color: isOver ? '#1e4620' : '#555',
        pointerEvents: 'all',
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      {currentMapping && (
        <span
          style={{
            fontSize: '0.8em',
            marginTop: '4px',
            padding: '2px 6px',
            background: '#e0e0e0',
            borderRadius: '4px',
          }}
        >
          {currentMapping}
        </span>
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
  }, [dataSourceMode, datasetRows, dashboardResolverFilters, semanticMetrics.length, semanticModel, selectedGroupBy, selectedMetricId]);

  const semanticChartData = useMemo(
    () => buildSemanticChartData(semanticResolution),
    [semanticResolution]
  );

  const chartData = dataSourceMode === 'semantic' ? semanticChartData : rawChartData;
  const isEmpty = !chartData;
  const selectedMetric = semanticMetrics.find((metric) => metric.id === selectedMetricId) || null;
  const selectedDimension = semanticDimensions.find((dimension) => dimension.id === selectedGroupBy) || null;
  const isDraggingRawField = activeDragPayload?.type === 'field';
  const isDraggingSemanticObject = activeDragPayload?.type === 'semantic-object';
  const semanticDragLabel = activeDragPayload?.metadata?.label || activeDragPayload?.label || '';

  const semanticStatusCopy = useMemo(() => {
    if (dataSourceMode !== 'semantic') {
      return activeDashboardFilterCount > 0
        ? 'Dashboard-global filters are being applied to this raw chart before aggregation.'
        : 'Drop raw dataset fields onto the chart axes to keep using the existing workflow.';
    }

    if (semanticStatus === 'loading') {
      return 'Resolving the selected semantic metric through the centralized metric resolver.';
    }

    if (semanticStatus === 'error') {
      return semanticError;
    }

    if (semanticStatus === 'missing_model') {
      return 'Semantic definitions are not available yet for this dataset.';
    }

    if (semanticStatus === 'awaiting_selection') {
      return 'Choose or drop a semantic metric to build this chart from business definitions.';
    }

    if (semanticStatus === 'empty_dataset') {
      return 'No dataset rows are available for semantic metric resolution.';
    }

    if (semanticResolution) {
      const metricLabel = semanticResolution.metric?.label || selectedMetric?.label || 'Metric';
      const summaryValue = formatSemanticValue(
        semanticResolution.summary?.value,
        semanticResolution.metric?.format_hint
      );
      const groupLabel = selectedDimension?.label || selectedDimension?.name;
      const filterCopy = activeDashboardFilterCount > 0
        ? ` ${activeDashboardFilterCount} dashboard filters applied.`
        : '';
      return groupLabel
        ? `${metricLabel} grouped by ${groupLabel}. Summary value: ${summaryValue}.${filterCopy}`
        : `${metricLabel} across all rows. Summary value: ${summaryValue}.${filterCopy}`;
    }

    return 'Semantic charting is available for this dataset.';
  }, [activeDashboardFilterCount, dataSourceMode, semanticError, semanticResolution, semanticStatus, selectedDimension, selectedMetric]);

  const renderToolbar = () => (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '8px',
        background: '#f8f9fa',
        borderBottom: '1px solid #eee',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: '4px' }}>
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
            className={type === option.type ? 'active' : ''}
            style={{
              padding: '6px',
              border: 'none',
              background: type === option.type ? '#e8f0fe' : 'transparent',
              color: type === option.type ? '#1a73e8' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
            }}
            title={option.type}
          >
            {option.icon}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => handleModeChange('raw')}
          style={{
            ...MODE_BUTTON_STYLE,
            background: dataSourceMode === 'raw' ? '#e8f0fe' : '#ffffff',
            borderColor: dataSourceMode === 'raw' ? '#8ab4f8' : '#d9dde7',
            color: dataSourceMode === 'raw' ? '#1a73e8' : '#445',
          }}
        >
          Raw fields
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('semantic')}
          style={{
            ...MODE_BUTTON_STYLE,
            background: dataSourceMode === 'semantic' ? '#eef8f2' : '#ffffff',
            borderColor: dataSourceMode === 'semantic' ? '#7cc58d' : '#d9dde7',
            color: dataSourceMode === 'semantic' ? '#2e7d32' : '#445',
          }}
        >
          Semantic objects
        </button>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>
          {dataSourceMode === 'semantic' ? 'Business-definition mode' : isEmpty ? 'Draft' : `${type} Chart`}
        </div>
      </div>
    </div>
  );

  const renderSemanticControls = () => (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid #eef1f4',
        background: '#fbfcfe',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Business Definitions
          </div>
          <div style={{ color: '#57606a', fontSize: '0.84rem', marginTop: '3px' }}>
            Select from the semantic layer or drop business metrics and dimensions from the Analysis Inputs panel.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '999px', background: 'rgba(46, 125, 50, 0.1)', color: '#2e7d32' }}>
            {semanticMetrics.length} metrics
          </span>
          <span style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '999px', background: 'rgba(141, 110, 99, 0.12)', color: '#6d4c41' }}>
            {semanticDimensions.length} dimensions
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#445' }}>Semantic metric</span>
          <select
            value={selectedMetricId}
            onChange={(event) => handleSemanticConfigChange({ metricId: event.target.value })}
            disabled={isLocked || semanticMetrics.length === 0}
            style={SELECT_STYLE}
          >
            <option value="">Select metric</option>
            {semanticMetrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.label} · {metric.helperLabel}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#445' }}>Grouping dimension</span>
          <select
            value={selectedGroupBy}
            onChange={(event) => handleSemanticConfigChange({ groupBy: event.target.value })}
            disabled={isLocked || semanticDimensions.length === 0}
            style={SELECT_STYLE}
          >
            <option value="">No grouping</option>
            {semanticDimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label} · {dimension.helperLabel}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          fontSize: '0.84rem',
        }}
      >
        <div style={{ color: semanticStatus === 'error' ? '#c62828' : '#57606a' }}>
          {semanticStatusCopy}
        </div>
        <div style={{ color: '#7a7f87' }}>
          Resolver: <strong>/api/semantic-metrics/resolve</strong>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {renderToolbar()}
      {dataSourceMode === 'semantic' && renderSemanticControls()}

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {!isEmpty && <ChartComponent chartType={type} chartData={chartData} />}

        {isEmpty && dataSourceMode === 'raw' && !isDraggingRawField && !isDraggingSemanticObject && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#aaa',
              gap: '12px',
              textAlign: 'center',
              padding: '24px',
            }}
          >
            <IoAddCircleOutline size={48} />
            <p style={{ margin: 0 }}>
              {activeDashboardFilterCount > 0
                ? 'The dashboard filters left this chart with no rows. Adjust the filters or drop raw fields here.'
                : 'Drag raw fields here to build a chart'}
            </p>
          </div>
        )}

        {isEmpty && dataSourceMode === 'semantic' && !isDraggingSemanticObject && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              gap: '12px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <IoAddCircleOutline size={42} />
            <p style={{ maxWidth: '420px', margin: 0 }}>
              Select or drop a semantic metric and optional business dimension to build a chart from business definitions instead of raw columns.
            </p>
          </div>
        )}

        {dataSourceMode === 'raw' && isDraggingRawField && (
          <>
            <RawDropOverlay
              zoneId={id}
              axis="Y-Axis"
              label="Y-Axis (Values)"
              style={{ top: '10px', bottom: '50%', left: '10px', right: '10px' }}
              currentMapping={mapping['Y-Axis']}
            />
            <RawDropOverlay
              zoneId={id}
              axis="X-Axis"
              label="X-Axis (Categories)"
              style={{ top: '50%', bottom: '10px', left: '10px', right: '10px' }}
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
              label={dataSourceMode === 'semantic' ? 'Semantic metric' : 'Switch to semantic metric'}
              helperText={semanticDragLabel ? `Drop ${semanticDragLabel} here to set the chart metric.` : 'Drop a business metric here.'}
              currentValue={selectedMetric?.label}
              style={{ top: '10px', bottom: '50%', left: '10px', right: '10px' }}
            />
            <SemanticDropOverlay
              id={id}
              semanticRole="dimension"
              objectKinds={['dimension']}
              label="Grouping dimension"
              helperText={semanticDragLabel ? `Drop ${semanticDragLabel} here to group the metric.` : 'Drop a business dimension here.'}
              currentValue={selectedDimension?.label}
              style={{ top: '50%', bottom: '10px', left: '10px', right: '10px' }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SmartChartWindow;
