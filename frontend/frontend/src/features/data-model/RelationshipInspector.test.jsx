import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import RelationshipInspector from './RelationshipInspector';

const sources = [
  { source_id: 'products', alias: 'Products', schema: [{ name: 'sku' }, { name: 'warehouse' }] },
  { source_id: 'stock', alias: 'Stock', schema: [{ name: 'sku' }, { name: 'warehouse' }] },
];
const form = {
  left_source_id: 'products',
  right_source_id: 'stock',
  cardinality: 'one_to_one',
  field_pairs: [{ left_field: 'sku', right_field: 'sku' }],
};
const profile = {
  code: 'relationship_key_profile',
  severity: 'info',
  message: 'Join key results',
  evidence: {
    left_row_count: 3, left_unique: false, left_missing_rows: 1, left_repeated_rows: 2,
    left_unmatched_key_count: 0, left_issue_sample: [{ row_number: 3, reason: 'missing' }],
    right_row_count: 3, right_unique: true, right_missing_rows: 0, right_repeated_rows: 0,
    right_unmatched_key_count: 1,
  },
};

test('shows key evidence for an unsaved join and clears it when a field changes', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ diagnostics: [profile] }) });
  const onSave = jest.fn();
  try {
    render(<RelationshipInspector workspaceId="model" relationship={form} sources={sources} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check keys' }));
    expect(await screen.findByText('Join key results')).toBeVisible();
    expect(screen.getByText(/1 missing · 2 rows with repeated keys/)).toBeVisible();
    expect(screen.getByText(/Unique among complete keys/)).toBeVisible();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).field_pairs).toEqual(form.field_pairs);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('combobox').find(select => select.value === 'sku'), {
      target: { value: 'warehouse' },
    });
    expect(screen.queryByText('Join key results')).not.toBeInTheDocument();
  } finally {
    global.fetch = originalFetch;
  }
});

test('shows evidence returned by saved relationship validation', () => {
  render(<RelationshipInspector workspaceId="model" sources={sources}
    relationship={{ ...form, relationship_id: 'saved', diagnostics: [profile] }} />);
  expect(screen.getByText('Join key results')).toBeVisible();
  expect(screen.getByText(/1 missing · 2 rows with repeated keys/)).toBeVisible();
});
