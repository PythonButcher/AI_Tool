import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import AiChatDock from './AiChatDock';

jest.mock('./AIShell', () => function MockChat({ windowActions }) {
  const { useState } = require('react');
  const [draft, setDraft] = useState('');
  return <>{windowActions}<input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /></>;
});

beforeEach(() => {
  localStorage.clear();
  jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.ResizeObserver;
});

test('expansion and collapse preserve the draft and the chosen dock width', () => {
  const props = { onMinimize: jest.fn() };
  const { rerender } = render(<AiChatDock {...props} />);
  const draft = screen.getByRole('textbox', { name: 'Draft' });
  fireEvent.change(draft, { target: { value: 'Revenue by region' } });
  const divider = screen.getByRole('separator', { name: 'Resize AI Chat' });
  fireEvent.keyDown(divider, { key: 'End' });
  expect(divider).toHaveAttribute('aria-valuenow', '780');
  expect(localStorage.getItem('ai-tool.chat-dock-width')).toBe('780');
  fireEvent.click(screen.getByRole('button', { name: 'Expand AI Chat' }));
  expect(screen.queryByRole('separator')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Restore sidebar width' }));
  expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '780');
  fireEvent.click(screen.getByRole('button', { name: 'Collapse AI Chat' }));
  expect(props.onMinimize).toHaveBeenCalledTimes(1);
  rerender(<AiChatDock {...props} minimized />);
  expect(screen.queryByRole('textbox')).toBeNull();
  rerender(<AiChatDock {...props} />);
  expect(screen.getByRole('textbox')).toBe(draft);
  expect(draft).toHaveValue('Revenue by region');
});

test('dragging the divider adjusts the width and saves it when released', () => {
  render(<AiChatDock />);
  const divider = screen.getByRole('separator');
  divider.setPointerCapture = jest.fn();
  const pointer = (type, clientX) => {
    const event = new MouseEvent(type, { bubbles: true, clientX, button: 0 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(divider, event);
  };
  pointer('pointerdown', 660);
  expect(divider.setPointerCapture).toHaveBeenCalledWith(1);
  pointer('pointermove', 600);
  expect(divider).toHaveAttribute('aria-valuenow', '600');
  pointer('lostpointercapture', 600);
  expect(localStorage.getItem('ai-tool.chat-dock-width')).toBe('600');
});

test('pop-out and native window close retain the mounted conversation', () => {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const popup = { document: frame.contentDocument, focus: jest.fn(), close: jest.fn(), closed: false };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  jest.useFakeTimers();
  try {
    const { unmount } = render(<AiChatDock />);
    const draft = screen.getByRole('textbox');
    fireEvent.change(draft, { target: { value: 'Original draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open AI Chat in separate window' }));
    const separateWindow = within(popup.document.body);
    expect(separateWindow.getByRole('textbox')).toBe(draft);
    fireEvent.change(draft, { target: { value: 'Edited in the pop-out' } });
    fireEvent.click(separateWindow.getByRole('button', { name: 'Dock AI Chat in app' }));
    expect(popup.close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox')).toHaveValue('Edited in the pop-out');

    fireEvent.click(screen.getByRole('button', { name: 'Open AI Chat in separate window' }));
    popup.closed = true;
    act(() => jest.advanceTimersByTime(250));
    expect(screen.getByRole('textbox')).toBe(draft);
    unmount();
  } finally {
    frame.remove();
    jest.useRealTimers();
  }
});
