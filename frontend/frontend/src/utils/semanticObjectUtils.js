const normalizeSemanticType = (value) => {
  const lowered = String(value || '').trim().toLowerCase();
  if (lowered === 'temporal' || lowered === 'datetime' || lowered === 'date') {
    return 'temporal';
  }
  return lowered === 'numeric' || lowered === 'number' ? 'numeric' : 'categorical';
};

const buildSemanticSearchText = (item) => [
  item.label,
  item.name,
  item.display_name,
  item.field,
  item.description,
  item.default_aggregation,
  item.semantic_kind,
  item.data_type,
  item.format_hint,
  item.status,
  item.expression?.formula,
]
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

const formatSemanticStatusLabel = (item) => {
  if (item?.is_user_defined || item?.status === 'user_defined') return 'Custom';
  if (item?.is_inferred || item?.status === 'inferred') return 'Inferred';
  return 'Semantic';
};

const formatDefinitionLabel = (metric) => {
  const definitionType = metric?.expression?.type || metric?.definition_kind;
  if (definitionType === 'derived_formula') return 'Formula';
  if (definitionType === 'count_rows') return 'Row count';
  return 'Aggregate';
};

export const normalizeSemanticMetric = (metric) => ({
  ...metric,
  id: metric?.id || metric?.name || metric?.field || 'semantic_metric',
  label: metric?.label || metric?.name || metric?.field || 'Unnamed metric',
  field: metric?.field || metric?.name || '',
  fieldType: 'numeric',
  objectKind: 'metric',
  semanticType: 'metric',
  statusLabel: formatSemanticStatusLabel(metric),
  definitionLabel: formatDefinitionLabel(metric),
  isEditable: Boolean(metric?.is_user_defined),
  helperLabel: metric?.expression?.type === 'derived_formula'
    ? `formula · ${metric?.default_aggregation || metric?.expression?.aggregation || 'sum'}`
    : (metric?.default_aggregation || metric?.expression?.aggregation || 'metric'),
  searchText: buildSemanticSearchText(metric || {}),
});

export const normalizeSemanticDimension = (dimension) => ({
  ...dimension,
  id: dimension?.id || dimension?.name || dimension?.field || 'semantic_dimension',
  label: dimension?.label || dimension?.name || dimension?.field || 'Unnamed dimension',
  field: dimension?.field || dimension?.name || '',
  fieldType: normalizeSemanticType(dimension?.semantic_kind || dimension?.data_type),
  objectKind: 'dimension',
  semanticType: 'dimension',
  statusLabel: formatSemanticStatusLabel(dimension),
  definitionLabel: 'Dimension',
  isEditable: false,
  helperLabel: dimension?.semantic_kind || dimension?.data_type || 'dimension',
  searchText: buildSemanticSearchText(dimension || {}),
});

export const toSemanticDragData = (semanticObject) => ({
  type: 'semantic-object',
  semanticId: semanticObject.id,
  field: semanticObject.field,
  fieldType: semanticObject.fieldType,
  objectKind: semanticObject.objectKind,
  semanticType: semanticObject.semanticType,
  label: semanticObject.label,
  metadata: semanticObject,
});
