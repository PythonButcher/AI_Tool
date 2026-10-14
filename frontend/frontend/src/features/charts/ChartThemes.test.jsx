import React, { useContext } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from '../../context/ThemeContext';
import { MuiThemeContext } from '../../context/MuiThemeContext';
import ChartComponent from './ChartComponent';
import ChartComponentAI from './ChartComponentAI';

jest.mock('./ChartToolbar', () => () => null);
jest.mock('react-chartjs-2', () => {
  const React = require('react');
  const Chart = React.forwardRef((props, ref) => <output data-testid="chart">{JSON.stringify({ data: props.data, options: props.options })}</output>);
  return { Bar: Chart, Line: Chart, Pie: Chart, Doughnut: Chart, Scatter: Chart, Radar: Chart };
});

function Toggle() {
  const { toggleTheme } = useContext(ThemeContext);
  return <button onClick={toggleTheme}>Switch theme</button>;
}

test.each(['standard', 'AI'])('%s charts update labels and tooltips while preserving values on theme changes', kind => {
  localStorage.setItem('theme', 'light');
  const data = { labels: ['Revenue'], datasets: [{ label: 'Total', data: [125] }] };
  render(<ThemeProvider><MuiThemeContext><Toggle />{kind === 'AI'
    ? <ChartComponentAI aiChartData={data} />
    : <ChartComponent chartData={data} />}</MuiThemeContext></ThemeProvider>);
  const before = JSON.parse(screen.getByTestId('chart').textContent);
  fireEvent.click(screen.getByRole('button', { name: 'Switch theme' }));
  const after = JSON.parse(screen.getByTestId('chart').textContent);
  expect(after.data.datasets[0].data).toEqual([125]);
  expect(after.data.labels).toEqual(before.data.labels);
  expect(after.options.scales.x.ticks.color).not.toBe(before.options.scales.x.ticks.color);
  expect(after.options.plugins.legend.labels.color).not.toBe(before.options.plugins.legend.labels.color);
  expect(after.options.plugins.tooltip.backgroundColor).not.toBe(before.options.plugins.tooltip.backgroundColor);
});
