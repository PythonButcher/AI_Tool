import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import AIShell from './AIShell';
import { CHAT_STORAGE_KEY } from './chatConversations';
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Open chart' })[0]);
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
  expect(within(screen.getByRole('main')).getAllByText('How much revenue?')).toHaveLength(1);
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

test('choosing data from the composer preserves the question and opens an initialized picker', () => {
  render(tree());
  const input = screen.getByRole('textbox', { name: 'Business question' });
  fireEvent.change(input, { target: { value: 'Compare revenue' } });
  fireEvent.click(screen.getByRole('button', { name: 'Choose dataset for question' }));
  expect(input).toHaveValue('Compare revenue @');
  expect(input).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Choose dataset for question' }));
  expect(input).toHaveValue('Compare revenue @');
  expect(axios.post).not.toHaveBeenCalled();
});

test('sliding the sidebar preserves an in-flight question and an unsent follow-up', async () => {
  const pending = deferred();
  axios.post.mockReturnValue(pending.promise);
  render(tree());
  send('Show revenue');
  const input = screen.getByRole('textbox', { name: 'Business question' });
  fireEvent.change(input, { target: { value: 'Break it down by region' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hide chat sidebar' }));
  expect(screen.queryByRole('navigation', { name: 'Chat tools' })).not.toBeInTheDocument();
  expect(input).toHaveValue('Break it down by region');
  await act(async () => pending.resolve(success()));
  expect(await screen.findByText('Revenue is 100.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show chat sidebar' }));
  expect(screen.getByRole('navigation', { name: 'Chat tools' })).not.toHaveAttribute('inert');
  expect(input).toHaveValue('Break it down by region');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('result inspection moves focus into the pane and returns it to the header on close', () => {
  render(tree());
  expect(screen.queryByRole('complementary', { name: 'BI Results' })).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'Toggle Results Pane' });
  fireEvent.click(toggle);
  expect(screen.getByRole('heading', { name: 'Result details' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Close Results Pane' }));
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('complementary', { name: 'BI Results' })).not.toBeInTheDocument();
});

test('new chats isolate backend context and switching restores the prior draft and analysis', async () => {
  axios.post.mockResolvedValue(success());
  render(tree());
  send('Revenue overview');
  await screen.findByText('Revenue is 100.');
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: 'My unsent follow-up' } });
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('');
  expect(screen.queryByText('Revenue is 100.')).not.toBeInTheDocument();
  send('Different analysis');
  await screen.findByText('Revenue is 100.');
  expect(axios.post.mock.calls[1][1].session_state).toEqual({ active_mode: 'explore' });
  expect(axios.post.mock.calls[1][1].conversation_history).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your chats' })).getByRole('button', { name: 'Open chat: Revenue overview' }));
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('My unsent follow-up');
  send('Break it down by region');
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(3));
  expect(axios.post.mock.calls[2][1].session_state.analytics_state.metric_id).toBe('revenue');
  expect(axios.post.mock.calls[2][1].conversation_history.map(message => message.content)).not.toContain('Different analysis');
  await waitFor(() => expect(screen.queryByText('Analyzing your data…')).not.toBeInTheDocument());
});

test('creating a chat aborts its predecessor and late responses cannot cross conversations', async () => {
  const pending = deferred();
  axios.post.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(success({ assistant_message: 'Current answer' }));
  render(tree());
  send('Pending question');
  fireEvent.click(screen.getByRole('button', { name: 'Hide chat sidebar' }));
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  expect(screen.getByRole('button', { name: 'Show chat sidebar' })).toBeInTheDocument();
  expect(axios.post.mock.calls[0][2].signal.aborted).toBe(true);
  send('Current question');
  await screen.findByText('Current answer');
  await act(async () => pending.resolve(success({ assistant_message: 'Wrong conversation answer' })));
  expect(screen.queryByText('Wrong conversation answer')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your chats' })).getByRole('button', { name: 'Open chat: Pending question' }));
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('Pending question');
  expect(screen.queryByText('Current answer')).not.toBeInTheDocument();
});

test('reset confirms clearing the chat and leaves saved dashboard results intact', async () => {
  axios.post.mockResolvedValue(success());
  render(tree());
  send('Revenue overview');
  await screen.findByText('Revenue is 100.');
  fireEvent.click(screen.getByRole('button', { name: 'Open chart' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save to Dashboard' }));
  const dashboard = localStorage.getItem('chartStudioDashboard:v1');
  fireEvent.click(screen.getByRole('button', { name: 'Reset current chat' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset this chat?' })).getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Revenue is 100.')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Reset current chat' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset this chat?' })).getByRole('button', { name: 'Reset chat' }));
  expect(screen.queryByText('Revenue is 100.')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('');
  expect(localStorage.getItem('chartStudioDashboard:v1')).toBe(dashboard);
  send('Fresh analysis');
  await screen.findByText('Revenue is 100.');
  expect(axios.post.mock.calls[1][1].session_state).toEqual({ active_mode: 'explore' });
  expect(axios.post.mock.calls[1][1].conversation_history).toEqual([]);
});

test('answer mode is sent, attributed and retained per chat across reloads', async () => {
  axios.post.mockResolvedValue(success({ ai_commentary: 'Consider checking seasonality.',
    model_routing: { status: 'completed', selected_mode: 'deep', model: 'gpt-5-mini', reason: 'Selected by you.' } }));
  const view = render(tree());
  expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Deep analysis' }));
  send('Revenue explanation');
  expect(screen.getByRole('group', { name: 'Answer mode' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Quick' })).toBeDisabled();
  await screen.findByText('Consider checking seasonality.');
  expect(screen.getByRole('radio', { name: 'Quick' })).toBeEnabled();
  expect(axios.post.mock.calls[0][1].model_mode).toBe('deep');
  expect(screen.getByText('Deep analysis · gpt-5-mini')).toBeInTheDocument();
  expect(screen.getByText('Revenue is 100.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your chats' })).getByRole('button', { name: 'Open chat: Revenue explanation' }));
  expect(screen.getByRole('radio', { name: 'Deep analysis' })).toBeChecked();
  view.unmount();
  render(tree());
  expect(screen.getByRole('radio', { name: 'Deep analysis' })).toBeChecked();
  expect(screen.getByText('Deep analysis · gpt-5-mini')).toBeInTheDocument();
});

test('retry keeps the original model choice and unavailable commentary preserves results', async () => {
  axios.post.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(success({
    model_routing: { status: 'unavailable', selected_mode: 'quick', model: null,
      reason: 'AI explanation is temporarily unavailable. The built-in response is available.' },
  }));
  render(tree());
  fireEvent.click(screen.getByRole('radio', { name: 'Quick' }));
  send('Explain revenue');
  await screen.findByRole('button', { name: 'Retry last question' });
  fireEvent.click(screen.getByRole('radio', { name: 'Deep analysis' }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry last question' }));
  await screen.findByText('Revenue is 100.');
  expect(axios.post.mock.calls[1][1].model_mode).toBe('quick');
  expect(screen.getByText(/AI explanation is temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'AI explanation' })).not.toBeInTheDocument();
});

test('conversation titles can be renamed and the last chat can be safely deleted', async () => {
  render(tree());
  fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Your chats' })).getByRole('button', { name: 'Rename chat: New chat' }));
  const rename = screen.getByRole('dialog', { name: 'Rename chat' });
  fireEvent.change(within(rename).getByRole('textbox', { name: 'Chat name' }), { target: { value: 'Quarterly review' } });
  fireEvent.click(within(rename).getByRole('button', { name: 'Save name' }));
  const history = await screen.findByRole('dialog', { name: 'Your chats' });
  expect(within(history).getByRole('button', { name: 'Open chat: Quarterly review' })).toBeInTheDocument();
  fireEvent.click(within(history).getByRole('button', { name: 'Delete chat: Quarterly review' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete this chat?' })).getByRole('button', { name: 'Delete chat' }));
  expect(screen.queryByText('Quarterly review')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Reset current chat' })).toBeDisabled();
});

test('deleting an inactive chat preserves the active draft and persists the removal', async () => {
  render(tree());
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: 'First draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: 'Keep this draft' } });
  const chats = screen.getByRole('navigation', { name: 'Chat tools' });
  const deleteButtons = within(chats).getAllByRole('button', { name: 'Delete chat: New chat' });
  // The latest chat sorts first, so remove the other conversation.
  fireEvent.click(deleteButtons[1]);
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete this chat?' })).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this chat?' })).not.toBeInTheDocument());
  expect(within(chats).getAllByRole('button', { name: 'Delete chat: New chat' })).toHaveLength(2);
  fireEvent.click(within(chats).getAllByRole('button', { name: 'Delete chat: New chat' })[1]);
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete this chat?' })).getByRole('button', { name: 'Delete chat' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete this chat?' })).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('Keep this draft');
  expect(within(chats).getAllByRole('button', { name: 'Delete chat: New chat' })).toHaveLength(1);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)).conversations).toHaveLength(1));
});

test('chat dialogs belong to the same document as a popped-out chat', async () => {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const popupBody = frame.contentDocument.body;
  const container = frame.contentDocument.createElement('div');
  popupBody.appendChild(container);
  const view = render(tree(), { container, baseElement: popupBody });
  try {
    fireEvent.click(within(container).getByRole('button', { name: 'Show chat history' }));
    const history = await within(popupBody).findByRole('dialog', { name: 'Your chats' });
    fireEvent.click(within(history).getByRole('button', { name: 'Delete chat: New chat' }));
    const confirmation = within(popupBody).getByRole('dialog', { name: 'Delete this chat?' });
    expect(confirmation.ownerDocument).toBe(frame.contentDocument);
    expect(screen.queryByRole('dialog', { name: 'Delete this chat?' })).not.toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete chat' }));
    expect(within(container).getByRole('textbox', { name: 'Business question' })).toHaveValue('');
  } finally {
    view.unmount();
    frame.remove();
  }
});

test('history and unsent drafts survive remount without carrying unverifiable analytical state', async () => {
  axios.post.mockResolvedValue(success());
  const view = render(tree());
  send('Saved revenue analysis');
  await screen.findByText('Revenue is 100.');
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: 'Unsent question' } });
  view.unmount();
  expect(JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)).conversations[0].messages).toHaveLength(2);
  render(tree());
  expect(screen.getByText('Revenue is 100.')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Business question' })).toHaveValue('Unsent question');
  send('Fresh revenue question');
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].session_state).toEqual({ active_mode: 'explore' });
  expect(axios.post.mock.calls[1][1].conversation_history).toEqual([]);
  await waitFor(() => expect(screen.queryByText('Analyzing your data…')).not.toBeInTheDocument());
});

test('a chat-storage failure leaves conversation switching usable in memory', async () => {
  const original = Storage.prototype.setItem;
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === CHAT_STORAGE_KEY) throw new Error('quota');
    return original.call(this, key, value);
  });
  try {
    axios.post.mockResolvedValue(success());
    render(tree());
    send('Keep this conversation');
    await screen.findByText('Revenue is 100.');
    await screen.findByText(/Could not save chat history/);
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show chat history' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Your chats' })).getByRole('button', { name: 'Open chat: Keep this conversation' }));
    expect(screen.getByText('Revenue is 100.')).toBeInTheDocument();
  } finally { spy.mockRestore(); }
});
