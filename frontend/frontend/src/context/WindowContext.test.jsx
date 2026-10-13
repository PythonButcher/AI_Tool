import React from 'react';
import { render, act } from '@testing-library/react';
import { WindowProvider, useWindowContext } from './WindowContext';

const artifact = {
  type: 'chart', title: 'Sales', content: { chartType: 'Bar', chartData: { labels: ['East'], datasets: [{ data: [42] }] } },
  bi_grounding: { metric_definition: { id: 'sales' }, dataset: { dataset_name: 'Orders' }, filters: [{ field: 'Region', value: 'East' }] },
};
let context;
function Probe() { context = useWindowContext(); return null; }
const mount = () => render(<WindowProvider><Probe /></WindowProvider>);
beforeEach(() => localStorage.clear());
afterEach(() => jest.restoreAllMocks());

test('recovers malformed v1 from legacy without changing the legacy key', () => {
  const legacy = JSON.stringify({ state: { name: 'My board' }, items: [{ id: 'old', itemType: 'chart', title: 'Keep' }] });
  localStorage.setItem('businessMonitoringDashboard', legacy);
  localStorage.setItem('chartStudioDashboard:v1', '{broken');
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mount();
  expect(context.dashboardItems[0].id).toBe('old');
  expect(localStorage.getItem('businessMonitoringDashboard')).toBe(legacy);
});

test('double addition is idempotent and snapshot survives provider reload', () => {
  const view = mount();
  act(() => {
    expect(context.addDashboardResults([{ artifact }]).added).toHaveLength(1);
    expect(context.addDashboardResults([{ artifact }]).skipped).toBe(1);
  });
  expect(context.dashboardItems).toHaveLength(1);
  view.unmount();
  mount();
  expect(context.dashboardItems[0].resultSnapshot.artifact.bi_grounding.filters).toEqual(artifact.bi_grounding.filters);
  expect(context.dashboardItems[0].sourceMetadata.resultKey).toBeTruthy();
});

test('storage failure preserves dashboard and permits a deliberate retry', () => {
  mount();
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  act(() => expect(() => context.addDashboardResults([{ artifact }])).toThrow(/draft is still here/));
  expect(context.dashboardItems).toHaveLength(0);
  expect(context.dashboardStorageError).toBeTruthy();
  set.mockRestore();
  act(() => context.addDashboardResults([{ artifact }]));
  expect(context.dashboardItems).toHaveLength(1);
  expect(context.dashboardStorageError).toBeNull();
});
