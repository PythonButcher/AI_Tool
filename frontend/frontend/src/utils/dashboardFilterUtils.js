export const createDefaultDashboardFilters = () => ({
  dateDimensionId: '',
  startDate: '',
  endDate: '',
  dimensionFilters: [],
});

const normalizeDimensionFilter = (filter, index) => ({
  id: filter?.id || `dashboard-filter-${index + 1}`,
  dimensionId: filter?.dimensionId || '',
  values: Array.isArray(filter?.values)
    ? filter.values.filter((value) => value !== null && value !== undefined && value !== '')
    : filter?.value !== null && filter?.value !== undefined && filter?.value !== ''
      ? [filter.value]
      : [],
});

export const normalizeDashboardFilters = (filters) => ({
  dateDimensionId: filters?.dateDimensionId || '',
  startDate: filters?.startDate || '',
  endDate: filters?.endDate || '',
  dimensionFilters: Array.isArray(filters?.dimensionFilters)
    ? filters.dimensionFilters.map(normalizeDimensionFilter)
    : [],
});

const normalizeString = (value) => String(value ?? '').trim().toLowerCase();

const findDimension = (semanticModel, reference) => {
  const normalizedReference = normalizeString(reference);
  if (!normalizedReference) return null;

  return (semanticModel?.dimensions || []).find((dimension) => {
    return [dimension?.id, dimension?.name, dimension?.label, dimension?.field]
      .filter(Boolean)
      .some((candidate) => normalizeString(candidate) === normalizedReference);
  }) || null;
};

const resolveDimensionField = (semanticModel, reference) => {
  const dimension = findDimension(semanticModel, reference);
  if (dimension?.field) return dimension.field;
  return typeof reference === 'string' ? reference : '';
};

const isTemporalDimension = (dimension) => {
  const semanticKind = normalizeString(dimension?.semantic_kind);
  const dataType = normalizeString(dimension?.data_type);
  return semanticKind === 'temporal' || dataType === 'datetime' || dataType === 'date';
};

const toDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeComparableValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const endOfDayIso = (value) => {
  if (!value) return '';
  if (String(value).includes('T')) return value;
  return `${value}T23:59:59`;
};

export const getTemporalDimensions = (semanticModel) =>
  (semanticModel?.dimensions || []).filter(isTemporalDimension);

export const getFilterableDimensions = (semanticModel) =>
  (semanticModel?.dimensions || []).filter((dimension) => !isTemporalDimension(dimension));

export const getDimensionValues = (rows, semanticModel, dimensionId) => {
  const field = resolveDimensionField(semanticModel, dimensionId);
  if (!field || !Array.isArray(rows)) return [];

  return [...new Set(rows
    .map((row) => row?.[field])
    .filter((value) => value !== null && value !== undefined && value !== ''))]
    .slice(0, 100)
    .map((value) => ({
      label: String(value),
      value: String(value),
    }));
};

export const buildResolverFilters = (dashboardFilters, semanticModel) => {
  const filters = normalizeDashboardFilters(dashboardFilters);
  const resolverFilters = [];

  if (filters.dateDimensionId && filters.startDate) {
    resolverFilters.push({
      dimension_id: filters.dateDimensionId,
      operator: 'gte',
      value: filters.startDate,
    });
  }

  if (filters.dateDimensionId && filters.endDate) {
    resolverFilters.push({
      dimension_id: filters.dateDimensionId,
      operator: 'lte',
      value: endOfDayIso(filters.endDate),
    });
  }

  filters.dimensionFilters.forEach((filter) => {
    if (!filter.dimensionId || filter.values.length === 0) {
      return;
    }

    if (filter.values.length === 1) {
      resolverFilters.push({
        dimension_id: filter.dimensionId,
        operator: 'eq',
        value: filter.values[0],
      });
      return;
    }

    resolverFilters.push({
      dimension_id: filter.dimensionId,
      operator: 'in',
      values: filter.values,
    });
  });

  return resolverFilters;
};

export const applyDashboardFiltersToRows = (rows, dashboardFilters, semanticModel) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const filters = normalizeDashboardFilters(dashboardFilters);
  const startDate = toDateValue(filters.startDate);
  const endDate = toDateValue(filters.endDate);
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  return rows.filter((row) => {
    if (filters.dateDimensionId) {
      const field = resolveDimensionField(semanticModel, filters.dateDimensionId);
      const rowDate = toDateValue(row?.[field]);
      if ((startDate || endDate) && !rowDate) {
        return false;
      }
      if (startDate && rowDate < startDate) {
        return false;
      }
      if (endDate && rowDate > endDate) {
        return false;
      }
    }

    for (const filter of filters.dimensionFilters) {
      if (!filter.dimensionId || filter.values.length === 0) {
        continue;
      }

      const field = resolveDimensionField(semanticModel, filter.dimensionId);
      const rowValue = normalizeComparableValue(row?.[field]);
      const acceptedValues = filter.values.map(normalizeComparableValue);
      if (!acceptedValues.includes(rowValue)) {
        return false;
      }
    }

    return true;
  });
};

export const buildPreviousPeriodFilters = (dashboardFilters) => {
  const filters = normalizeDashboardFilters(dashboardFilters);
  if (!filters.dateDimensionId || !filters.startDate || !filters.endDate) {
    return null;
  }

  const start = toDateValue(filters.startDate);
  const end = toDateValue(filters.endDate);
  if (!start || !end) {
    return null;
  }

  const daySpan = Math.max(Math.round((end.getTime() - start.getTime()) / 86400000), 0);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - daySpan);

  return {
    ...filters,
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
};

export const countActiveDashboardFilters = (dashboardFilters) => {
  const filters = normalizeDashboardFilters(dashboardFilters);
  let count = 0;
  if (filters.dateDimensionId && (filters.startDate || filters.endDate)) {
    count += 1;
  }
  count += filters.dimensionFilters.filter((filter) => filter.dimensionId && filter.values.length > 0).length;
  return count;
};

export const getSlicerConflict = (dashboardFilters, chartSlicers) => {
  if (!dashboardFilters || !chartSlicers || chartSlicers.length === 0) return null;

  const filters = normalizeDashboardFilters(dashboardFilters);
  
  for (const chartSlicer of chartSlicers) {
    if (!chartSlicer.dimensionId || !chartSlicer.values || chartSlicer.values.length === 0) continue;
    
    // Find matching dashboard filter for this dimension
    const dashFilter = filters.dimensionFilters.find(f => f.dimensionId === chartSlicer.dimensionId);
    if (dashFilter && dashFilter.values.length > 0) {
      // Check intersection
      const chartVals = chartSlicer.values.map(normalizeComparableValue);
      const dashVals = dashFilter.values.map(normalizeComparableValue);
      
      const intersection = chartVals.filter(v => dashVals.includes(v));
      if (intersection.length === 0) {
        return chartSlicer.dimensionId; // Conflict found on this dimension
      }
    }
  }
  
  return null;
};
