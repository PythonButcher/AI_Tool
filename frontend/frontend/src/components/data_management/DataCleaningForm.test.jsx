import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataCleaningForm from './DataCleaningForm';
import { DataContext } from '../../context/DataContext';
import axios from 'axios';
import { HelpOverlayProvider } from '../../context/HelpOverlayContext';

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
  create: jest.fn(),
  default: { post: jest.fn(), get: jest.fn(), create: jest.fn() }
}));

describe('DataCleaningForm ML Studio integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockContext = {
    uploadedData: [{ A: 1, B: 2 }],
    fullData: [{ A: 1, B: 2 }],
    cleanedData: null,
    setCleanedData: jest.fn(),
    setSemanticModel: jest.fn(),
    refreshSemanticModelFromDataset: jest.fn(),
  };

  const renderWithContext = (ui, value = mockContext) => {
    return render(
      <DataContext.Provider value={value}>
        <HelpOverlayProvider>
          {ui}
        </HelpOverlayProvider>
      </DataContext.Provider>
    );
  };

  it('ML Studio opening mode cannot clean global data', () => {
    const mockClose = jest.fn();
    const mlContext = {
      title: 'My Draft',
      experiment_id: 'exp-123',
      workspace_id: 'ws-456',
      snapshot_id: 'snap-789',
      field: 'ColA',
      action: 'fill_missing',
      explanation: 'Use mean to fill missing values'
    };

    renderWithContext(
      <DataCleaningForm
        mlStudioMode={true}
        mlStudioOpeningContext={mlContext}
        closeForm={mockClose}
        initialSteps={[{ type: 'fill_missing', params: { strategy: 'mean' }, id: 'step-1' }]}
      />
    );

    // Assert context labels
    expect(screen.getByText(/Experiment: My Draft \(exp-123\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Workspace: ws-456/i)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: snap-789/i)).toBeInTheDocument();
    expect(screen.getByText(/ColA/i)).toBeInTheDocument();
    expect(screen.getByText(/fill_missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Use mean to fill missing values/i)).toBeInTheDocument();

    // Absent editing controls
    expect(screen.queryByRole('button', { name: /Run Preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply All/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Add Step')).not.toBeInTheDocument();
    
    // No global-row preview (DataCleaningPreview is isolated or not rendered)
    expect(screen.queryByTestId('data-cleaning-preview')).not.toBeInTheDocument();
    expect(screen.getByText(/Previewing and applying changes will arrive separately/i)).toBeInTheDocument();

    // No axios cleaning request
    expect(axios.post).not.toHaveBeenCalled();

    // Safe Return/close
    const returnBtn = screen.getByRole('button', { name: /Return to Prepare Data/i });
    fireEvent.click(returnBtn);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('legacy Power Query still previews and applies', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        preview: [{ A: 10, B: 20 }],
        cleaned_data: [{ A: 10, B: 20 }],
        semantic_model: { fields: [] }
      }
    });

    const mockClose = jest.fn();
    const mockOnApplyComplete = jest.fn();
    
    renderWithContext(
      <DataCleaningForm
        mlStudioMode={false}
        closeForm={mockClose}
        onApplyComplete={mockOnApplyComplete}
        initialSteps={[{ type: 'fill_missing', params: { strategy: 'mean' }, id: 'step-1' }]}
      />
    );

    expect(screen.getByRole('table', { name: 'Current data' })).toBeVisible();

    const applyBtn = screen.getByRole('button', { name: /Apply All/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(mockContext.setCleanedData).toHaveBeenCalledWith([{ A: 10, B: 20 }]);
      expect(mockContext.setSemanticModel).toHaveBeenCalled();
      expect(mockOnApplyComplete).toHaveBeenCalled();
    });
  });

  it('opens the current named dataset and shows its first 100 rows before any request', () => {
    const rows = Array.from({ length: 125 }, (_, index) => ({ customer: `customer-${index + 1}`, paid: false }));
    rows[0].details = { region: 'East' };
    renderWithContext(
      <DataCleaningForm closeForm={jest.fn()} workingDatasetName="Quarterly orders"
        workingWorkspace={{ workspace_id: 'ws-orders', version: 2, primary_source_id: 'src-orders' }} onWorkingRefine={jest.fn()} />,
      { ...mockContext, cleanedData: rows, uploadedData: { source: { name: 'prepared.table.json' } } },
    );
    expect(screen.getByRole('dialog', { name: 'Power Query Editor' })).toHaveTextContent('Quarterly orders');
    expect(screen.getByText('100 of 125 rows · 3 fields')).toBeVisible();
    const table = within(screen.getByRole('table', { name: 'Current data' }));
    expect(table.getByRole('columnheader', { name: 'customer' })).toBeVisible();
    expect(table.getByRole('cell', { name: 'customer-100' })).toBeVisible();
    expect(table.getByRole('cell', { name: '{"region":"East"}' })).toBeVisible();
    expect(table.queryByRole('cell', { name: 'customer-101' })).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('uses the active source for preview and apply and keeps renamed fields available for later steps', async () => {
    const workingWorkspace = { workspace_id: 'ws-orders', version: 4, primary_source_id: 'src-orders' };
    const params = { mappings: [{ from: 'A', to: 'Name' }] };
    const initialSteps = [{ type: 'rename_columns', label: 'Rename Columns', params, id: 'rename' }];
    const result = { full_data: [{ Name: 1 }], workspace: { workspace_id: 'ws-result' }, analysis_context: {} };
    axios.post.mockResolvedValueOnce({ data: { preview: [{ Name: 1 }], row_count: 1, schema: [{ name: 'Name' }], source_fingerprint: 'sha256:orders' } });
    axios.post.mockResolvedValueOnce({ data: result });
    const onWorkingRefine = jest.fn();
    renderWithContext(<DataCleaningForm closeForm={jest.fn()} workingWorkspace={workingWorkspace}
      onWorkingRefine={onWorkingRefine} initialSteps={initialSteps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
    const table = within(await screen.findByRole('table', { name: 'Preview of applied steps' }));
    expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    expect(table.queryByRole('columnheader', { name: 'A' })).not.toBeInTheDocument();
    const fields = { workspace_id: 'ws-orders', workspace_version: 4, source_id: 'src-orders',
      steps: [{ type: 'rename_columns', params: { mappings: { A: 'Name' } } }] };
    expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/refine-preview$/), fields, { signal: expect.anything() });

    fireEvent.click(screen.getByRole('button', { name: 'Apply All' }));
    await waitFor(() => expect(onWorkingRefine).toHaveBeenCalledWith(result));
    expect(axios.post).toHaveBeenLastCalledWith(expect.stringMatching(/refine-working$/),
      { ...fields, source_fingerprint: 'sha256:orders', request_id: expect.any(String) }, { signal: expect.anything() });
  });
});
