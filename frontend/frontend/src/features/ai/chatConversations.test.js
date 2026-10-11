import { CHAT_STORAGE_KEY, createConversation, loadChatWorkspace, restoreConversation, serializeChatWorkspace } from './chatConversations';

beforeEach(() => localStorage.clear());

test('stored transcripts keep grounded artifacts but never serialize runtime dataset rows', () => {
  const scope = { fullData: [{ secret_raw_row: 'private source row' }], semanticModel: { metrics: [] } };
  const artifact = { type: 'chart', scope, bi_grounding: { metric_definition: { id: 'revenue' } }, content: { chartData: { labels: ['East'] } } };
  const chat = { ...createConversation(), sourceScope: scope, sessionState: { analytics_state: { metric_id: 'revenue' } },
    messages: [{ role: 'assistant', content: 'Verified result', scope, artifacts: [artifact], dashboard_draft: { items: [{ artifact }] } }], activeArtifact: artifact };
  const saved = serializeChatWorkspace({ activeId: chat.id, conversations: [chat] });
  expect(saved).not.toContain('secret_raw_row');
  expect(saved).not.toContain('analytics_state');
  localStorage.setItem(CHAT_STORAGE_KEY, saved);
  const loaded = loadChatWorkspace().workspace.conversations[0];
  const restored = restoreConversation(loaded, scope);
  expect(restored.messages[0].artifacts[0].bi_grounding.metric_definition.id).toBe('revenue');
  expect(restored.messages[0].scope).toBeNull();
  expect(restored.sessionState).toEqual({ active_mode: 'explore' });
});

test('in-memory analytical context resumes only with the identical source references', () => {
  const scope = { workspaceId: 'ws', version: 1, semanticModel: {}, fullData: [{ Revenue: 100 }] };
  const chat = { ...createConversation(), sourceScope: scope, sessionState: { analytics_state: { metric_id: 'revenue' } },
    messages: [{ role: 'user', content: 'Revenue', scope }] };
  expect(restoreConversation(chat, { ...scope }).sessionState.analytics_state.metric_id).toBe('revenue');
  expect(restoreConversation(chat, { ...scope, fullData: [{ Revenue: 200 }] }).sessionState).toEqual({ active_mode: 'explore' });
});

test('malformed saved history remains untouched and does not prevent an in-memory chat', () => {
  localStorage.setItem(CHAT_STORAGE_KEY, '{broken');
  const loaded = loadChatWorkspace();
  expect(loaded.persistenceBlocked).toBe(true);
  expect(loaded.workspace.conversations).toHaveLength(1);
  expect(localStorage.getItem(CHAT_STORAGE_KEY)).toBe('{broken');
});
