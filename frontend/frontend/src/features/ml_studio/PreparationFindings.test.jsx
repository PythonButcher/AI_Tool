import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreparationFindings from './PreparationFindings';

const issues = [
  { issue_id: 'a', code: 'missing_values', field: 'temperature', logical_type: 'numeric', count: 5, message: 'Missing temperature', training_imputation_available: true },
  { issue_id: 'b', code: 'missing_values', field: 'rain', logical_type: 'numeric', count: 5, message: 'Missing rainfall', training_imputation_available: true },
  { issue_id: 'c', code: 'duplicate_rows', count: 2, message: 'Repeated observations' },
  { issue_id: 'd', code: 'whitespace', field: 'region', count: 3, message: 'Surrounding spaces' },
];
const fixes = [{ issue_id: 'c', action_type: 'remove_duplicates', parameters: { keep: 'first' }, support_status: 'supported', fix_id: 'fc' },
  { issue_id: 'd', action_type: 'trim_whitespace', parameters: { columns: ['region'] }, support_status: 'supported', fix_id: 'fd' }];
const data = { issues, fixes, row_count: 100, checks: ['missing_values', 'duplicate_rows', 'whitespace'] };

test('groups evidence and combines selected null columns into one preview without auto-dropping duplicates', () => {
  const open = jest.fn(); render(<PreparationFindings data={data} onOpenPlan={open} />);
  expect(screen.getByRole('region', { name: 'Missing values' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Repeated rows' })).toBeInTheDocument();
  expect(screen.getAllByText('5.0% of rows')).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox', { name: 'Bulk missing-value treatment' }), { target: { value: 'remove' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview selected fixes' }));
  expect(open).toHaveBeenCalledWith({ autoPreview: true, steps: [
    { type: 'trim_whitespace', params: { columns: ['region'] } },
    { type: 'remove_nulls', params: { columns: ['temperature', 'rain'] } },
  ] });
});

test('respects selection and preserves numeric replacement values including zero', () => {
  const open = jest.fn(); render(<PreparationFindings data={data} onOpenPlan={open} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all findings' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select temperature' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Treatment for temperature' }), { target: { value: 'constant' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview selected fixes' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a replacement');
  expect(open).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Replacement for temperature' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview selected fixes' }));
  expect(open).toHaveBeenCalledWith({ autoPreview: true, steps: [{ type: 'replace_nulls', params: { columns: ['temperature'], strategy: 'value', value: 0 } }] });
});

test('training handling retains findings, skips ineligible targets and never claims a repair', () => {
  const open = jest.fn(); render(<PreparationFindings data={{ ...data, issues: [issues[0], { ...issues[1], training_imputation_available: false }] }} onOpenPlan={open} />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Bulk missing-value treatment' }), { target: { value: 'training' } });
  expect(screen.getByRole('combobox', { name: 'Treatment for temperature' })).toHaveValue('training');
  expect(screen.getByRole('combobox', { name: 'Treatment for rain' })).toHaveValue('leave');
  fireEvent.click(screen.getByRole('button', { name: 'Preview selected fixes' }));
  expect(open).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('findings retained');
  expect(screen.getByText('Missing temperature')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open full editor' }));
  expect(open).toHaveBeenCalledWith({ steps: [] });
});
