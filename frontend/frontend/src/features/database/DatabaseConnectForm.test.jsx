import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import DatabaseConnectForm from './DatabaseConnectForm';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

const base = 'http://localhost:5000/api/postgres';
const orders = { schema: 'sales', table: 'orders' };
const customers = { schema: 'sales', table: 'customers' };
const response = {
  workspace: { workspace_id: 'ws_sales', name: 'Sales model', primary_source_id: 'src_orders', version: 1 },
  analysis_context: { workspace_id: 'ws_sales', workspace_version: 1, primary_source_id: 'src_orders' },
  full_data: [{ revenue: 35 }],
};

beforeEach(() => {
  jest.resetAllMocks();
  axios.get.mockResolvedValue({ data: { workspaces: [] } });
});

test('selects a database, explicit columns and a primary table, then activates the saved model', async () => {
  axios.post.mockResolvedValueOnce({ data: { databases: ['operations', 'warehouse'] } });
  axios.post.mockResolvedValueOnce({ data: {
    database: 'warehouse',
    limits: { tables: 12, columns_per_table: 100 },
    tables: [
      { ...orders, columns: [{ name: 'customer_id', data_type: 'integer' }, { name: 'revenue', data_type: 'numeric' }, { name: 'note', data_type: 'text' }] },
      { ...customers, columns: [{ name: 'id', data_type: 'integer' }, { name: 'segment', data_type: 'text' }] },
      { schema: 'sales', table: 'excluded', columns: [{ name: 'id', data_type: 'integer' }] },
    ],
  } });
  axios.post.mockResolvedValueOnce({ data: response });
  const activate = jest.fn();
  const close = jest.fn();
  render(<DatabaseConnectForm handleDatabaseData={activate} onClose={close} />);

  fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'localhost' } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'reader' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find databases' }));
  fireEvent.change(await screen.findByLabelText('Available databases'), { target: { value: 'warehouse' } });
  fireEvent.click(screen.getByRole('button', { name: 'Browse tables' }));
  expect(await screen.findByRole('button', { name: 'Save PostgreSQL model' })).toBeDisabled();

  fireEvent.click(screen.getByRole('checkbox', { name: /sales\.customers/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /sales\.orders/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /note text/ }));
  fireEvent.change(screen.getByLabelText('Primary table'), { target: { value: JSON.stringify(['sales', 'orders']) } });
  fireEvent.change(screen.getByLabelText('Model name'), { target: { value: 'Sales model' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save PostgreSQL model' }));

  await waitFor(() => expect(activate).toHaveBeenCalledWith(response));
  expect(close).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenNthCalledWith(2, `${base}/tables`, expect.objectContaining({ dbname: 'warehouse' }), expect.any(Object));
  expect(axios.post).toHaveBeenNthCalledWith(3, `${base}/workspaces`, {
    connection: expect.objectContaining({ dbname: 'warehouse' }),
    name: 'Sales model',
    tables: [{ ...customers, columns: ['id', 'segment'] }, { ...orders, columns: ['customer_id', 'revenue'] }],
    primary: orders,
  }, expect.any(Object));
});

test('reopens a saved workspace without credentials and keeps it available after a failed request', async () => {
  axios.get.mockResolvedValue({ data: { workspaces: [{ workspace_id: 'ws_sales', name: 'Sales model', source_count: 2 }] } });
  axios.post.mockRejectedValueOnce({ response: { data: { error: { message: 'Could not load the snapshot.' } } } });
  axios.post.mockResolvedValueOnce({ data: response });
  const activate = jest.fn();
  render(<DatabaseConnectForm handleDatabaseData={activate} />);

  const open = await screen.findByRole('button', { name: 'Sales model' });
  fireEvent.click(open);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the snapshot.');
  expect(activate).not.toHaveBeenCalled();
  fireEvent.click(open);
  await waitFor(() => expect(activate).toHaveBeenCalledWith(response));
  expect(axios.post).toHaveBeenLastCalledWith(`${base}/workspaces/ws_sales/open`, undefined, expect.any(Object));
});
