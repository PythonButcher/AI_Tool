import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  const renderWithContext = (ui) => {
    return render(
      <DataContext.Provider value={mockContext}>
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

    expect(screen.getByText(/Visual Data Transformation Interface/i)).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply All/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(mockContext.setCleanedData).toHaveBeenCalledWith([{ A: 10, B: 20 }]);
      expect(mockContext.setSemanticModel).toHaveBeenCalled();
      expect(mockOnApplyComplete).toHaveBeenCalled();
    });
  });
});
