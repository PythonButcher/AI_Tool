import React from 'react';
import { FaCommentAlt, FaEdit, FaTrashAlt } from 'react-icons/fa';

export default function ChatHistory({ conversations, activeId, onSelect, onRename, onDelete }) {
  return (
    <div className="ai-shell__chat-list" aria-label="Saved conversations">
      {[...conversations].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map(chat => (
        <div key={chat.id} className={`ai-shell__chat-list-row ${chat.id === activeId ? 'is-current' : ''}`}>
          <button type="button" className="ai-shell__chat-select" aria-label={`Open chat: ${chat.title}`}
            aria-current={chat.id === activeId ? 'true' : undefined} onClick={() => onSelect(chat.id)}>
            <FaCommentAlt /><span>{chat.title}</span>
          </button>
          <div className="ai-shell__chat-row-actions">
            <button type="button" aria-label={`Rename chat: ${chat.title}`} onClick={() => onRename(chat)}><FaEdit /></button>
            <button type="button" aria-label={`Delete chat: ${chat.title}`} onClick={() => onDelete(chat)}><FaTrashAlt /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
