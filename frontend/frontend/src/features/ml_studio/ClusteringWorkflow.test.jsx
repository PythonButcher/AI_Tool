import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationStage from './ConfigurationStage';
import EvidencePlot from './EvidencePlot';
import PredictionTable from './PredictionTable';

test('clustering config preserves cluster count when selecting models and disallows a target', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ snapshot: { column_profile: [{ name: 'value', logical_type: 'numeric', null_count: 0 }] } }) }));
  const onAssess = jest.fn(async () => ({ success: true }));
  render(<ConfigurationStage draft={{ experiment_id: 'cluster', snapshot_id: 's', task_type: 'clustering', roles: { numeric: ['value'] } }} onEdit={jest.fn()} onAssess={onAssess} showGuidance />);
  expect(await screen.findByRole('option', { name: 'Target' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Selection metric' })).toHaveValue('silhouette');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Number of clusters' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mini-batch K-means' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save & assess' }));
  await waitFor(() => expect(onAssess).toHaveBeenCalled());
  expect(onAssess.mock.calls[0][0].candidate).toEqual({ cluster_count: 4, families: ['kmeans'] });
  expect(onAssess.mock.calls[0][0].roles.target).toBeNull();
});

test('cluster evidence separates profile counts and geometry assumptions from accuracy', () => {
  render(<EvidencePlot title="Development" evidence={{ kind: 'clusters', partition: 'Development fit', profiles: [{ cluster: 0, rows: 12, numeric_means: { value: 3.2 }, categorical_modes: { kind: 'a' } }], total_rows: 12, distance: 'Euclidean after standardization', stability_method: 'Agreement under resampling', valid_metric_folds: { silhouette: 2 } }} />);
  expect(screen.getByLabelText('Cluster 0 row count')).toHaveAttribute('value', '12');
  expect(screen.getByRole('columnheader', { name: 'value · mean' })).toBeInTheDocument();
  expect(screen.getByText(/arbitrary/)).toBeInTheDocument();
  expect(screen.getByText(/Valid folds: silhouette 2/)).toBeInTheDocument();
});

test('new-row cluster assignments have a cluster output column', () => {
  render(<PredictionTable receipt={{ output_columns: ['input_row', 'cluster'], preview: [{ input_row: 1, cluster: 0 }] }} />);
  expect(screen.getByRole('columnheader', { name: 'cluster' })).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'prediction' })).not.toBeInTheDocument();
});
