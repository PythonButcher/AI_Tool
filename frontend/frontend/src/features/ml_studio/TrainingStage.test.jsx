import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrainingStage from './TrainingStage';

const config = { configuration_id: 'config-1', candidate: { families: ['regularized_linear'] }, validation: { strategy: 'random', folds: 3, holdout_fraction: .2 }, resource: { timeout_seconds: 120 }, metric: { primary: 'rmse' } };
const draft = { workspace_id: 'workspace-1', experiment_id: 'experiment-1', etag: 'etag-1', task_type: 'regression', assessment_current: true, assessment: { configuration: config } };
const run = { run_id: 'run-1', status: 'completed', progress_stage: 'development_complete', submitted_at: '2026-10-05T10:00:00Z', run_specification: { parameters: { configuration_id: 'config-1' } } };
const ok = body => Promise.resolve({ ok: true, json: async () => body });
const mount = props => render(<TrainingStage draft={draft} showGuidance onBeforeSubmit={async () => ({ success: true, draft: { ...draft, etag: 'flushed' } })} onRunChanged={jest.fn()} onReview={jest.fn()} {...props} />);
beforeEach(() => { sessionStorage.clear(); global.fetch = jest.fn(); });
afterEach(() => { jest.restoreAllMocks(); });

test('waits for saved edits and retries a lost submission with the same key', async () => {
  const posts = [];
  let attempt = 0;
  fetch.mockImplementation((url, options) => {
    if (options?.method === 'POST') {
      posts.push(options);
      return ++attempt === 1 ? Promise.reject(new Error('Connection lost')) : ok({ run });
    }
    return url.includes('/run-1?') ? ok({ run, events: [] }) : ok({ runs: [] });
  });
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start training' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Start training' }));
  await screen.findByText('Connection lost');
  fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[0].headers['If-Match']).toBe('flushed');
  expect(posts[0].headers['Idempotency-Key']).toBe(posts[1].headers['Idempotency-Key']);
  expect(JSON.parse(posts[0].body)).toEqual({ configuration_id: 'config-1' });
});

test('resumes a running experiment and requests cancellation without inventing completion', async () => {
  const running = { ...run, status: 'running', progress_stage: 'random_forest_fold_1' };
  let cancelled = false;
  fetch.mockImplementation((url, options) => {
    if (options?.method === 'POST') cancelled = true;
    const current = cancelled ? { ...running, status: 'cancel_requested' } : running;
    return url.includes('/run-1?') ? ok({ run: current, events: [{ status: 'running', progress_stage: 'random_forest_fold_1', occurred_at: run.submitted_at }] }) : ok({ runs: [current] });
  });
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel run' }));
  expect(await screen.findByRole('button', { name: 'Cancellation requested' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Review results' })).not.toBeInTheDocument();
  view.unmount();
});

test('shows persisted failure and permits a deliberate new run', async () => {
  const failed = { ...run, status: 'failed', failure: { message: 'Training exceeded the limit.', remediation: 'Reduce the candidate count.' } };
  fetch.mockImplementation(url => url.includes('/run-1?') ? ok({ run: failed, events: [] }) : ok({ runs: [failed] }));
  mount();
  expect(await screen.findByText('Training exceeded the limit.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start new run' })).toBeEnabled();
});

test('does not submit after unmount while waiting for a save', async () => {
  let finish;
  fetch.mockImplementation(() => ok({ runs: [] }));
  const view = mount({ onBeforeSubmit: () => new Promise(resolve => { finish = resolve; }) });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start training' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Start training' }));
  view.unmount();
  await act(async () => finish({ success: true, draft }));
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});

test('server save conflicts prevent training', async () => {
  fetch.mockImplementation(() => ok({ runs: [] }));
  mount({ onBeforeSubmit: async () => ({ success: false, error: { message: 'Reload the draft to resolve a conflict.' } }) });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start training' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Start training' }));
  expect(await screen.findByText('Reload the draft to resolve a conflict.')).toBeInTheDocument();
  expect(fetch.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
});
