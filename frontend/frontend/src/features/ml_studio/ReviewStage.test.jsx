import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReviewStage from './ReviewStage';

const draft = { experiment_id: 'experiment-1', workspace_id: 'workspace-1', etag: 'etag-1', task_type: 'regression' };
const run = { run_id: 'run-1', status: 'completed', submitted_at: '2026-10-05T10:00:00Z', specification_version: 1,
  run_specification: { parameters: { input_fingerprint: 'current' } }, evaluation_result: {
    candidates: [{ family: 'regularized_linear', metrics: { rmse: 2 }, fold_std: { rmse: .2 }, evidence: { kind: 'residuals', sample_limit: 100, points: [{ predicted: 5, actual: 4, residual: -1 }] } }],
    primary_metric: 'rmse', metric_direction: 'minimize', baseline: { name: 'Mean prediction', metrics: { rmse: 5 } }, warnings: [], limitations: ['Development evidence only.'],
    configuration_id: 'config-1', dataset_snapshot: { snapshot_id: 'snapshot-1' }, runtime_versions: { sklearn: 'test' },
  } };
const nomination = { nomination_id: 'nomination-1', development_run_id: 'run-1', snapshot_id: 'snapshot-1', family: 'regularized_linear', nominator: 'Local reviewer', intended_use: 'Local estimates', nominated_at: run.submitted_at, final_run: null };
const final = { status: 'completed', evaluation_result: { metrics: { rmse: 2.2 }, baseline: { rmse: 5.2 }, evidence: run.evaluation_result.candidates[0].evidence, holdout_rows: 20, limitations: ['Small holdout.'] } };
const ok = data => Promise.resolve({ ok: true, json: async () => data });
let state, posts;
function mount(props = {}) {
  return render(<ReviewStage draft={draft} showGuidance onBeforeDecision={async () => ({ success: true, draft: { ...draft, etag: 'flushed' } })} onWorkflowChanged={jest.fn()} onContinue={jest.fn()} {...props} />);
}
beforeEach(() => {
  posts = [];
  state = { runs: [run], nominations: [], selections: [], input_fingerprint: 'current', workflow_state: { stages: [] } };
  global.fetch = jest.fn((url, options) => {
    if (!options?.method) return ok(state);
    posts.push({ url, ...options });
    if (url.includes('/final-evaluation')) { state = { ...state, nominations: [{ ...nomination, final_run: final }] }; return ok({ run: final }); }
    if (url.includes('/nominations')) { state = { ...state, nominations: [nomination] }; return ok({ nomination }); }
    state = { ...state, selections: [{ nomination_id: 'nomination-1', intended_use: 'Local estimates', reviewed_by: 'Local reviewer', selected_at: run.submitted_at }] };
    return ok({ selection: state.selections[0], workflow_state: state.workflow_state });
  });
});

test('requires deliberate nomination, final evaluation and selection with notes', async () => {
  mount();
  const nominate = await screen.findByRole('button', { name: 'Nominate candidate' });
  expect(nominate).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Inspect regularized linear' }));
  expect(screen.getByRole('img', { name: /Development: predicted values/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Intended use' }), { target: { value: 'Local estimates' } });
  fireEvent.click(nominate);
  const evaluate = await screen.findByRole('button', { name: 'Evaluate nominated candidate' });
  expect(posts).toHaveLength(1);
  expect(posts[0].headers['If-Match']).toBe('flushed');
  expect(JSON.parse(posts[0].body)).toEqual({ run_id: 'run-1', family: 'regularized_linear', nominator: 'Local reviewer', intended_use: 'Local estimates' });
  fireEvent.click(evaluate);
  const select = await screen.findByRole('button', { name: 'Select this candidate' });
  expect(select).toBeDisabled();
  expect(screen.getByText('Small holdout.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Prohibited use' }), { target: { value: 'Automated decisions' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed the final evidence/ }));
  fireEvent.click(select);
  expect(await screen.findByRole('heading', { name: 'Candidate selected' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use & share' })).toBeEnabled();
  expect(posts).toHaveLength(3);
});

test('historical evidence can be inspected but cannot be nominated', async () => {
  state = { ...state, input_fingerprint: 'changed' };
  mount();
  fireEvent.click(await screen.findByRole('radio', { name: 'Inspect regularized linear' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Intended use' }), { target: { value: 'Local estimates' } });
  expect(screen.getByRole('button', { name: 'Nominate candidate' })).toBeDisabled();
  expect(screen.getByText(/Historical evidence:/)).toBeInTheDocument();
  expect(posts).toHaveLength(0);
});

test('reload recovers a saved nomination after a lost response', async () => {
  const implementation = fetch.getMockImplementation();
  fetch.mockImplementation((url, options) => {
    if (options?.method === 'POST') { state = { ...state, nominations: [nomination] }; return Promise.reject(new Error('Response lost')); }
    return implementation(url, options);
  });
  mount();
  fireEvent.click(await screen.findByRole('radio', { name: 'Inspect regularized linear' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Intended use' }), { target: { value: 'Local estimates' } });
  fireEvent.click(screen.getByRole('button', { name: 'Nominate candidate' }));
  await screen.findByText('Response lost');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh saved review' }));
  expect(await screen.findByRole('button', { name: 'Evaluate nominated candidate' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Nominate candidate' })).not.toBeInTheDocument();
});

test('an experiment save error preserves review notes without sending a decision', async () => {
  mount({ onBeforeDecision: async () => ({ success: false, error: { message: 'Save conflict' } }) });
  fireEvent.click(await screen.findByRole('radio', { name: 'Inspect regularized linear' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Intended use' }), { target: { value: 'Keep these notes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Nominate candidate' }));
  await waitFor(() => expect(screen.getByText('Save conflict')).toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Intended use' })).toHaveValue('Keep these notes');
  expect(posts).toHaveLength(0);
});
