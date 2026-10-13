import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UseShareStage from './UseShareStage';

const selection = { selection_id: 'selection-1', configuration_id: 'config-1', family: 'regularized_linear', intended_use: 'Local estimates', prohibited_use: 'Automated decisions', reviewed_by: 'Analyst', artifact: { sha256: 'sha256:model' } };
const config = { roles: { numeric: ['feature'], categorical: [] }, validation: { strategy: 'random', folds: 3 } };
const schema = { schema_id: 'schema-1', fields: [{ name: 'feature', logical_type: 'number', nullable: true, missing_policy: 'training_median' }] };
const receipt = { prediction_id: 'prediction-1', selection_id: 'selection-1', row_count: 1, preview: [{ input_row: 1, prediction: 3.2 }], warnings: ['Preview limited to 100 rows.'], created_at: '2026-10-05T10:00:00Z' };
const ok = data => Promise.resolve({ ok: true, json: async () => data });
let details, writes;
function mount() {
  return render(<UseShareStage draft={{ experiment_id: 'experiment-1', workspace_id: 'workspace-1', task_type: 'regression' }} selectionId="selection-1" showGuidance onBeforePredict={async () => ({ success: true })} />);
}
beforeEach(() => {
  writes = [];
  details = { current: true, selection, configuration: config, inference_schema: schema, predictions: [],
    exports: [{ kind: 'model', filename: 'model.joblib', description: 'Fitted prediction pipeline', artifact: null }],
    summary: { development_evidence: { primary_metric: 'rmse', candidates: [{ family: 'regularized_linear', metrics: { rmse: 2 } }] },
      final_evidence: { metrics: { rmse: 2.2 }, baseline: { rmse: 5 }, holdout_rows: 20 }, limitations: ['Small holdout.'],
      dataset_snapshot: { row_count: 100, snapshot_id: 'snapshot-1', transformation_recipe_hash: 'sha256:recipe' } },
  };
  global.fetch = jest.fn((url, options) => {
    if (!options?.method) return ok(details);
    writes.push({ url, ...options });
    if (url.includes('/exports?')) {
      details = { ...details, exports: details.exports.map(item => ({ ...item, artifact: { sha256: 'sha256:model', size_bytes: 1000 } })) };
      return ok({ exports: details.exports });
    }
    details = { ...details, predictions: [receipt] };
    return ok({ prediction: receipt });
  });
});

test('validates one-row input through the server and renders a durable receipt', async () => {
  mount();
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'feature' }), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  expect(await screen.findByText('1 predictions saved')).toBeInTheDocument();
  expect(screen.getByText('3.2')).toBeInTheDocument();
  expect(JSON.parse(writes[0].body)).toEqual({ input_schema_version: 'schema-1', rows: [{ feature: 1.5 }] });
  expect(writes[0].headers['Idempotency-Key']).toBeTruthy();
});

test('retries lost responses using one key and preserves field-level validation feedback', async () => {
  let attempt = 0;
  const implementation = fetch.getMockImplementation();
  fetch.mockImplementation((url, options) => {
    if (options?.method) {
      if (++attempt === 1) { writes.push(options); return Promise.reject(new Error('Response lost')); }
    }
    return implementation(url, options);
  });
  mount();
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'feature' }), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText('Response lost');
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  await screen.findByText('1 predictions saved');
  expect(writes[0].headers['Idempotency-Key']).toBe(writes[1].headers['Idempotency-Key']);
});

test('exports require a preparation action and summary preserves use restrictions', async () => {
  mount();
  await screen.findByRole('spinbutton', { name: 'feature' });
  expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('tab', { name: 'Exports' }));
  expect(screen.getByRole('button', { name: 'Download model.joblib' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare exports' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download model.joblib' })).toBeEnabled());
  fireEvent.click(screen.getByRole('tab', { name: 'Local summary' }));
  expect(screen.getByText('Automated decisions')).toBeInTheDocument();
  expect(screen.getByText('Small holdout.')).toBeInTheDocument();
});

test('stale selection keeps evidence visible and prevents prediction', async () => {
  details.current = false;
  mount();
  expect(await screen.findByRole('button', { name: 'Run prediction' })).toBeDisabled();
  expect(screen.getByText('Historical selection')).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

test('output tabs support keyboard selection and retain local problem and use boundaries', async () => {
  details.summary.problem_statement = 'Estimate next-quarter demand';
  details.selection = { ...details.selection, experiment_name: 'Demand study' };
  mount();
  const predict = await screen.findByRole('tab', { name: 'Predict' });
  predict.focus();
  fireEvent.keyDown(predict, { key: 'End' });
  expect(screen.getByRole('tab', { name: 'Local summary' })).toHaveFocus();
  expect(screen.getByRole('tab', { name: 'Local summary' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Estimate next-quarter demand')).toBeInTheDocument();
  expect(screen.getByText('Automated decisions')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Export this record' }));
  expect(screen.getByRole('tab', { name: 'Exports' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Prepare exports' })).toBeInTheDocument();
});

test('CSV validation errors display rule counts without dropping the selected file', async () => {
  fetch.mockImplementation((url, options) => options?.method ? Promise.resolve({ ok: false, json: async () => ({ error: { message: 'Input schema mismatch' }, validation_issues: ['feature: expected number (2 rows)'] }) }) : ok(details));
  mount();
  fireEvent.click(await screen.findByRole('radio', { name: 'CSV batch' }));
  fireEvent.change(screen.getByLabelText('Prediction CSV'), { target: { files: [{ name: 'batch.csv', size: 30, text: async () => 'feature\ninvalid\ninvalid' }] } });
  await screen.findByText('batch.csv ready to validate');
  fireEvent.click(screen.getByRole('button', { name: 'Run prediction' }));
  expect(await screen.findByText('feature: expected number (2 rows)')).toBeInTheDocument();
  expect(screen.getByText('batch.csv ready to validate')).toBeInTheDocument();
});
