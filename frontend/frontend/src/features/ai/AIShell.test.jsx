import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import AIShell from './AIShell';
import { DataContext } from '../../context/DataContext';
import { WarehouseContext } from '../../context/WarehouseContext';
import { WindowProvider } from '../../context/WindowContext';

jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../context/DataContext', () => ({ DataContext: require('react').createContext({}) }));
jest.mock('../../context/WarehouseContext', () => ({ WarehouseContext: require('react').createContext({}) }));
jest.mock('../../components/data_management/MentionDropdown', () => () => null);
jest.mock('../workflow/AiCommandBlock', () => ({ AICommands: { isCommand: value => value.startsWith('/') } }));
jest.mock('../../utils/aiResultPdfExport', () => ({ generateAiResultPdf: jest.fn() }));
jest.mock('./AICharts', () => ({ aiChartData }) => <div data-testid="chart">{aiChartData.labels.join(', ')}</div>);

const model = { dataset: { id: 'sales', name: 'Sales' }, metrics: [{ id: 'revenue', label: 'Revenue' }],
  dimensions: [{ id: 'region', field: 'Region', label: 'Region' }, { id: 'date', field: 'Date', label: 'Date', semantic_kind: 'temporal' }] };
const context = { activeWorkspace: { workspace_id: 'ws', version: 1 }, semanticModel: model, fullData: [{ Revenue: 100 }], cleanedData: null };
const chart = { type: 'chart', title: 'Revenue by region', artifact_id: 'chart-1', inspectable: true,
  content: { chartType: 'Bar', chartData: { labels: ['East'], datasets: [{ data: [100] }] }, chartSpec: { schemaVersion: 'chart_spec_v1' } },
  bi_grounding: { dataset: { dataset_name: 'Sales', dataset_id: 'sales' }, row_count: 1, source_row_count: 1,
    metric_definition: { id: 'revenue', label: 'Revenue' }, aggregation: 'sum', dimensions: [{ field: 'Region' }], filters: [] } };
const success = (extra = {}) => ({ data: { status: 'success', assistant_message: 'Revenue is 100.', artifacts: [chart],
  session_state: { dataset_context: { dataset: { dataset_id: 'sales' }, fingerprint: 'v1' }, analytics_state: { metric_id: 'revenue' } }, ...extra } });
const tree = (value = context, props = {}, datasets = []) => <WindowProvider><DataContext.Provider value={value}><WarehouseContext.Provider value={{ datasets }}><AIShell {...props} /></WarehouseContext.Provider></DataContext.Provider></WindowProvider>;
const send = message => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: message } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('suggestions use real model fields and preserve a draft for editing', () => {
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'What is Revenue?' }));
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('What is Revenue?');
  expect(axios.post).not.toHaveBeenCalled();
});

test('grounded answer supports a contextual refinement and dashboard save', async () => {
  axios.post.mockResolvedValue(success({ suggested_actions: [{ action_id: 'region', label: 'Break down by Region', enabled: true,
    kind: 'analytics_refinement', analytics_refinement: { operation: 'set_group_by', arguments: { field: 'Region' } } }] }));
  render(tree());
  send('Show revenue by region');
  await screen.findByText('Revenue is 100.');
  fireEvent.click(screen.getByText('Break down by Region'));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].analytics_refinement.arguments.field).toBe('Region');
  await waitFor(() => expect(screen.queryByText('Analyzing your data…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Save to Dashboard' }));
  const saved = JSON.parse(localStorage.getItem('chartStudioDashboard:v1')).items;
  expect(saved).toHaveLength(1);
  expect(saved[0].resultSnapshot.artifact.bi_grounding.dataset.dataset_id).toBe('sales');
});

test('failure preserves text and retry does not duplicate the user message', async () => {
  axios.post.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(success());
  render(tree());
  send('How much revenue?');
  await screen.findByRole('alert');
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('How much revenue?');
  fireEvent.click(screen.getByRole('button', { name: 'Retry last question' }));
  await screen.findByText('Revenue is 100.');
  expect(screen.getAllByText('How much revenue?')).toHaveLength(1);
});

test('double submission, cancellation and late completion cannot add duplicate or stale answers', async () => {
  const pending = deferred();
  axios.post.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(success({ assistant_message: 'New result' }));
  render(tree());
  send('Old question');
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Business question' }), { key: 'Enter' });
  expect(axios.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Stop waiting' }));
  expect(axios.post.mock.calls[0][2].signal.aborted).toBe(true);
  send('New question');
  await screen.findByText('New result');
  await act(async () => pending.resolve(success({ assistant_message: 'Stale result' })));
  expect(screen.queryByText('Stale result')).not.toBeInTheDocument();
});

test('dataset switch rejects a late response and starts with empty session', async () => {
  const pending = deferred();
  axios.post.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(success());
  const view = render(tree());
  send('Old question');
  view.rerender(tree({ ...context, activeWorkspace: { workspace_id: 'new', version: 1 } }));
  await act(async () => pending.resolve(success({ assistant_message: 'Wrong source' })));
  expect(screen.queryByText('Wrong source')).not.toBeInTheDocument();
  send('New question');
  await screen.findByText('Revenue is 100.');
  expect(axios.post.mock.calls[1][1].session_state).toEqual({ active_mode: 'explore' });
});

test('clarification sends a backend-defined exact choice', async () => {
  axios.post.mockResolvedValueOnce(success({ assistant_message: 'Choose a metric.', artifacts: [{ type: 'answer', content: {
    reason_code: 'analytics_clarification_required', message: 'Which revenue?', choices: [{ label: 'Net revenue', user_message: 'Show revenue metric:net_revenue' }],
  } }] })).mockResolvedValueOnce(success());
  render(tree());
  send('Show revenue');
  await screen.findByText('Choose a metric.');
  fireEvent.click(screen.getAllByRole('button', { name: 'Net revenue' })[0]);
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].user_message).toBe('Show revenue metric:net_revenue');
  await screen.findByText('Revenue is 100.');
});

test('review draft supports title edits, selection and duplicate-safe additions', async () => {
  axios.post.mockResolvedValue(success({ dashboard_draft: { schema_version: 'ai_chat_dashboard_draft_v1', note: 'Fixed results.', items: [
    { item_id: 'one', label: 'Regional breakdown', status: 'ready', artifact: chart },
    { item_id: 'two', label: 'Trend', status: 'unavailable', message: 'Missing date dimension' },
  ] } }));
  render(tree());
  send('Build a revenue dashboard');
  const draft = await screen.findByRole('region', { name: 'Dashboard draft' });
  fireEvent.change(within(draft).getByLabelText('Title for Regional breakdown'), { target: { value: 'My regional revenue' } });
  fireEvent.click(within(draft).getByRole('button', { name: 'Add 1 selected to dashboard' }));
  fireEvent.click(within(draft).getByRole('button', { name: 'Add 1 selected to dashboard' }));
  const saved = JSON.parse(localStorage.getItem('chartStudioDashboard:v1')).items;
  expect(saved).toHaveLength(1);
  expect(saved[0].title).toBe('My regional revenue');
  expect(within(draft).getByText(/already present/)).toBeInTheDocument();
});

test('unmount aborts the request and IME Enter does not submit', async () => {
  const pending = deferred();
  axios.post.mockReturnValue(pending.promise);
  const view = render(tree());
  const input = screen.getByRole('textbox', { name: 'Business question' });
  fireEvent.change(input, { target: { value: 'Revenue' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
  view.unmount();
  expect(axios.post.mock.calls[0][2].signal.aborted).toBe(true);
  await act(async () => pending.resolve(success()));
});

test('explicit catalog selection omits an unrelated active workspace and inline data', async () => {
  axios.post.mockResolvedValue(success());
  render(tree(context, {}, [{ id: 'other', name: 'Other' }]));
  send('Show revenue @Other');
  await screen.findByText('Revenue is 100.');
  const payload = axios.post.mock.calls[0][1];
  expect(payload.workspace_id).toBeUndefined();
  expect(payload.dataset).toBeUndefined();
  expect(payload.dataset_ref).toEqual({ source: 'datahub', dataset_id: 'other', dataset_name: 'Other' });
});

test('dashboard control delegates to the live app navigation', () => {
  const onOpenDashboard = jest.fn();
  render(tree(context, { onOpenDashboard }));
  fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));
  expect(onOpenDashboard).toHaveBeenCalledTimes(1);
});
