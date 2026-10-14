import React, { useContext } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { ThemeContext, ThemeProvider } from './ThemeContext';
import { MuiThemeContext } from './MuiThemeContext';
import usePortalTheme from '../hooks/usePortalTheme';

function Probe({ portalRoot }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { palette } = useTheme();
  usePortalTheme(portalRoot);
  return <><button onClick={toggleTheme}>{theme}</button><output data-testid="palette">{JSON.stringify(palette)}</output></>;
}

const tree = portalRoot => <ThemeProvider><MuiThemeContext><Probe portalRoot={portalRoot} /></MuiThemeContext></ThemeProvider>;

beforeEach(() => localStorage.clear());
afterEach(() => { jest.restoreAllMocks(); document.documentElement.removeAttribute('data-theme'); });

test('saved theme applies to the app, MUI and a detached document and updates without remounting', () => {
  localStorage.setItem('theme', 'light');
  const detached = document.implementation.createHTMLDocument('Detached tool');
  render(tree(detached.body));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(detached.documentElement.getAttribute('data-theme')).toBe('light');
  expect(JSON.parse(screen.getByTestId('palette').textContent).mode).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: 'light' }));
  expect(detached.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(JSON.parse(screen.getByTestId('palette').textContent).mode).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
});

test('a newly attached popout receives the current theme', () => {
  const view = render(tree(null));
  fireEvent.click(screen.getByRole('button', { name: 'dark' }));
  const detached = document.implementation.createHTMLDocument('New popout');
  view.rerender(tree(detached.body));
  expect(detached.documentElement.getAttribute('data-theme')).toBe('light');
});

test('invalid or unavailable storage does not strand the application in an invalid theme', () => {
  localStorage.setItem('theme', 'invalid');
  const view = render(tree());
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  view.unmount();
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Denied'); });
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'dark' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
});

// CSS and MUI share visual contracts even though MUI requires literal colors.
const css = require('fs').readFileSync(require('path').join(__dirname, '../index.css'), 'utf8');
const tokens = block => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[a-f0-9]{6});/gi)].map(match => [match[1], match[2]]));
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test.each(['light', 'dark'])('%s shared text and action colors remain legible and agree with MUI', mode => {
  localStorage.setItem('theme', mode);
  render(tree());
  const palette = JSON.parse(screen.getByTestId('palette').textContent);
  const root = tokens(css.match(/:root\s*\{([\s\S]*?)\}/)[1]);
  const dark = tokens(css.match(/\[data-theme='dark'\]\s*\{([\s\S]*?)\}/)[1]);
  const t = { ...root, ...(mode === 'dark' ? dark : {}) };
  expect(palette.background.paper).toBe(t['--bg-primary']);
  expect(palette.background.default).toBe(t['--bg-secondary']);
  expect(palette.text.primary).toBe(t['--text-primary']);
  expect(palette.text.secondary).toBe(t['--text-secondary']);
  expect(palette.primary.main).toBe(t['--accent-blue']);
  expect(palette.primary.contrastText).toBe(t['--text-on-accent']);
  for (const surface of ['--bg-primary', '--bg-primary-soft', '--bg-secondary', '--bg-secondary-soft']) {
    for (const text of ['--text-primary', '--text-secondary', '--text-tertiary']) {
      expect(contrast(t[text], t[surface])).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const accent of ['--accent-blue', '--accent-green', '--accent-red', '--accent-teal']) {
    expect(contrast(t['--text-on-accent'], t[accent])).toBeGreaterThanOrEqual(4.5);
  }
});
