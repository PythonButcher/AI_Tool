import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DataToolsWorkbench from './DataToolsWorkbench';

jest.mock('axios', () => ({ post: jest.fn() }));

const rows = [
  ...Array.from({ length: 25 }, (_, i) => ({ Id: i + 1, Region: 'North' })),
  { Id: 26, Region: 'South' },
  { Id: 26, Region: 'South' },
  { Id: 28, Region: null },
];

function Workbench({ sourceContext, dataRows = rows }) {
  const [tool, setTool] = useState('rows');
  const [filteredRows, setFilteredRows] = useState(null);
  return <DataToolsWorkbench dataset={{ name: 'Orders' }} rows={dataRows} metrics={[]}
    tool={tool} setTool={setTool} filteredRows={filteredRows} setFilteredRows={setFilteredRows}
    sourceContext={sourceContext} actions={{}} />;
}

test('pages the original rows and checks duplicates and completeness outside the first page', () => {
  render(<Workbench />);
  expect(screen.getByText('1–25 of 28 rows')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(within(screen.getByRole('table', { name: 'Working rows' })).getAllByText('South')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Column profile' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Column' }), { target: { value: 'Region' } });
  const stats = screen.getByText('Completeness').closest('dl');
  expect(stats).toHaveTextContent('Filled27Empty1Distinct values2Completeness96.4%');

  fireEvent.click(screen.getByRole('button', { name: 'Duplicate rows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Find duplicates' }));
  expect(screen.getByText('2 matching rows across 1 group.')).toBeVisible();
  const table = within(screen.getByRole('table', { name: 'Duplicate results' }));
  expect(table.getByRole('rowheader', { name: '26' })).toBeVisible();
  expect(table.getByRole('rowheader', { name: '27' })).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Compare by' }), { target: { value: 'Region' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find duplicates' }));
  expect(screen.getByText('27 matching rows across 2 groups.')).toBeVisible();
});

test('runs outliers using the exact source context and reports the result in the page', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 2 }) });
  const context = { workspace_id: 'orders', workspace_version: 2, primary_source_id: 'file', source_ids: ['file'], relationship_ids: [] };
  try {
    render(<Workbench sourceContext={context} />);
    fireEvent.click(screen.getByRole('button', { name: 'Outliers' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Expected outliers (%)' }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run outlier detection' }));
    expect(await screen.findByRole('status')).toHaveTextContent('2 potential outliers found.');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/outliers$/), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ analysis_context: context, contamination: 0.05 }),
    }));
  } finally {
    global.fetch = originalFetch;
  }
});

test('combines preview rules and leaves quality checks on the complete working rows', () => {
  render(<Workbench />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter rows' }));
  const first = within(screen.getByRole('group', { name: 'Rule 1' }));
  fireEvent.change(first.getByRole('combobox', { name: 'Condition' }), { target: { value: 'gt' } });
  fireEvent.change(first.getByRole('textbox', { name: 'Value' }), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
  const second = within(screen.getByRole('group', { name: 'Rule 2' }));
  fireEvent.change(second.getByRole('combobox', { name: 'Field' }), { target: { value: 'Region' } });
  fireEvent.change(second.getByRole('textbox', { name: 'Value' }), { target: { value: 'south' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply preview filter' }));
  const matching = within(screen.getByRole('table', { name: 'Matching rows' }));
  expect(matching.getAllByRole('row')).toHaveLength(3);
  expect(matching.queryByText('28')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect rows' }));
  expect(screen.getByText('1–2 of 2 rows')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Filter rows' }));
  expect(screen.getByRole('group', { name: 'Rule 2' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
  expect(screen.getByText('1–25 of 28 rows')).toBeVisible();
});

test('validates values beyond the first page and independently of a preview filter', () => {
  const orders = [
    ...Array.from({ length: 25 }, () => ({ Region: 'North', Amount: 10 })),
    { Region: 'South', Amount: 20 }, { Region: 'south', Amount: '15' }, { Region: null, Amount: 30 },
  ];
  render(<Workbench dataRows={orders} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filter rows' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), { target: { value: 'North' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply preview filter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Validate values' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Field to validate' }), { target: { value: 'Amount' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Requirement' }), { target: { value: 'range' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum' }), { target: { value: '20' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum' }), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run validation' }));
  expect(screen.getByRole('alert')).toHaveTextContent('The minimum must be at or below the maximum.');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum' }), { target: { value: '10' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum' }), { target: { value: '20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run validation' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 of 28 rows failed.');
  const failureRows = () => within(screen.getByRole('table', { name: 'Rows that failed validation' })).getAllByRole('rowheader').map(cell => cell.textContent);
  expect(failureRows()).toEqual(['27', '28']);

  fireEvent.change(screen.getByRole('combobox', { name: 'Field to validate' }), { target: { value: 'Region' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Requirement' }), { target: { value: 'allowed' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Allowed values, one per line' }), { target: { value: 'North\nSouth' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run validation' }));
  expect(failureRows()).toEqual(['27', '28']);
});

test('checks a composite key and separates repeated keys from incomplete rows', () => {
  const orders = [
    ...Array.from({ length: 25 }, (_, i) => ({ Id: i + 1, Region: 'North' })),
    { Id: 1, Region: 'South' }, { Id: 2, Region: 'North' }, { Id: 3, Region: ' ' }, { Id: null, Region: 'North' },
  ];
  render(<Workbench dataRows={orders} />);
  fireEvent.click(screen.getByRole('button', { name: 'Check keys' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Region' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run key check' }));
  expect(screen.getByRole('status')).toHaveTextContent('2 rows with missing key values · 2 rows with repeated keys.');
  const issueRows = () => within(screen.getByRole('table', { name: 'Key issues' })).getAllByRole('rowheader').map(cell => cell.textContent);
  expect(issueRows()).toEqual(['2', '27', '28', '29']);
  fireEvent.change(screen.getByRole('combobox', { name: 'Show issue' }), { target: { value: 'missing' } });
  expect(issueRows()).toEqual(['28', '29']);
  fireEvent.change(screen.getByRole('combobox', { name: 'Show issue' }), { target: { value: 'repeated' } });
  expect(issueRows()).toEqual(['2', '27']);
});

test('summarizes by two fields while counting null and nonnumeric measures as rows', () => {
  const orders = [
    ...Array.from({ length: 25 }, () => ({ Region: 'North', Status: 'Open', Amount: 5 })),
    { Region: 'North', Status: 'Open', Amount: 31 }, { Region: 'North', Status: 'Closed', Amount: '15' },
    { Region: 'South', Status: 'Open', Amount: null }, { Region: 'South', Status: 'Open', Amount: -5 },
  ];
  render(<Workbench dataRows={orders} />);
  fireEvent.click(screen.getByRole('button', { name: 'Summarize rows' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Then by' }), { target: { value: 'Status' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Measure' }), { target: { value: 'Amount' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run summary' }));
  expect(screen.getByRole('status')).toHaveTextContent('3 groups across 29 loaded rows.');
  const result = within(screen.getByRole('table', { name: 'Grouped results' }));
  const values = result.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell').map(cell => cell.textContent));
  expect(values).toEqual([
    ['North', 'Open', '26', '26', '156', '6'],
    ['South', 'Open', '2', '1', '-5', '-5'],
    ['North', 'Closed', '1', '0', '—', '—'],
  ]);
});

test('requires loaded rows before enabling the new checks', () => {
  render(<Workbench dataRows={[]} />);
  for (const name of ['Summarize rows', 'Validate values', 'Check keys']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
});
