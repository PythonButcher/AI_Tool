import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreparationEditor from './PreparationEditor';

const context = { experiment_id: 'exp-1', workspace_id: 'ws-1', snapshot_id: 'snap-1', base_etag: 'etag-1',
  issue_id: 'issue-1', fix_id: 'fix-1', return_stage: 'Prepare Data', title: 'Sales', field: 'amount' };
const steps = [{ type: 'remove_nulls', params: { columns: ['amount'] } }];
const operation = { ...context, operation_id: 'op-1', status: 'open', recipe: { steps: [{ action_type: 'remove_nulls', parameters: { columns: ['amount'] } }] } };
const response = data => ({ ok: true, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const renderEditor = (props = {}) => render(<PreparationEditor context={context} initialSteps={steps} closeForm={jest.fn()} {...props} />);

beforeEach(() => { global.fetch = jest.fn(); });

test('starts with server fix parameters, previews bounded rows, then applies the same operation', async () => {
  const finished = jest.fn(), close = jest.fn();
  const applied = { preparation: { ...operation, status: 'applied' }, draft: { experiment_id: 'exp-1' } };
  global.fetch.mockResolvedValueOnce(response({ preparation: operation }))
    .mockResolvedValueOnce(response({ preparation: operation, preview: { row_count: 1200, preview: Array.from({ length: 102 }, (_, amount) => ({ amount })) } }))
    .mockResolvedValueOnce(response(applied));
  renderEditor({ onFinished: finished, closeForm: close });
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  expect(await screen.findByText('1,200 resulting rows · showing 100')).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(101);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toContain('/drafts/exp-1/preparation?workspace_id=ws-1');
  expect(options.headers['If-Match']).toBe('etag-1');
  expect(JSON.parse(options.body)).toEqual({ snapshot_id: 'snap-1', steps, issue_id: 'issue-1', fix_id: 'fix-1', return_stage: 'Prepare Data' });
  fireEvent.click(screen.getByRole('button', { name: 'Apply and return' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(finished).toHaveBeenCalledWith(applied);
  expect(global.fetch.mock.calls[2][1].headers['If-Match']).toBe('etag-1');
  expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({ action: 'apply' });
  expect(global.fetch.mock.calls.every(([request]) => !request.includes('/api/manual_cleaning'))).toBe(true);
});

test('lost begin response retries with the same key and intent', async () => {
  global.fetch.mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce(response({ preparation: operation }))
    .mockResolvedValueOnce(response({ preparation: operation, preview: { row_count: 0, preview: [] } }));
  renderEditor();
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost');
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  await screen.findByText('0 resulting rows · showing 0');
  expect(global.fetch.mock.calls[0][1]).toEqual(global.fetch.mock.calls[1][1]);
});

test('lost apply response keeps the editor open and retries the original operation', async () => {
  const close = jest.fn();
  global.fetch.mockRejectedValueOnce(new Error('Response lost'))
    .mockResolvedValueOnce(response({ preparation: { ...operation, status: 'applied' }, draft: {} }));
  renderEditor({ context: { ...context, preparation: operation }, closeForm: close });
  fireEvent.click(screen.getByRole('button', { name: 'Apply and return' }));
  await screen.findByRole('alert');
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply and return' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(global.fetch.mock.calls[0]).toEqual(global.fetch.mock.calls[1]);
});

test('pending action prevents duplicate submission and cancel, then confirms terminal cancellation', async () => {
  const close = jest.fn(), pending = deferred();
  global.fetch.mockReturnValueOnce(pending.promise);
  renderEditor({ context: { ...context, preparation: operation }, closeForm: close });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  await act(async () => pending.resolve(response({ preparation: { ...operation, status: 'cancelled' }, draft: {} })));
  expect(close).toHaveBeenCalledTimes(1);
});

test('unmount after begin suppresses preview and callbacks; server operation remains recoverable', async () => {
  const pending = deferred(), finished = jest.fn(), close = jest.fn();
  global.fetch.mockReturnValueOnce(pending.promise);
  const view = renderEditor({ onFinished: finished, closeForm: close });
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  view.unmount();
  await act(async () => pending.resolve(response({ preparation: operation })));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(finished).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

test('cancel before begin closes without mutation and keyboard focus stays in the dialog', () => {
  const close = jest.fn();
  renderEditor({ closeForm: close });
  const cancel = screen.getByRole('button', { name: 'Cancel and return' });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Apply and return' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});
