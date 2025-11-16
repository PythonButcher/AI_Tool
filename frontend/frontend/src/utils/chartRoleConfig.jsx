// chartRoleConfig.js
const CATEGORY_TYPES = ['categorical', 'temporal'];
const VALUE_TYPES = ['numeric'];

export const chartRoles = {
  Bar: [
    {
      role: 'X-Axis',
      axis: 'x',
      allowedTypes: CATEGORY_TYPES,
      helperText: 'Drag a grouping or category field',
    },
    {
      role: 'Y-Axis',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Drop a numeric measure to determine bar height',
    },
  ],
  Line: [
    {
      role: 'X-Axis',
      axis: 'x',
      allowedTypes: CATEGORY_TYPES,
      helperText: 'Usually a time or sequence field',
    },
    {
      role: 'Y-Axis',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Numeric values plotted over the sequence',
    },
  ],
  Scatter: [
    {
      role: 'X-Axis',
      axis: 'x',
      allowedTypes: VALUE_TYPES,
      helperText: 'Numeric field for horizontal placement',
    },
    {
      role: 'Y-Axis',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Numeric field for vertical placement',
    },
  ],
  Pie: [
    {
      role: 'Category',
      axis: 'x',
      allowedTypes: CATEGORY_TYPES,
      helperText: 'Label for each slice',
    },
    {
      role: 'Value',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Total size of each slice',
    },
  ],
  Doughnut: [
    {
      role: 'Category',
      axis: 'x',
      allowedTypes: CATEGORY_TYPES,
      helperText: 'Label for each ring segment',
    },
    {
      role: 'Value',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Numeric size of the segment',
    },
  ],
  KPI: [
    {
      role: 'Value',
      axis: 'y',
      allowedTypes: VALUE_TYPES,
      helperText: 'Metric to highlight',
    },
  ],
};

// Legacy accessor for components that may expect a string array
export const getRoleLabels = (chartType) => chartRoles[chartType]?.map((role) => role.role) || [];
