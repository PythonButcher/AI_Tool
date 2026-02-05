export const DEFAULT_GRID_COLS = 10;
const DEFAULT_ROW_STEP = 2;
const DEFAULT_COL_STEP = 1;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeDimensions = (layout, cols) => {
  const normalized = { ...layout };
  const maxWidth = cols || DEFAULT_GRID_COLS;
  normalized.w = clamp(normalized.w, normalized.minW || 1, normalized.maxW || maxWidth);
  normalized.h = clamp(normalized.h, normalized.minH || 1, normalized.maxH || normalized.h);
  normalized.x = clamp(normalized.x, 0, Math.max(0, maxWidth - normalized.w));
  normalized.y = Math.max(0, normalized.y);
  return normalized;
};

const buildCascadePosition = ({ index, cols, w, rowStep, colStep }) => {
  const usableCols = Math.max(1, cols - w + 1);
  const columnsPerRow = Math.max(1, Math.floor(usableCols / colStep));
  const columnIndex = index % columnsPerRow;
  const rowIndex = Math.floor(index / columnsPerRow);
  return {
    x: clamp(columnIndex * colStep, 0, usableCols - 1),
    y: rowIndex * rowStep,
  };
};

const buildGridPosition = ({ index, cols, w, h, rowStep }) => {
  const usableCols = Math.max(1, cols - w + 1);
  const columnIndex = index % usableCols;
  const rowIndex = Math.floor(index / usableCols);
  return {
    x: columnIndex,
    y: rowIndex * Math.max(1, Math.round(h / 2) || rowStep),
  };
};

export const resolveWindowLayout = ({
  savedLayout,
  fallbackLayout,
  placementIndex,
  cols = DEFAULT_GRID_COLS,
  mode = 'cascade',
  rowStep = DEFAULT_ROW_STEP,
  colStep = DEFAULT_COL_STEP,
}) => {
  if (savedLayout) {
    const merged = { ...fallbackLayout, ...savedLayout };
    return normalizeDimensions(merged, cols);
  }

  const base = normalizeDimensions({ ...fallbackLayout, x: 0, y: 0 }, cols);
  const anchorX = fallbackLayout?.x || 0;
  const anchorY = fallbackLayout?.y || 0;
  const position =
    mode === 'grid'
      ? buildGridPosition({
        index: placementIndex,
        cols,
        w: base.w,
        h: base.h,
        rowStep,
      })
      : buildCascadePosition({
        index: placementIndex,
        cols,
        w: base.w,
        rowStep,
        colStep,
      });

  return normalizeDimensions(
    {
      ...base,
      x: position.x + anchorX,
      y: position.y + anchorY,
    },
    cols
  );
};

export const clampLayoutToGrid = (layout, cols = DEFAULT_GRID_COLS) =>
  normalizeDimensions(layout, cols);
