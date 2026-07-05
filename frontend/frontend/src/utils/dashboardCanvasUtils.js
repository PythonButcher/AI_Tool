export const createDefaultDashboardCanvasSettings = () => ({
  columns: 12,
  rowHeight: 40,
  margin: [16, 16],
  containerPadding: [16, 16],
  compactType: null, // Allow flexible authoring, no auto-packing
  preventCollision: false,
  layoutVersion: 1,
});

export const createDefaultDashboardSharingSkeleton = () => ({
  enabled: false,
  status: 'local_draft',
  ownerLabel: '',
  visibility: 'private_local',
  intendedRecipients: [],
  teamPlaceholders: [],
  shareNotes: '',
  lastPreparedAt: null,
  authRequired: true,
  backendConnected: false,
});

const DEFAULT_CHART_W = 6;
const DEFAULT_CHART_H = 8;
const MIN_CHART_W = 3;
const MIN_CHART_H = 5;

const DEFAULT_KPI_W = 3;
const DEFAULT_KPI_H = 4;
const MIN_KPI_W = 2;
const MIN_KPI_H = 3;

/**
 * Normalizes item layout or generates a deterministic fallback
 */
export const normalizeDashboardItemLayout = (layout, index, itemType, cols = 12) => {
  if (layout && typeof layout.x === 'number' && typeof layout.y === 'number') {
    return {
      x: layout.x,
      y: layout.y,
      w: layout.w || (itemType === 'kpi' ? DEFAULT_KPI_W : DEFAULT_CHART_W),
      h: layout.h || (itemType === 'kpi' ? DEFAULT_KPI_H : DEFAULT_CHART_H),
      minW: layout.minW || (itemType === 'kpi' ? MIN_KPI_W : MIN_CHART_W),
      minH: layout.minH || (itemType === 'kpi' ? MIN_KPI_H : MIN_CHART_H),
      maxW: layout.maxW,
      maxH: layout.maxH,
      static: layout.static || false,
    };
  }

  // Generate deterministic default placement
  const w = itemType === 'kpi' ? DEFAULT_KPI_W : DEFAULT_CHART_W;
  const h = itemType === 'kpi' ? DEFAULT_KPI_H : DEFAULT_CHART_H;
  const itemsPerRow = Math.floor(cols / w);
  const row = Math.floor(index / itemsPerRow);
  const col = index % itemsPerRow;

  return {
    x: col * w,
    y: row * 10,
    w,
    h,
    minW: itemType === 'kpi' ? MIN_KPI_W : MIN_CHART_W,
    minH: itemType === 'kpi' ? MIN_KPI_H : MIN_CHART_H,
    static: false,
  };
};

export const normalizeDashboardItemDisplay = (display) => ({
  showHeader: display?.showHeader !== false,
  compact: display?.compact === true,
  showLegend: display?.showLegend ?? null,
  accent: display?.accent || null,
  paletteId: display?.paletteId || 'default',
  seriesColors: display?.seriesColors || {},
  customColors: display?.customColors || [],
});

export const normalizeDashboardItemSourceMetadata = (metadata) => ({
  sourceSurface: metadata?.sourceSurface || 'unknown',
  sourceMode: metadata?.sourceMode || 'unknown',
  sourceArtifactId: metadata?.sourceArtifactId || null,
  datasetName: metadata?.datasetName || null,
  createdByLabel: metadata?.createdByLabel || null,
});
