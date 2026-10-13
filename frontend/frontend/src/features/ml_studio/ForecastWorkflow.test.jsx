import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationStage from './ConfigurationStage';
import EvidencePlot from './EvidencePlot';
import TrainingStage from './TrainingStage';
import PredictionTable from './PredictionTable';

test('forecast configuration uses rolling origins and explicit future-feature availability', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ snapshot: { column_profile: [{ name: 'promotion', logical_type: 'numeric', null_count: 0 }] } }) }));
  const onEdit = jest.fn(), onAssess = jest.fn(async () => ({ success: true }));
  render(<ConfigurationStage draft={{ experiment_id: 'forecast', snapshot_id: 'snapshot-1', task_type: 'forecasting', roles: { target: 'value', time: ['date'], group: ['series'], numeric: ['promotion'], categorical: [], ignored: [] } }} showGuidance onEdit={onEdit} onAssess={onAssess} />);
  expect(screen.getByRole('combobox', { name: 'Validation strategy' })).toHaveValue('rolling_origin');
  expect(screen.queryByRole('option', { name: 'Random folds' })).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Forecast horizon' })).toHaveValue(7);
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Forecast horizon' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Every selected feature is known/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save & assess' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Save & assess' }));
  await waitFor(() => expect(onAssess).toHaveBeenCalled());
  expect(onAssess.mock.calls[0][0].validation).toMatchObject({ horizon: 3, frequency: 'D', future_features_known: true, strategy: 'rolling_origin' });
  expect(onAssess.mock.calls[0][0].validation).not.toHaveProperty('holdout_fraction');
  expect(onAssess.mock.calls[0][0].candidate.families).toEqual(['lagged_ridge', 'lagged_forest']);
});

test('forecast evidence shows actual, forecast and baseline for the chosen series', () => {
  render(<EvidencePlot title="Development" evidence={{ kind: 'forecast', points: ['A', 'B'].flatMap(series => [1, 2].map(horizon => ({ series, horizon, time: `2026-01-0${horizon}T00:00:00Z`, actual: horizon + 1, predicted: horizon + .8, baseline: 1 }))) }} />);
  expect(screen.getByRole('img', { name: 'Development forecast for A, 2 displayed observations' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Evidence series' }), { target: { value: 'B' } });
  expect(screen.getByRole('img', { name: 'Development forecast for B, 2 displayed observations' })).toBeInTheDocument();
  expect(screen.getByText('Naive baseline')).toBeInTheDocument();
});

test('training declares a time horizon and forecast results retain temporal columns', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ runs: [] }) }));
  const view = render(<TrainingStage draft={{ experiment_id: 'forecast', workspace_id: 'ws', task_type: 'forecasting', assessment_current: true, assessment: { configuration: { configuration_id: 'config', validation: { strategy: 'rolling_origin', horizon: 3, folds: 2 }, candidate: { families: ['lagged_ridge'] }, metric: { primary: 'rmse' }, resource: { timeout_seconds: 120 } } } }} onBeforeSubmit={jest.fn()} />);
  expect(screen.getByText('3 periods per series')).toBeInTheDocument();
  await screen.findByRole('heading', { name: 'Your first run starts here' });
  view.unmount();
  render(<PredictionTable receipt={{ output_columns: ['input_row', 'prediction', 'time', 'series', 'horizon'], preview: [{ input_row: 1, prediction: 5, time: '2026-01-01', series: 'A', horizon: 1 }] }} />);
  expect(screen.getByRole('columnheader', { name: 'horizon' })).toBeInTheDocument();
  expect(screen.getByText('2026-01-01')).toBeInTheDocument();
});
