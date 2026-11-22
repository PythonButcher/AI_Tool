export const WORKBENCH_LAYOUT_KEY = 'analytics:workbench-layout:v1';
export const WORKBENCH_COLUMNS = 24;
export const WORKBENCH_ROWS = 128;
export const WORKBENCH_MIN_HEIGHT = 8;
export const WORKBENCH_MAX_HEIGHT = 34;

export const WORKBENCH_PANELS = [
  { id: 'fields', title: 'Fields', minWidth: 4 },
  { id: 'builder', title: 'Visual Builder', minWidth: 6 },
  { id: 'results', title: 'Results', minWidth: 7 },
];

const DEFAULT_LAYOUT = [
  { i: 'fields', x: 0, y: 0, w: 4, h: 20, locked: false },
  { i: 'builder', x: 4, y: 0, w: 6, h: 20, locked: false },
  { i: 'results', x: 10, y: 0, w: 14, h: 20, locked: false },
];

export const defaultWorkbenchLayout = () => DEFAULT_LAYOUT.map(item => ({ ...item }));

const touches = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const fits = (item, minWidth) =>
  [item.x, item.y, item.w, item.h].every(Number.isInteger) &&
  item.x >= 0 && item.x + item.w <= WORKBENCH_COLUMNS &&
  item.w >= minWidth && item.y >= 0 && item.y + item.h <= WORKBENCH_ROWS &&
  item.h >= WORKBENCH_MIN_HEIGHT && item.h <= WORKBENCH_MAX_HEIGHT;

const validLayout = layout => layout.every((item, index) => item && fits(item, WORKBENCH_PANELS[index].minWidth) &&
  typeof item.locked === 'boolean' && layout.slice(0, index).every(other => !touches(item, other)));

export function readWorkbenchLayout() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(WORKBENCH_LAYOUT_KEY));
    if (!Array.isArray(saved) || saved.length !== WORKBENCH_PANELS.length) return defaultWorkbenchLayout();
    const layout = WORKBENCH_PANELS.map(panel => saved.find(item => item?.i === panel.id));
    if (!validLayout(layout)) return defaultWorkbenchLayout();
    return layout.map(({ i, x, y, w, h, locked }) => ({ i, x, y, w, h, locked }));
  } catch {
    return defaultWorkbenchLayout();
  }
}

export const workbenchOrder = (a, b) => (a.y - b.y) || (a.x - b.x);

export function applyWorkbenchGrid(current, grid) {
  // Grid bounds and collision handling come from React Grid Layout. Only the
  // geometry is copied back so transient drag state and locks stay independent.
  const next = current.map(item => {
    const position = grid.find(entry => entry.i === item.i);
    if (item.locked || !position) return item;
    const { x, y, w, h } = position;
    return { ...item, x, y, w, h };
  });
  return validLayout(next) ? next : current;
}

export function nudgeWorkbenchPanel(layout, id, dx, dy, resize) {
  const item = layout.find(panel => panel.i === id);
  if (!item || item.locked) return null;
  const target = resize ? { ...item, w: item.w + dx, h: item.h + dy } : { ...item, x: item.x + dx, y: item.y + dy };
  const next = layout.map(panel => panel.i === id ? target : panel);
  return validLayout(next) ? next : null;
}
