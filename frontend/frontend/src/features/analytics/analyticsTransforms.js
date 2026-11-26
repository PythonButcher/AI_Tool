import { clone } from './analyticsStorage';

export function remapAnalysis(config, mapping) {
  const next = clone(config);
  const name = value => mapping[value] || value;
  const filters = node => Array.isArray(node) ? node.map(filters) : node?.rules ? { ...node, rules: node.rules.map(filters) } : node ? { ...node, field: name(node.field) } : node;
  next.query.measures = next.query.measures.map(measure => ({ ...measure, ...(measure.field ? { field: name(measure.field) } : {}) }));
  next.query.group_by = next.query.group_by.map(group => ({ ...group, field: name(group.field) }));
  next.query.filters = filters(next.query.filters);
  if (next.query.period) next.query.period.field = name(next.query.period.field);
  if (next.query.field) next.query.field = name(next.query.field);
  if (next.query.columns) next.query.columns = next.query.columns.map(name);
  if (next.query.comparison?.filters) next.query.comparison.filters = filters(next.query.comparison.filters);
  // Aggregate measure IDs stay stable; detail/group sort fields follow remapping.
  if (next.query.sort && !next.query.measures.some(m => m.id === next.query.sort.field)) next.query.sort.field = name(next.query.sort.field);
  return next;
}

export function selectionFilter(groups, row) {
  const rules = groups.map(group => {
    const value = row[group.field];
    if (value == null) return { field: group.field, operator: 'is_null' };
    if (!group.grain) return { field: group.field, operator: 'eq', value };
    const text = String(value);
    const start = group.grain === 'quarter' ? new Date(Date.UTC(Number(text.slice(0, 4)), (Number(text.slice(-1)) - 1) * 3, 1))
      : new Date(`${text}${group.grain === 'year' ? '-01-01' : group.grain === 'month' ? '-01' : ''}T00:00:00Z`);
    const end = new Date(start);
    if (group.grain === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
    else if (['month', 'quarter'].includes(group.grain)) end.setUTCMonth(end.getUTCMonth() + (group.grain === 'quarter' ? 3 : 1));
    else end.setUTCDate(end.getUTCDate() + (group.grain === 'week' ? 7 : 1));
    return { op: 'and', rules: [{ field: group.field, operator: 'gte', type: 'date', value: start.toISOString() }, { field: group.field, operator: 'lt', type: 'date', value: end.toISOString() }] };
  });
  return rules.length === 1 ? rules[0] : { op: 'and', rules };
}
