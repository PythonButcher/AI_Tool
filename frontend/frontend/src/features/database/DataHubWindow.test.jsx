import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import { WarehouseProvider } from '../../context/WarehouseContext';
import DataHubWindow from './DataHubWindow';

jest.mock('axios', () => ({ get: jest.fn(), delete: jest.fn(), post: jest.fn() }));

const first = { source_id: 'orders-1', name: 'Orders', source_kind: 'catalog' };
const second = { source_id: 'orders-2', name: 'Orders', source_kind: 'upload', row_count: 42 };
const records = sources => ({ data: { sources } });

beforeEach(() => jest.resetAllMocks());

function mount() {
  const openInAnalytics = jest.fn(() => true);
  render(<WarehouseProvider><DataHubWindow onUpload={jest.fn()} onOpenInAnalytics={openInAnalytics} /></WarehouseProvider>);
  return openInAnalytics;
}

test('loads, filters, and opens the exact record when names match', async () => {
  axios.get.mockResolvedValue(records([first, second]));
  const openInAnalytics = mount();
  expect(screen.getByText('Loading saved datasets…')).toBeVisible();
  const target = await screen.findByRole('button', { name: 'View details for Orders (orders-2)' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search datasets' }), { target: { value: 'orders-2' } });
  expect(screen.queryByRole('button', { name: 'View details for Orders (orders-1)' })).not.toBeInTheDocument();
  fireEvent.click(target);
  const details = within(screen.getByRole('complementary', { name: 'Dataset details' }));
  expect(details.getByText('orders-2')).toBeVisible();
  expect(details.getByText('42')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Open in Analytics' }));
  expect(openInAnalytics).toHaveBeenCalledWith(second);
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
  expect(dialog.getByText(/ID orders-2/)).toBeVisible();
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole('button', { name: 'Remove dataset' }));
  expect(await dialog.findByRole('alert')).toHaveTextContent('still used by a workspace or relationship');
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/datahub\/orders-2$/));
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
