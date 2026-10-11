import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_STORAGE_KEY, createConversation, loadChatWorkspace, serializeChatWorkspace, updateConversation } from './chatConversations';

export default function useChatConversations() {
  const [initial] = useState(loadChatWorkspace);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [storageError, setStorageError] = useState(initial.error);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    if (initial.persistenceBlocked) return undefined;
    const save = () => {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, serializeChatWorkspace(workspaceRef.current));
        setStorageError(null);
      } catch {
        setStorageError('Could not save chat history on this device. Your chats remain available in this window.');
      }
    };
    const timer = window.setTimeout(save, 250);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [workspace, initial.persistenceBlocked]);

  useEffect(() => () => {
    if (!initial.persistenceBlocked) {
      try { localStorage.setItem(CHAT_STORAGE_KEY, serializeChatWorkspace(workspaceRef.current)); } catch { /* In-memory chats are preserved while mounted. */ }
    }
  }, [initial.persistenceBlocked]);

  const saveActive = useCallback((id, snapshot) => {
    setWorkspace(current => ({ ...current, conversations: current.conversations.map(chat =>
      chat.id === id ? updateConversation(chat, snapshot) : chat) }));
  }, []);

  const newChat = useCallback((snapshot, fromId) => {
    const next = createConversation();
    setWorkspace(current => current.activeId !== fromId ? current : ({
      activeId: next.id,
      conversations: [...current.conversations.map(chat => chat.id === current.activeId ? updateConversation(chat, snapshot) : chat), next],
    }));
  }, []);

  const selectChat = useCallback((id, snapshot, fromId) => {
    setWorkspace(current => current.activeId === fromId && current.conversations.some(chat => chat.id === id) ? {
      activeId: id,
      conversations: current.conversations.map(chat => chat.id === current.activeId ? updateConversation(chat, snapshot) : chat),
    } : current);
  }, []);

  const renameChat = useCallback((id, title) => {
    const trimmed = title.trim().slice(0, 80);
    if (!trimmed) return;
    setWorkspace(current => ({ ...current, conversations: current.conversations.map(chat =>
      chat.id === id ? { ...chat, title: trimmed, customTitle: true } : chat) }));
  }, []);

  const deleteChat = useCallback(id => {
    setWorkspace(current => {
      let conversations = current.conversations.filter(chat => chat.id !== id);
      if (!conversations.length) conversations = [createConversation()];
      return { conversations, activeId: current.activeId === id ? conversations[0].id : current.activeId };
    });
  }, []);

  const resetChat = useCallback(() => {
    const next = createConversation();
    setWorkspace(current => ({ activeId: next.id, conversations: current.conversations.map(chat => chat.id === current.activeId ? next : chat) }));
  }, []);

  return { ...workspace, storageError, saveActive, newChat, selectChat, renameChat, deleteChat, resetChat };
}
