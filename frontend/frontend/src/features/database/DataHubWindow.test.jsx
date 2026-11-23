import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { WarehouseProvider } from '../../context/WarehouseContext';
import DataHubWindow from './DataHubWindow';

jest.mock('axios', () => ({ get: jest.fn(), delete: jest.fn(), post: jest.fn() }));

const first = { dataset_id: 'orders-1', source_id: 'orders-1', name: 'Orders', kind: 'legacy' };
const second = { dataset_id: 'orders-2', name: 'Orders', kind: 'source', revision: 1, row_count: 42 };
const records = datasets => ({ data: { datasets } });

beforeEach(() => jest.resetAllMocks());

function mount() {
  const onOpenDataset = jest.fn();
  const view = render(<WarehouseProvider><DataHubWindow onUpload={jest.fn()} onOpenDataset={onOpenDataset} /></WarehouseProvider>);
  return { onOpenDataset, ...view };
}

test('loads, filters, and opens the exact record when names match', async () => {
  axios.get.mockResolvedValue(records([first, second]));
  const opened = { dataset: second, workspace: { workspace_id: 'working-2' }, analysis_context: {}, full_data: [{ id: 42 }] };
  axios.post.mockResolvedValue({ data: opened });
  const { onOpenDataset } = mount();
  expect(screen.getByText('Loading saved datasets…')).toBeVisible();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search datasets' }), { target: { value: 'orders-2' } });
  expect(screen.queryByRole('button', { name: 'View details for Orders (orders-1)' })).not.toBeInTheDocument();
  fireEvent.click(target);
  const details = within(screen.getByRole('complementary', { name: 'Dataset details' }));
  expect(details.getByText('42')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Open in Analytics' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open dataset' }));
  await waitFor(() => expect(onOpenDataset).toHaveBeenCalledWith(opened));
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/orders-2\/open$/), {}, { signal: expect.anything() });
});

test('open errors keep the catalog visible and leaving aborts a retry', async () => {
  axios.get.mockResolvedValue(records([second]));
  axios.post.mockRejectedValueOnce({ response: { data: { error: { message: 'Source file changed.' } } } });
  let resolve;
  axios.post.mockImplementationOnce(() => new Promise(finish => { resolve = finish; }));
  const { onOpenDataset, unmount } = mount();
  const open = await screen.findByRole('button', { name: 'Open dataset' });
  fireEvent.click(open);
  expect(await screen.findByRole('alert')).toHaveTextContent('Source file changed.');
  fireEvent.click(open);
  fireEvent.click(open);
  expect(axios.post).toHaveBeenCalledTimes(2);
  const signal = axios.post.mock.calls[1][2].signal;
  unmount();
  expect(signal.aborted).toBe(true);
  resolve({ data: { dataset: second, workspace: { workspace_id: 'working-2' }, analysis_context: {}, full_data: [] } });
  await Promise.resolve();
  expect(onOpenDataset).not.toHaveBeenCalled();
});

test('retries a failed list request and displays an empty catalog', async () => {
  axios.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(records([]));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load saved datasets.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
});

test('removal confirms the exact ID and reports dependency refusals without removing a row', async () => {
  axios.get.mockResolvedValue(records([first, second]));
  axios.delete.mockRejectedValue({ response: { status: 409, data: { error: {
    code: 'source_has_dependencies', message: 'This dataset is still used by a workspace or relationship.',
  } } } });
  mount();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.click(within(target.closest('li')).getByRole('button', { name: 'Remove', exact: true }));
  const dialog = within(screen.getByRole('dialog', { name: 'Remove dataset?' }));
  expect(dialog.getByText('Orders')).toBeVisible();
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button', { name: 'Remove dataset' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('still used by a workspace or relationship');
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/datahub\/saved-datasets\/orders-2$/));
  fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(target).toBeVisible());
  expect(target).toBeInTheDocument();
});

test('successful removal retains other records with the same name', async () => {
  axios.get.mockResolvedValueOnce(records([first, second])).mockResolvedValue(records([second]));
  axios.delete.mockResolvedValue({ data: { source_id: first.source_id } });
  mount();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-1)' });
  fireEvent.click(within(target.closest('li')).getByRole('button', { name: 'Remove', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove dataset' }));
  expect(await screen.findByText('Removed Orders.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'View details for Orders (orders-1)' })).not.toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'View details for Orders (orders-2)' })).toBeVisible();
});

test('Delete All requires Yes and clears the entire catalog even with a search filter', async () => {
  axios.get.mockResolvedValueOnce(records([first, second])).mockResolvedValue(records([]));
  axios.delete.mockResolvedValue({ data: { deleted_count: 2 } });
  mount();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.click(target);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'orders-2' } });
  const deleteAll = screen.getByRole('button', { name: 'Delete All' });

  fireEvent.click(deleteAll);
  const dialog = within(screen.getByRole('dialog', { name: 'Are you sure?' }));
  expect(dialog.getByRole('button', { name: 'No' })).toHaveFocus();
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button', { name: 'No' }));
  expect(await screen.findByRole('button', { name: 'Delete All' })).toBeEnabled();
  expect(target).toBeVisible();
  expect(axios.delete).not.toHaveBeenCalled();

  fireEvent.click(deleteAll);
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

  expect(axios.delete).toHaveBeenCalledTimes(1);
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/datahub$/));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
  expect(screen.getByText('Select a dataset to see its metadata and readiness.')).toBeVisible();
  expect(await screen.findByRole('button', { name: 'Delete All' })).toBeDisabled();
});

test('Delete All prevents duplicate requests and allows retry after an error', async () => {
  axios.get.mockResolvedValueOnce(records([first])).mockResolvedValue(records([]));
  let rejectDeletion;
  axios.delete.mockImplementationOnce(() => new Promise((resolve, reject) => {
    rejectDeletion = reject;
  })).mockResolvedValueOnce({ data: { deleted_count: 1 } });
  mount();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-1)' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete All' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Are you sure?' }));

  fireEvent.click(dialog.getByRole('button', { name: 'Yes' }));
  expect(dialog.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  expect(dialog.getByRole('button', { name: 'No' })).toBeDisabled();
  expect(axios.delete).toHaveBeenCalledTimes(1);
  rejectDeletion(new Error('offline'));

  expect(await dialog.findByRole('alert')).toHaveTextContent('Could not delete saved datasets. Try again.');
  expect(target).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Yes' }));
  expect(await screen.findByText('No saved datasets yet')).toBeVisible();
});
