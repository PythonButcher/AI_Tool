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
  expect(screen.getByRole('button', { name: 'Run Preview' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('editing after preview releases the operation, requires a new preview and issues a new intent key', async () => {
  const changedOperation = { ...operation, operation_id: 'op-2' };
  global.fetch.mockResolvedValueOnce(response({ preparation: operation }))
    .mockResolvedValueOnce(response({ preparation: operation, preview: { row_count: 8, preview: [{ amount: 1 }] } }))
    .mockResolvedValueOnce(response({ preparation: { ...operation, status: 'cancelled' }, draft: {} }))
    .mockResolvedValueOnce(response({ preparation: changedOperation }))
    .mockResolvedValueOnce(response({ preparation: changedOperation, preview: { row_count: 8, preview: [{ amount: 1 }] } }));
  renderEditor({ context: { ...context, columns: [{ name: 'amount', logical_type: 'numeric' }] } });
  expect(screen.getByRole('button', { name: 'Apply and return' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  await screen.findByText('8 resulting rows · showing 1');
  expect(screen.getByRole('button', { name: 'Edit Step' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit steps' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit steps' })).not.toBeInTheDocument());
  expect(JSON.parse(global.fetch.mock.calls[2][1].body)).toEqual({ action: 'cancel' });
  fireEvent.click(screen.getByRole('button', { name: 'Trim Whitespace' }));
  expect(screen.getByRole('button', { name: 'Run Preview' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  expect(screen.getAllByRole('button', { name: 'Edit Step' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Apply and return' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  await screen.findByText('8 resulting rows · showing 1');
  const first = global.fetch.mock.calls[0][1], next = global.fetch.mock.calls[3][1];
  expect(next.headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
  expect(JSON.parse(next.body).steps.map(step => step.type)).toEqual(['remove_nulls', 'trim_whitespace']);
});

test('a lost cancellation leaves the plan locked until the same cancellation succeeds', async () => {
  global.fetch.mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce(response({ preparation: { ...operation, status: 'cancelled' }, draft: {} }));
  renderEditor({ context: { ...context, preparation: operation } });
  fireEvent.click(screen.getByRole('button', { name: 'Edit steps' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Edit Step' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit steps' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Step' })).toBeEnabled());
  expect(global.fetch.mock.calls[0]).toEqual(global.fetch.mock.calls[1]);
});

test('a definitively rejected start can be edited or closed without retrying an invalid recipe', async () => {
  const close = jest.fn();
  global.fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid recipe' } }) });
  renderEditor({ closeForm: close });
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Edit Step' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and return' }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('the full editor adds, edits, reorders and removes real transformations before preview', () => {
  renderEditor({ context: { ...context, columns: ['amount'] }, initialSteps: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Trim Whitespace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Change Case' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Case' }), { target: { value: 'upper' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Move Step Up' })[1]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit Step' })[0]);
  expect(screen.getByRole('combobox', { name: 'Case' })).toHaveValue('upper');
  fireEvent.change(screen.getByRole('combobox', { name: 'Case' }), { target: { value: 'lower' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update step' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove Step' })[1]);
  expect(screen.getAllByRole('button', { name: 'Edit Step' })).toHaveLength(1);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('the full editor sends a numeric zero replacement without converting it to text', async () => {
  global.fetch.mockResolvedValueOnce(response({ preparation: operation }))
    .mockResolvedValueOnce(response({ preparation: operation, preview: { row_count: 10, preview: [] } }));
  renderEditor({ context: { ...context, columns: ['amount'] }, initialSteps: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Missing & Rows' }));
  fireEvent.click(screen.getByRole('button', { name: 'Replace Nulls' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Custom Value (optional)' }), { target: { value: '0' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Replacement value type' }), { target: { value: 'number' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Run Preview' }));
  await screen.findByText('10 resulting rows · showing 0');
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).steps[0].params.value).toBe(0);
});
