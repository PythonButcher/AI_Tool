import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationStage from './ConfigurationStage';
import EvidencePlot from './EvidencePlot';
import PredictionTable from './PredictionTable';

test('detector configuration sends threshold controls and optional evaluation labels', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ snapshot: { column_profile: [{ name: 'label', logical_type: 'numeric', null_count: 0 }] } }) }));
  const onAssess = jest.fn(async () => ({ success: true }));
  render(<ConfigurationStage draft={{ experiment_id: 'anomaly', snapshot_id: 's', task_type: 'anomaly_detection', roles: { numeric: ['value'] } }} onEdit={jest.fn()} onAssess={onAssess} showGuidance />);
  expect(await screen.findByRole('option', { name: 'Evaluation label (0 / 1)' })).toBeEnabled();
  expect(screen.getByText(/evaluation labels optional/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Role for label' }), { target: { value: 'target' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Expected unusual fraction (%)' }), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Local outlier factor (new-row scoring)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save & assess' }));
  await waitFor(() => expect(onAssess).toHaveBeenCalled());
  expect(onAssess.mock.calls[0][0]).toMatchObject({ roles: { target: 'label' }, metric: { primary: 'score_stability' }, candidate: { contamination: .1, neighbors: 20, families: ['isolation_forest'] } });
});

test('unlabeled detector evidence shows score bins and explicitly unavailable accuracy', () => {
  render(<EvidencePlot title="Final holdout" evidence={{ kind: 'anomaly_scores', partition: 'Reserved rows', interpretation: 'Flags are review cues, not confirmed errors.', rows: 10, flagged_rows: 2, selected_threshold: .7, labeled_rows: 0, histogram: [{ low: .2, high: .5, count: 8 }, { low: .5, high: .9, count: 2 }], thresholds: [{ value: .7, training_rows: 40, training_flag_fraction: .05 }] }} />);
  expect(screen.getByRole('img', { name: 'Final holdout anomaly scores: 10 observations, 2 flagged' })).toBeInTheDocument();
  expect(screen.getByText('Detection accuracy unavailable')).toBeInTheDocument();
  expect(screen.getByText(/not confirmed errors/)).toBeInTheDocument();
});

test('detector predictions preserve both score and boolean review flag', () => {
  render(<PredictionTable receipt={{ output_columns: ['input_row', 'score', 'is_unusual'], preview: [{ input_row: 1, score: .8, is_unusual: true }, { input_row: 2, score: .3, is_unusual: false }] }} />);
  expect(screen.getByRole('columnheader', { name: 'is unusual' })).toBeInTheDocument();
  expect(screen.getByText('true')).toBeInTheDocument();
  expect(screen.getByText('false')).toBeInTheDocument();
});
