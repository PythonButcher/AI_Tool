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
  if (delta === null || delta === undefined) return 'No change data';

  if (formatHint === 'percentage') {
    return `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)} pts`;
  }

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
      setError('Load a dataset with semantic definitions to populate KPI cards.');
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

  const comparisonCopy = useMemo(() => {
    if (!item.comparisonEnabled) {
      return 'Previous-period comparison is turned off for this card.';
    }
    if (!dashboardFilters?.dateDimensionId || !dashboardFilters?.startDate || !dashboardFilters?.endDate) {
      return 'Add a dashboard date range to compare against the previous period.';
    }
    if (comparisonResolution && typeof deltaValue === 'number') {
      const percentCopy = deltaPercent === null
        ? 'No percentage delta'
        : `${deltaPercent >= 0 ? '+' : ''}${(deltaPercent * 100).toFixed(1)}%`;
      return `${formatDelta(deltaValue, formatHint)} vs previous period (${percentCopy}).`;
    }
    if (status === 'loading') {
      return 'Resolving comparison period.';
    }
    return 'Comparison data is unavailable for the selected range.';
  }, [comparisonResolution, dashboardFilters, deltaPercent, deltaValue, formatHint, item.comparisonEnabled, status]);

  return (
    <div ref={setNodeRef} className={`kpi-card-window ${isOver ? 'kpi-card-window--drop' : ''}`}>
      <div className="kpi-card-window__toolbar">
        <label className="kpi-card-window__field">
          <span>Metric</span>
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
                {metric.label} · {metric.helperLabel}
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
          <span>Compare</span>
        </label>
      </div>

      <div className="kpi-card-window__body">
        <div className="kpi-card-window__eyebrow">KPI Card</div>
        <h3 className="kpi-card-window__title">{selectedMetric?.label || 'Choose a business metric'}</h3>

        {status === 'error' && <div className="kpi-card-window__status kpi-card-window__status--error">{error}</div>}
        {status === 'loading' && <div className="kpi-card-window__status">Resolving metric through the centralized resolver...</div>}
        {status === 'missing_data' && <div className="kpi-card-window__status">{error}</div>}

        {status === 'awaiting_selection' && (
          <div className="kpi-card-window__empty">
            <strong>Drop a semantic metric here</strong>
            <span>
              {activeDragPayload?.label
                ? `Release ${activeDragPayload.label} to create a KPI card.`
                : 'Or pick a metric from the dropdown above.'}
            </span>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="kpi-card-window__value">{formatSemanticValue(currentValue, formatHint)}</div>
            <div className={`kpi-card-window__delta ${deltaValue > 0 ? 'is-positive' : deltaValue < 0 ? 'is-negative' : ''}`}>
              {comparisonCopy}
            </div>
            {comparisonResolution && typeof previousValue !== 'undefined' && (
              <div className="kpi-card-window__subtle">
                Previous period: {formatSemanticValue(previousValue, formatHint)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default KpiCardWindow;
