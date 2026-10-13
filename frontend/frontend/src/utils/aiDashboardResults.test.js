import { appendDashboardResults, canSaveResult } from './aiDashboardResults';

export const verifiedChart = {
  type: 'chart', title: 'Revenue by region', artifact_id: 'chart-1',
  content: { chartType: 'Bar', chartData: { labels: ['East', 'West'], datasets: [{ label: 'Revenue', data: [220, 285] }] } },
  bi_grounding: { dataset: { dataset_id: 'sales', dataset_name: 'Sales' }, row_count: 4,
    metric_definition: { id: 'revenue', label: 'Revenue' }, aggregation: 'sum', dimensions: [{ field: 'Region' }], filters: [] },
  dataset_context: { fingerprint: 'sales-v1' },
};

test('appends below existing layout and deduplicates equivalent reruns', () => {
  const old = { id: 'existing', title: 'Keep me', layout: { x: 6, y: 25, h: 10, w: 6 } };
  const first = appendDashboardResults([old], [{ artifact: verifiedChart, title: 'Regional sales' }]);
  const second = appendDashboardResults(first.items, [{ artifact: { ...verifiedChart, artifact_id: 'another-response' } }]);
  expect(second.items).toHaveLength(2);
  expect(second.items[0]).toBe(old);
  expect(second.items[1].layout.y).toBe(35);
  expect(second.items[1].title).toBe('Regional sales');
  expect(second.skipped).toBe(1);
});

test('different dataset fingerprints or filters are distinct results', () => {
  const other = { ...verifiedChart, dataset_context: { fingerprint: 'sales-v2' } };
  const result = appendDashboardResults([], [{ artifact: verifiedChart }, { artifact: other }]);
  expect(result.added).toHaveLength(2);
});

test('snapshot retains analytical evidence and excludes live React data scope', () => {
  const artifact = { ...verifiedChart, scope: { fullData: [{ secretRow: 1 }] }, analysis_lineage: { source_ids: ['orders', 'customers'] } };
  const result = appendDashboardResults([], [{ artifact }]);
  const saved = result.items[0].resultSnapshot.artifact;
  expect(saved).not.toHaveProperty('scope');
  expect(saved.analysis_lineage.source_ids).toEqual(['orders', 'customers']);
  expect(saved.content.chartData).toEqual(verifiedChart.content.chartData);
  expect(saved.content.chartData).not.toBe(verifiedChart.content.chartData);
});

test('clarifications and grouped answers cannot become misleading KPI totals', () => {
  expect(canSaveResult({ ...verifiedChart, type: 'answer', content: { reason_code: 'analytics_clarification_required' } })).toBe(false);
  expect(canSaveResult({ ...verifiedChart, type: 'answer', content: { summary: { value: 505 } } })).toBe(false);
});
