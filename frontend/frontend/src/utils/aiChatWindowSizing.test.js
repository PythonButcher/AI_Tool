import { getAiChatWindowState, getAiChatPopupFeatures } from './aiChatWindowSizing';

test('opens generously on a large screen and migrates the old default', () => {
  const bounds = { width: 1920, height: 1080 };
  const state = getAiChatWindowState(bounds);
  expect(state.w).toBe(1600);
  expect(state.h).toBe(1037);
  expect(getAiChatWindowState(bounds, { isPixel: true, w: 1100, h: 800 })).toEqual(state);
});

test.each([{ width: 390, height: 640 }, { width: 1366, height: 650 }])('fits available space including an offscreen saved window: %j', bounds => {
  const state = getAiChatWindowState(bounds, { isPixel: true, w: 1800, h: 1000, x: 1700, y: -100 });
  expect(state.x).toBeGreaterThanOrEqual(0);
  expect(state.y).toBeGreaterThanOrEqual(0);
  expect(state.x + state.w).toBeLessThanOrEqual(bounds.width);
  expect(state.y + state.h).toBeLessThanOrEqual(bounds.height);
});

test('retains deliberate saved sizing and position when it fits', () => {
  const saved = { isPixel: true, x: 30, y: 40, w: 1400, h: 900 };
  expect(getAiChatWindowState({ width: 1920, height: 1080 }, saved)).toEqual(saved);
});

test('centers popout in the current monitor work area', () => {
  const features = getAiChatPopupFeatures({ availWidth: 1920, availHeight: 1080, availLeft: -1920, availTop: 0 });
  expect(features).toContain('width=1600');
  expect(features).toContain('left=-1760');
  expect(features).toContain('height=960');
});
