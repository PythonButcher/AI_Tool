import { remapAnalysis, selectionFilter } from './analyticsTransforms';
import { defaultAnalysis, executionQuery, querySignature, tableCsv } from './analyticsModel';

test('date bucket selections cover the complete bucket, including leap years', () => {
  const filter = selectionFilter([{ field: 'date', grain: 'month' }], { date: '2024-02' });
  expect(filter.rules.map(rule => rule.value)).toEqual(['2024-02-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z']);
  expect(filter.rules.map(rule => rule.operator)).toEqual(['gte', 'lt']);
  expect(selectionFilter([{ field: 'region' }], { region: null })).toEqual({ field: 'region', operator: 'is_null' });
});
test('field remapping traverses filters and comparisons without changing measure IDs', () => {
  const config = defaultAnalysis({ kind: 'datahub', id: 'orders' });
  config.query.measures = [{ id: 'sales', field: 'sales', aggregation: 'sum' }];
  config.query.group_by = [{ field: 'region' }];
  config.query.filters = { op: 'or', rules: [{ field: 'region', operator: 'eq', value: 'East' }] };
  config.query.comparison = { kind: 'segment', filters: [{ field: 'sales', operator: 'gt', value: 0 }] };
  config.query.sort = { field: 'sales', direction: 'desc' };
  const mapped = remapAnalysis(config, { sales: 'Revenue', region: 'Area' });
  expect(mapped.query.measures[0]).toMatchObject({ id: 'sales', field: 'Revenue' });
  expect(mapped.query.group_by[0].field).toBe('Area');
  expect(mapped.query.filters.rules[0].field).toBe('Area');
  expect(mapped.query.comparison.filters[0].field).toBe('Revenue');
  expect(mapped.query.sort.field).toBe('sales');
  expect(config.query.group_by[0].field).toBe('region');
});
test('result identity changes for execution modes but not chart-only formatting', () => {
  const config = defaultAnalysis({ kind: 'datahub', id: 'one' });
  expect(querySignature({ ...config, view: 'line' })).toBe(querySignature(config));
  for (const view of ['scatter', 'histogram', 'pivot', 'percent_stacked']) expect(querySignature({ ...config, view })).not.toBe(querySignature(config));
  expect(executionQuery({ ...config, view: 'pivot' }).mode).toBe('pivot');
});
test('CSV retains numbers while escaping formula text, commas, quotes and newlines', () => {
  const csv = tableCsv({ columns: ['name', 'value'], rows: [{ name: '=HYPERLINK("bad")', value: -2 }, { name: 'a,\nb', value: null }] });
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  expect(csv).toContain('"-2"');
  expect(csv).toContain('"a,\nb",""');
});
