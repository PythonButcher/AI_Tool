import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardCanvasItem from './DashboardCanvasItem';
import { WindowContext } from '../../context/WindowContext';

jest.mock('../charts/SmartChartWindow', () => () => <div>Live chart</div>);
jest.mock('./KpiCardWindow', () => () => <div>Live KPI</div>);
jest.mock('../ai/AICharts', () => ({ aiChartData }) => <div>Saved values: {aiChartData.datasets[0].data.join(', ')}</div>);

const renderItem = (item, filters = {}) => <WindowContext.Provider value={{ dashboardState: { mode: 'view' } }}>
  <DashboardCanvasItem item={item} cleanedData={[{ Revenue: 99999 }]} dashboardFilters={filters} />
</WindowContext.Provider>;

test('saved result renders exact values when active data or dashboard filters differ', () => {
  const item = { title: 'Original revenue', itemType: 'chart', sourceMetadata: { datasetName: 'Original source' },
    resultSnapshot: { schemaVersion: 'ai_chat_result_snapshot_v1', savedAt: '2026-10-10T12:00:00Z', artifact: {
      type: 'chart', content: { chartType: 'Bar', chartData: { labels: ['East'], datasets: [{ data: [100] }] } },
      bi_grounding: { aggregation: 'sum', row_count: 2, filters: [{ field: 'Region', operator: 'eq', value: 'East' }] },
    } } };
  const view = render(renderItem(item));
  view.rerender(renderItem(item, { region: 'West' }));
  expect(screen.getByText('Saved values: 100')).toBeInTheDocument();
  expect(screen.queryByText('Live chart')).not.toBeInTheDocument();
  expect(screen.getByText(/Dashboard slicers do not apply/)).toBeInTheDocument();
});

test('existing dashboard charts keep their live renderer', () => {
  render(renderItem({ itemType: 'chart', title: 'Existing chart' }));
  expect(screen.getByText('Live chart')).toBeInTheDocument();
});
