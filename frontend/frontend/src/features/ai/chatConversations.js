export const CHAT_STORAGE_KEY = 'aiChatConversations:v1';
export const normalizeModelMode = value => ['auto', 'quick', 'deep'].includes(value) ? value : 'auto';

export const createConversation = () => {
  const now = new Date().toISOString();
  return {
    id: window.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: 'New chat', customTitle: false, createdAt: now, updatedAt: now,
    messages: [], draft: '', modelMode: 'auto', sessionState: { active_mode: 'explore' },
  };
};

// Object identity is deliberately used for inline rows/model data. A persisted
// transcript cannot prove that the data selected after a reload is unchanged.
export const sameChatScope = (left, right) => Boolean(left && right)
  && ['workspaceId', 'version', 'semanticModel', 'cleanedData', 'fullData']
    .every(key => left[key] === right[key]);

const mapMessageArtifacts = (message, mapArtifact) => ({
  ...message,
  artifacts: Array.isArray(message.artifacts) ? message.artifacts.map(mapArtifact) : [],
  dashboard_draft: message.dashboard_draft ? {
    ...message.dashboard_draft,
    items: message.dashboard_draft.items.map(item => ({
      ...item, ...(item.artifact ? { artifact: mapArtifact(item.artifact) } : {}),
    })),
  } : null,
});

export const restoreConversation = (conversation, scope) => {
  const canResume = sameChatScope(conversation.sourceScope, scope);
  const bindArtifact = artifact => ({ ...artifact, scope: sameChatScope(artifact.scope, scope) ? scope : null });
  return {
    messages: conversation.messages.map(message => ({
      ...mapMessageArtifacts(message, bindArtifact),
      scope: sameChatScope(message.scope, scope) ? scope : null,
    })),
    draft: conversation.draft || '',
    modelMode: normalizeModelMode(conversation.modelMode),
    sessionState: canResume ? conversation.sessionState : { active_mode: 'explore' },
    activeArtifact: conversation.activeArtifact ? bindArtifact(conversation.activeArtifact) : null,
    awaitingCleanInstructions: canResume && Boolean(conversation.awaitingCleanInstructions),
    failedRequest: canResume && conversation.failedRequest ? { ...conversation.failedRequest, scope } : null,
    error: canResume ? conversation.error : null,
    governanceWarning: canResume ? conversation.governanceWarning : null,
    notice: canResume ? conversation.notice : conversation.messages.length
      ? 'Saved conversation restored. New questions use your currently selected data; run an analysis to enable its follow-ups.' : null,
  };
};

export const updateConversation = (conversation, snapshot) => {
  const firstQuestion = snapshot.messages.find(message => message.role === 'user')?.content;
  return {
    ...conversation, ...snapshot,
    title: conversation.customTitle || !firstQuestion ? conversation.title
      : firstQuestion.replace(/\s+/g, ' ').trim().slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
};

const withoutScope = ({ scope, ...value }) => value;
const persistedMessage = ({ scope, session_state, ...value }) => mapMessageArtifacts(value, withoutScope);

export const serializeChatWorkspace = workspace => JSON.stringify({
  schema_version: 1,
  activeId: workspace.activeId,
  conversations: workspace.conversations.map(conversation => ({
    id: conversation.id, title: conversation.title, customTitle: conversation.customTitle,
    createdAt: conversation.createdAt, updatedAt: conversation.updatedAt,
    draft: conversation.draft,
    modelMode: normalizeModelMode(conversation.modelMode),
    messages: conversation.messages.map(persistedMessage),
    activeArtifact: conversation.activeArtifact ? withoutScope(conversation.activeArtifact) : null,
    // Analytical state is retained only in memory, where its source can be proven.
  })),
});

export const loadChatWorkspace = () => {
  const fresh = createConversation();
  const empty = { activeId: fresh.id, conversations: [fresh] };
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { workspace: empty, error: null, persistenceBlocked: false };
    const saved = JSON.parse(raw);
    if (saved.schema_version !== 1 || !Array.isArray(saved.conversations) || !saved.conversations.length) {
      throw new Error('Invalid chat collection');
    }
    const ids = new Set();
    const conversations = saved.conversations.map(value => {
      if (!value || typeof value.id !== 'string' || !value.id || ids.has(value.id)
        || typeof value.title !== 'string' || !Array.isArray(value.messages)
        || value.messages.some(message => !message || !['user', 'assistant'].includes(message.role)
          || typeof message.content !== 'string'
          || (message.dashboard_draft && !Array.isArray(message.dashboard_draft.items)))) {
        throw new Error('Invalid saved conversation');
      }
      ids.add(value.id);
      return {
        id: value.id, title: value.title.trim().slice(0, 80) || 'New chat',
        customTitle: Boolean(value.customTitle),
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : fresh.createdAt,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fresh.updatedAt,
        draft: typeof value.draft === 'string' ? value.draft : '',
        modelMode: normalizeModelMode(value.modelMode),
        messages: value.messages.map(persistedMessage),
        activeArtifact: value.activeArtifact ? withoutScope(value.activeArtifact) : null,
        sourceScope: null, sessionState: { active_mode: 'explore' },
      };
    });
    return { workspace: { conversations, activeId: ids.has(saved.activeId) ? saved.activeId : conversations[0].id }, error: null, persistenceBlocked: false };
  } catch {
    // Preserve the unreadable value rather than silently overwriting recoverable work.
    return { workspace: empty, error: 'Saved chat history is unavailable. You can still chat in this window.', persistenceBlocked: true };
  }
};
