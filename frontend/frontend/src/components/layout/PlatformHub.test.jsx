import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '../../context/ThemeContext';
import PlatformHub from './PlatformHub';
import { HUB_PALETTE_STORAGE_KEY } from './platformHubData';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

test('Datastream is the only launchable app and planned entries explain their purpose', () => {
  render(<PlatformHub links={{ datastream: { href: '/?app=datastream' } }} />);

  const datastream = within(screen.getByRole('article', { name: 'Datastream' }));
  expect(datastream.getByText('Available')).toBeVisible();
  expect(datastream.getByRole('link', { name: 'Open Datastream' })).toHaveAttribute('href', '/?app=datastream');
  expect(screen.getAllByRole('link')).toHaveLength(1);

  const planned = [
    ['Slipstream', /documents.*source evidence/i],
    ['Context Ledger', /governed business context.*evidence/i],
    ['Publishing Portal', /published dashboards.*excel-style/i],
  ];
  for (const [name, description] of planned) {
    const entry = within(screen.getByRole('article', { name }));
    expect(entry.getByText('Planned')).toBeVisible();
    expect(entry.getByText(description)).toBeVisible();
    expect(entry.queryByRole('link')).not.toBeInTheDocument();
    expect(entry.queryByRole('button')).not.toBeInTheDocument();
  }
});

test('supports switching light and dark mode and persisted color themes directly from the hub', () => {
  render(
    <ThemeProvider>
      <PlatformHub links={{ datastream: { href: '/?app=datastream' } }} />
    </ThemeProvider>
  );

  const main = screen.getByRole('main', { name: 'Data platform' });
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(main).toHaveAttribute('data-hub-palette', 'mineral');

  const modeToggle = screen.getByRole('button', { name: 'Switch to light mode' });
  fireEvent.click(modeToggle);
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('theme')).toBe('light');
  expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();

  const emeraldBtn = screen.getByRole('button', { name: 'Emerald Tide color theme' });
  fireEvent.click(emeraldBtn);
  expect(main).toHaveAttribute('data-hub-palette', 'emerald');
  expect(emeraldBtn).toHaveAttribute('aria-pressed', 'true');
  expect(localStorage.getItem(HUB_PALETTE_STORAGE_KEY)).toBe('emerald');
});

test('exposes sign-in placeholder, interactive visuals, topic context, how-to guides, and roadmap tabs', () => {
  render(<PlatformHub links={{ datastream: { href: '/?app=datastream' } }} />);

  // Interactive visual switcher cycles editorial images
  expect(screen.getByRole('img', { name: /layered glass data planes/i })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Analytics & ML' }));
  expect(screen.getByRole('img', { name: /glass analytical bar clusters/i })).toBeVisible();

  // Sign-in roadmap placeholder opens and dismisses with Escape
  const signInBtn = screen.getByRole('button', { name: /Sign in/i });
  fireEvent.click(signInBtn);
  const accountRegion = screen.getByRole('region', { name: 'Account and identity preview' });
  expect(within(accountRegion).getByText('Local workspace mode')).toBeVisible();
  expect(within(accountRegion).getByRole('button', { name: /Continue with Google \/ SSO/i })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Account and identity preview' })).not.toBeInTheDocument();
  expect(signInBtn).toHaveFocus();

  // Topic context buttons switch context panel
  const loginTopicBtn = screen.getByRole('button', { name: 'Login & Context Memory' });
  fireEvent.click(loginTopicBtn);
  expect(loginTopicBtn).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: /Authenticated workspaces and inspectable memory/i })).toBeVisible();

  // How-To Guides tab switches step-by-step playbooks
  fireEvent.click(screen.getByRole('tab', { name: 'How-To Guides' }));
  const mlGuideBtn = screen.getByRole('button', { name: /Local ML Studio/i });
  fireEvent.click(mlGuideBtn);
  expect(mlGuideBtn).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: /Train, benchmark, and export a local ML model/i })).toBeVisible();

  // Planned Roadmap tab displays future placeholders
  fireEvent.click(screen.getByRole('tab', { name: 'Planned Roadmap' }));
  expect(screen.getByRole('heading', { name: 'Sign-In, SSO & Access' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'AI Context Memory' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Live Business Model' })).toBeVisible();
});
