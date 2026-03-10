import React, { useEffect, useMemo, useState } from 'react';
import { useDndMonitor, useDroppable } from '@dnd-kit/core';
import { normalizeDatasetRows, useActiveDataset, useSemanticModel } from '../../context/DataContext';
import { useWindowContext } from '../../context/WindowContext';
import { normalizeSemanticMetric } from '../../utils/semanticObjectUtils';
import {
  buildPreviousPeriodFilters,
  buildResolverFilters,
} from '../../utils/dashboardFilterUtils';
import { formatSemanticValue } from '../../utils/semanticChartUtils';
import { FaArrowUp, FaArrowDown, FaMinus, FaCog } from 'react-icons/fa';
import './KpiCardWindow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const fetchMetricResolution = async ({ metricId, datasetRows, semanticModel, filters }) => {
  const response = await fetch(`${API_URL}/api/semantic-metrics/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric_id: metricId,
      dataset: datasetRows,
      semantic_model: semanticModel,
      filters,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to resolve KPI metric.');
  }
  return payload;
};

const formatDelta = (delta, formatHint) => {
  if (delta === null || delta === undefined) return '0';
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatSemanticValue(delta, formatHint)}`;
};

function KpiCardWindow({ id, item, dashboardFilters, isLocked }) {
  const activeDataset = useActiveDataset();
  const semanticModel = useSemanticModel();
  const { updateDashboardItem } = useWindowContext();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [resolution, setResolution] = useState(null);
  const [comparisonResolution, setComparisonResolution] = useState(null);
  const [activeDragPayload, setActiveDragPayload] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const metricOptions = useMemo(
    () => (semanticModel?.metrics || []).map(normalizeSemanticMetric),
    [semanticModel]
  );
  const datasetRows = useMemo(
    () => normalizeDatasetRows(activeDataset),
    [activeDataset]
  );

  const selectedMetricId = item?.semanticConfig?.metricId || '';
  const selectedMetric = metricOptions.find((metric) => metric.id === selectedMetricId) || null;

  const { setNodeRef, isOver } = useDroppable({
    id: `kpi-${id}-metric`,
    data: {
      dashboardItemId: id,
      dashboardRole: 'metric',
      acceptedObjectKinds: ['metric'],
    },
  });

  useDndMonitor({
    onDragStart: (event) => {
      const current = event.active?.data?.current;
      if (current?.type === 'semantic-object') {
        setActiveDragPayload(current);
      }
    },
    onDragEnd: () => setActiveDragPayload(null),
    onDragCancel: () => setActiveDragPayload(null),
  });

  useEffect(() => {
    if (!selectedMetricId) {
      setStatus('awaiting_selection');
      setResolution(null);
      setComparisonResolution(null);
      setError('');
      return;
    }

    if (!datasetRows.length || !semanticModel) {
      setStatus('missing_data');
      setResolution(null);
      setComparisonResolution(null);
      setError('Load a dataset to populate KPI.');
      return;
    }

    let isCancelled = false;

    const resolveKpi = async () => {
      setStatus('loading');
      setError('');

      try {
        const currentFilters = buildResolverFilters(dashboardFilters, semanticModel);
        const previousFilters = item.comparisonEnabled
          ? buildPreviousPeriodFilters(dashboardFilters)
          : null;

        const [currentResult, comparisonResult] = await Promise.all([
          fetchMetricResolution({
            metricId: selectedMetricId,
            datasetRows,
            semanticModel,
            filters: currentFilters,
          }),
          previousFilters
            ? fetchMetricResolution({
              metricId: selectedMetricId,
              datasetRows,
              semanticModel,
              filters: buildResolverFilters(previousFilters, semanticModel),
            })
            : Promise.resolve(null),
        ]);

        if (!isCancelled) {
          setResolution(currentResult);
          setComparisonResolution(comparisonResult);
          setStatus('ready');
        }
      } catch (requestError) {
        if (!isCancelled) {
          setStatus('error');
          setResolution(null);
          setComparisonResolution(null);
          setError(requestError.message);
        }
      }
    };

    resolveKpi();

    return () => {
      isCancelled = true;
    };
  }, [dashboardFilters, datasetRows, item.comparisonEnabled, semanticModel, selectedMetricId]);

  const currentValue = resolution?.summary?.value;
  const previousValue = comparisonResolution?.summary?.value;
  const deltaValue = typeof currentValue === 'number' && typeof previousValue === 'number'
    ? currentValue - previousValue
    : null;
  const deltaPercent = typeof deltaValue === 'number' && typeof previousValue === 'number' && previousValue !== 0
    ? deltaValue / previousValue
    : null;
  const formatHint = resolution?.metric?.format_hint || selectedMetric?.format_hint;

  const renderTrend = () => {
    if (!item.comparisonEnabled || status !== 'ready' || deltaValue === null) return null;

    const isPositive = deltaValue > 0;
    const isNegative = deltaValue < 0;
    const percentStr = deltaPercent !== null ? `${(Math.abs(deltaPercent) * 100).toFixed(1)}%` : '';

    return (
      <div className={`kpi-trend ${isPositive ? 'is-positive' : isNegative ? 'is-negative' : 'is-neutral'}`}>
        <span className="kpi-trend__icon">
          {isPositive && <FaArrowUp />}
          {isNegative && <FaArrowDown />}
          {!isPositive && !isNegative && <FaMinus />}
        </span>
        <span className="kpi-trend__value">{percentStr}</span>
        <span className="kpi-trend__label">vs last period</span>
      </div>
    );
  };

  return (
    <div ref={setNodeRef} className={`kpi-card-window ${isOver ? 'kpi-card-window--drop' : ''} ${showSettings ? 'settings-open' : ''}`}>
      <div className="kpi-card-window__header">
        <div className="kpi-card-window__eyebrow">
          {selectedMetric?.helperLabel || 'Metric'}
        </div>
        <button 
            className="kpi-card-settings-toggle" 
            onClick={() => setShowSettings(!showSettings)}
            title="Configure KPI"
        >
            <FaCog />
        </button>
      </div>

      {showSettings && (
        <div className="kpi-card-window__toolbar">
            <label className="kpi-card-window__field">
            <span>Select Metric</span>
            <select
                value={selectedMetricId}
                onChange={(event) => updateDashboardItem(id, {
                semanticConfig: { metricId: event.target.value },
                })}
                disabled={isLocked || metricOptions.length === 0}
            >
                <option value="">Select metric</option>
                {metricOptions.map((metric) => (
                <option key={metric.id} value={metric.id}>
                    {metric.label}
                </option>
                ))}
            </select>
            </label>

            <label className="kpi-card-window__toggle">
            <input
                type="checkbox"
                checked={item.comparisonEnabled !== false}
                onChange={(event) => updateDashboardItem(id, {
                comparisonEnabled: event.target.checked,
                })}
                disabled={isLocked}
            />
            <span>Enable Comparison</span>
            </label>
        </div>
      )}

      <div className="kpi-card-window__body">
        <h3 className="kpi-card-window__title">
            {selectedMetric?.label || 'KPI Card'}
        </h3>

        {status === 'error' && <div className="kpi-card-window__status kpi-card-window__status--error">{error}</div>}
        {status === 'loading' && <div className="kpi-card-window__loader"><div></div></div>}
        
        {status === 'awaiting_selection' && (
          <div className="kpi-card-window__empty">
            <div className="empty-icon">🎯</div>
            <strong>Drop a metric</strong>
            <span>Select from Business Definitions</span>
          </div>
        )}

        {status === 'ready' && (
          <div className="kpi-card-content">
            <div className="kpi-card-window__value">
                {formatSemanticValue(currentValue, formatHint)}
            </div>
            {renderTrend()}
            {comparisonResolution && typeof previousValue !== 'undefined' && (
              <div className="kpi-card-window__subtle">
                Prev: {formatSemanticValue(previousValue, formatHint)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KpiCardWindow;
