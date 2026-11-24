import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import PlatformHub from './PlatformHub';

test('Datastream is the only launchable app and planned entries explain their purpose', () => {
  render(<PlatformHub links={{ datastream: { href: '/?app=datastream' } }} />);

  const datastream = within(screen.getByRole('article', { name: 'Datastream' }));
  expect(datastream.getByText('Available')).toBeVisible();
  expect(datastream.getByRole('link', { name: 'Open Datastream' })).toHaveAttribute('href', '/?app=datastream');
  expect(screen.getAllByRole('link')).toHaveLength(1);

  const planned = [
    ['Slipstream', /documents.*source evidence/i],
    ['Context Ledger', /governed business context.*evidence/i],
  ];
  for (const [name, description] of planned) {
    const entry = within(screen.getByRole('article', { name }));
    expect(entry.getByText('Planned')).toBeVisible();
    expect(entry.getByText(description)).toBeVisible();
    expect(entry.queryByRole('link')).not.toBeInTheDocument();
    expect(entry.queryByRole('button')).not.toBeInTheDocument();
  }
});
