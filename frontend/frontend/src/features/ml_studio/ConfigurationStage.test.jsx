import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationStage from './ConfigurationStage';

const draft = { snapshot_id: 'snapshot-1', task_type: 'regression', roles: { target: 'y', numeric: ['x'], categorical: [], ignored: [], time: [], group: [] } };
const schema = ['x', 'y', 'label'].map(name => ({ name, logical_type: name === 'label' ? 'text' : 'numeric', null_count: 0 }));
const response = (columns = schema) => ({ ok: true, json: async () => ({ snapshot: { column_profile: columns } }) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; };
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue(response()); });

test('searchable roles are exclusive and assessments submit settings without browser identities or hashes', async () => {
  const edit = jest.fn(), assess = jest.fn().mockResolvedValue({ success: true });
  render(<ConfigurationStage draft={draft} showGuidance onEdit={edit} onAssess={assess} />);
  const role = await screen.findByRole('combobox', { name: 'Role for x' });
  fireEvent.change(role, { target: { value: 'target' } });
  expect(edit).toHaveBeenLastCalledWith({ roles: { ...draft.roles, target: 'x', numeric: [] } });
  expect(screen.getByRole('combobox', { name: 'Role for y' })).toHaveValue('ignored');
  fireEvent.change(screen.getByRole('combobox', { name: 'Role for y' }), { target: { value: 'numeric' } });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a column' }), { target: { value: 'label' } });
  expect(screen.queryByRole('combobox', { name: 'Role for x' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save & assess' }));
  await waitFor(() => expect(assess).toHaveBeenCalledTimes(1));
  expect(Object.keys(assess.mock.calls[0][0]).sort()).toEqual(['candidate', 'metric', 'resource', 'roles', 'validation']);
  expect(assess.mock.calls[0][0].roles).toMatchObject({ target: 'x', numeric: ['y'] });
});

test('failed assessment preserves settings and duplicate clicks cannot submit twice', async () => {
  const pending = deferred(), assess = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue({ success: true });
  render(<ConfigurationStage draft={draft} onEdit={jest.fn()} onAssess={assess} />);
  await screen.findByRole('combobox', { name: 'Role for x' });
  fireEvent.change(screen.getByLabelText('Selection metric'), { target: { value: 'mae' } });
  const button = screen.getByRole('button', { name: 'Save & assess' });
  fireEvent.click(button); fireEvent.click(button);
  expect(assess).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => pending.resolve({ success: false, error: { message: 'Save conflict', remediation: 'Reload or duplicate the draft.' } }));
  expect(screen.getByRole('alert')).toHaveTextContent('Save conflict');
  expect(screen.getByLabelText('Selection metric')).toHaveValue('mae');
  fireEvent.click(button);
  await waitFor(() => expect(assess).toHaveBeenCalledTimes(2));
  expect(assess.mock.calls[0]).toEqual(assess.mock.calls[1]);
});

test('stale or blocked evidence cannot offer training and guidance does not reset fields', async () => {
  const assessment = { state: 'ready', issues: [{ code: 'missing', field: 'x', severity: 'warning', message: 'Training-only imputation.' }], input_fingerprint: 'hash' };
  const props = { draft: { ...draft, assessment, assessment_current: true }, onEdit: jest.fn(), onAssess: jest.fn(), canTrain: true, showGuidance: true };
  const view = render(<ConfigurationStage {...props} />);
  await screen.findByRole('combobox', { name: 'Role for x' });
  expect(screen.getByRole('button', { name: 'Continue to Train' })).toBeVisible();
  expect(screen.getByText(/Training-only imputation/)).toBeInTheDocument();
  view.rerender(<ConfigurationStage {...props} showGuidance={false} draft={{ ...props.draft, assessment_current: false }} />);
  expect(screen.queryByRole('button', { name: 'Continue to Train' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Role for x' })).toHaveValue('numeric');
  expect(screen.queryByText(/Each column has one role/)).not.toBeInTheDocument();
});

test('schema requests ignore responses from an old snapshot and from unmounted stages', async () => {
  const old = deferred(); global.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response([{ name: 'fresh', logical_type: 'numeric', null_count: 0 }]));
  const props = { draft, onEdit: jest.fn(), onAssess: jest.fn() };
  const view = render(<ConfigurationStage {...props} />);
  view.rerender(<ConfigurationStage {...props} draft={{ ...draft, snapshot_id: 'snapshot-2' }} />);
  await screen.findByRole('combobox', { name: 'Role for fresh' });
  await act(async () => old.resolve(response()));
  expect(screen.queryByRole('combobox', { name: 'Role for x' })).not.toBeInTheDocument();
  view.unmount();
});
