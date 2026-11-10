/** Keep chat spacious without pushing its title bar or composer off screen. */
export function getAiChatWindowState(bounds, saved) {
  const availableWidth = Math.max(1, bounds.width);
  const availableHeight = Math.max(1, bounds.height);
  const gutter = availableWidth < 600 || availableHeight < 500 ? 0 : 16;
  const maxW = Math.max(1, availableWidth - gutter * 2);
  const maxH = Math.max(1, availableHeight - gutter * 2);
  const defaultW = Math.min(1600, Math.round(availableWidth * 0.96), maxW);
  const defaultH = Math.min(1040, Math.round(availableHeight * 0.96), maxH);
  // Migrate the old opening default, while retaining deliberate user resizing.
  const usableSaved = saved?.isPixel && Number.isFinite(saved.w) && Number.isFinite(saved.h)
    && !(saved.w === 1100 && saved.h === 800);
  const w = Math.min(maxW, Math.max(Math.min(800, maxW), usableSaved ? saved.w : defaultW));
  const h = Math.min(maxH, Math.max(Math.min(500, maxH), usableSaved ? saved.h : defaultH));
  const clampPosition = (value, size, available) => Math.max(gutter, Math.min(
    Number.isFinite(value) ? value : Math.round((available - size) / 2), available - size - gutter
  ));
  return {
    x: clampPosition(usableSaved ? saved.x : undefined, w, availableWidth),
    y: clampPosition(usableSaved ? saved.y : undefined, h, availableHeight),
    w, h, isPixel: true,
  };
}

export function getAiChatPopupFeatures(screen) {
  // Leave room for browser chrome and the operating system's work area.
  const state = getAiChatWindowState({ width: screen.availWidth, height: Math.max(1, screen.availHeight - 80) });
  const left = (screen.availLeft || 0) + state.x;
  const top = (screen.availTop || 0) + state.y;
  return `popup=yes,width=${state.w},height=${state.h},left=${left},top=${top},resizable=yes,scrollbars=no`;
}
