import React from 'react';
import { FaRobot } from "react-icons/fa";
import './AIChat.css';

/**
 * AIChat (Shortcut Button)
 * 
 * In DI 2.0 Phase 1, the floating chat panel is replaced by a dedicated 
 * AIShell destination. This component remains as a globally accessible 
 * shortcut button to jump to that destination.
 */
function AIChat({ onOpenAiChat }) {
  const handleClick = () => {
    if (onOpenAiChat) onOpenAiChat();
  };

  return (
    <div
      className="chat-icon"
      onClick={handleClick}
      data-tooltip="AI Analysis Suite"
      title="Open AI Analysis"
    >
      <FaRobot size={30} />
    </div>
  );
}

export default AIChat;
