import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import WorkingDataHome, { buildDeterministicSummary } from './WorkingDataHome';

function createActions(overrides = {}) {
  return {
    save: jest.fn(),
    upload: jest.fn(),
    openSources: jest.fn(),
    openHub: jest.fn(),
    openRefine: jest.fn(),
    inspectRows: jest.fn(),
    filterRows: jest.fn(),
    openTools: jest.fn(),
    openFields: jest.fn(),
    openModel: jest.fn(),
    ...overrides,
  };
}

describe('WorkingDataHome', () => {
  test('guides users on how to begin when Workspace is empty and routes start actions', () => {
    const actions = createActions();
    render(<WorkingDataHome dataset={null} actions={actions} />);

    const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
    expect(workspace.getByRole('heading', { name: 'Workspace', level: 1 })).toBeVisible();
    expect(workspace.getByRole('heading', { name: 'How to begin', level: 2 })).toBeVisible();
    expect(workspace.getByText('Attach a dataset')).toBeVisible();
    expect(workspace.getByText('Review deterministic summary & refine')).toBeVisible();
    expect(workspace.getAllByText('Save Dataset').length).toBeGreaterThan(0);

    fireEvent.click(workspace.getByRole('button', { name: 'Upload data' }));
    expect(actions.upload).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Open from Data Hub' }));
    expect(actions.openHub).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Connect a source' }));
    expect(actions.openSources).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Browse data tools' }));
    expect(actions.openTools).toHaveBeenCalledTimes(1);
  });

  test('renders dataset identity, actions, and deterministic summarization without showing individual rows', () => {
    const actions = createActions();
    const rows = [
      { OrderId: 1001, Customer: 'Secret-Customer-Alpha', OrderDate: '2026-11-01', Revenue: 100, Paid: true },
      { OrderId: 1002, Customer: null, OrderDate: '2026-11-05', Revenue: 200, Paid: false },
      { OrderId: 1003, Customer: 'Secret-Customer-Beta', OrderDate: '2026-11-10', Revenue: 300, Paid: true },
      { OrderId: 1003, Customer: 'Secret-Customer-Beta', OrderDate: '2026-11-10', Revenue: 300, Paid: true },
    ];
    const schema = [
      { name: 'OrderId', data_type: 'int64' },
      { name: 'Customer', data_type: 'string' },
      { name: 'OrderDate', data_type: 'date' },
      { name: 'Revenue', data_type: 'float64' },
      { name: 'Paid', data_type: 'bool' },
    ];

    // Deterministic repeatability check
    expect(buildDeterministicSummary(rows, schema)).toEqual(buildDeterministicSummary(rows, schema));

    render(
      <WorkingDataHome
        dataset={{
          name: 'quarterly_orders.csv',
          savedName: 'Quarterly Orders',
          rowCount: 4,
          fieldCount: 5,
          canSave: true,
          canModel: true,
        }}
        rows={rows}
        schema={schema}
        canRefine
        actions={actions}
      />
    );

    const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
    expect(workspace.getByRole('heading', { name: 'quarterly_orders.csv', level: 1 })).toBeVisible();
    expect(workspace.getByText('Data Hub entry: Quarterly Orders')).toBeVisible();

    const stats = within(workspace.getByLabelText('Working dataset details'));
    expect(stats.getByText('4')).toBeVisible();
    expect(stats.getByText('5')).toBeVisible();
    expect(stats.getByText('95.0%')).toBeVisible();
    expect(stats.getByText('2')).toBeVisible();

    // Primary and source actions have clear, enabled placement
    fireEvent.click(workspace.getByRole('button', { name: 'Refine data' }));
    expect(actions.openRefine).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Save Dataset' }));
    expect(actions.save).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Upload data' }));
    expect(actions.upload).toHaveBeenCalledTimes(1);

    fireEvent.click(workspace.getByRole('button', { name: 'Open from Data Hub' }));
    expect(actions.openHub).toHaveBeenCalledTimes(1);

    // Deterministic summary table renders aggregate statistics per field
    expect(workspace.getByRole('heading', { name: 'Deterministic dataset summary', level: 2 })).toBeVisible();
    expect(workspace.getByText(/2 rows match across 1 exact duplicate group/)).toBeVisible();

    const summaryTable = within(workspace.getByRole('table', { name: 'Deterministic field summary' }));
    expect(summaryTable.getByText('Revenue')).toBeVisible();
    expect(summaryTable.getByText('Min 100 · Median 250 · Mean 225 · Max 300')).toBeVisible();
    expect(summaryTable.getByText('2026-11-01 to 2026-11-10 (9d span)')).toBeVisible();
    expect(summaryTable.getByText('True 3 (75.0%) · False 1 (25.0%)')).toBeVisible();

    // Individual row values must NEVER appear in Workspace
    expect(screen.queryByText('Secret-Customer-Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret-Customer-Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('1001')).not.toBeInTheDocument();
  });

  test('explains disabled Refine and Save Dataset states and summarizes filtered scope', () => {
    const actions = createActions();
    const rows = [
      { Region: 'North-Record', Sales: 120 },
      { Region: 'South-Record', Sales: 95 },
    ];

    render(
      <WorkingDataHome
        dataset={{
          name: 'API Sales Feed',
          rowCount: 2,
          fieldCount: 2,
          canSave: false,
          canModel: false,
        }}
        rows={rows}
        filteredRows={[rows[1]]}
        canRefine={false}
        refineUnavailableReason="Refine is available for a dataset with one source and no relationships."
        actions={actions}
      />
    );

    const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
    expect(workspace.getByRole('button', { name: 'Refine data' })).toBeDisabled();
    expect(workspace.getByText('Refine is available for a dataset with one source and no relationships.')).toBeVisible();

    expect(workspace.getByRole('button', { name: 'Save Dataset' })).toBeDisabled();
    expect(workspace.getByText(/Upload a file or open a Data Hub entry to save durable revisions/)).toBeVisible();

    expect(workspace.getByText('Filtered scope (1 row)')).toBeVisible();
    expect(within(workspace.getByRole('table', { name: 'Deterministic field summary' })).getByText('Min 95 · Median 95 · Mean 95 · Max 95')).toBeVisible();
    expect(screen.queryByText('South-Record')).not.toBeInTheDocument();
    expect(screen.queryByText('North-Record')).not.toBeInTheDocument();

    fireEvent.click(workspace.getByRole('button', { name: 'Review active filter in Data Tools' }));
    expect(actions.filterRows).toHaveBeenCalledTimes(1);
  });
});