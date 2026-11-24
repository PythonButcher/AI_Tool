const isMissing = value => value == null || (typeof value === 'string' && value.trim() === '');
const fieldValue = (row, name) => Object.prototype.hasOwnProperty.call(row ?? {}, name) ? row[name] : undefined;

function fingerprint(value) {
  if (Array.isArray(value)) return ['array', value.map(fingerprint)];
  if (value !== null && typeof value === 'object') {
    return ['object', Object.keys(value).sort().map(key => [key, fingerprint(value[key])])];
  }
  return [typeof value, value];
}

export function describeFields(rows, schema) {
  const declared = Array.isArray(schema) ? schema.filter(field => typeof field?.name === 'string') : [];
  if (declared.length) {
    return declared.map(field => ({ name: field.name, type: field.data_type || field.dtype || field.type }));
  }
  const fields = new Map();
  for (const row of rows) {
    for (const [name, value] of Object.entries(row ?? {})) {
      const field = fields.get(name);
      if (!field?.type) fields.set(name, { name, type: value == null ? undefined : typeof value });
    }
  }
  return Array.from(fields.values());
}

export function filterWorkingRows(rows, rules) {
  const tests = rules.map(({ field, operator, query }) => {
    const expected = query.trim().toLowerCase();
    const threshold = Number(query);
    return row => {
      const value = row?.[field];
      if (operator === 'missing') return isMissing(value);
      if (isMissing(value)) return false;
      if (operator === 'gt' || operator === 'lt') {
        if (!['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value))) return false;
        return operator === 'gt' ? Number(value) > threshold : Number(value) < threshold;
      }
      const actual = displayCell(value).trim().toLowerCase();
      if (operator === 'equals') return actual === expected;
      if (operator === 'notEquals') return actual !== expected;
      return actual.includes(expected);
    };
  });
  return rows.filter(row => tests.every(test => test(row)));
}

export function profileField(rows, field) {
  const frequencies = new Map();
  let missing = 0;
  for (const row of rows) {
    const value = row?.[field];
    if (isMissing(value)) {
      missing += 1;
      continue;
    }
    const key = JSON.stringify(fingerprint(value));
    const entry = frequencies.get(key);
    if (entry) entry.count += 1;
    else frequencies.set(key, { key, value, count: 1 });
  }
  return {
    missing,
    distinct: frequencies.size,
    topValues: Array.from(frequencies.values()).sort((a, b) => b.count - a.count).slice(0, 8),
  };
}

export function findDuplicateRows(rows, names, { skipMissing = false } = {}) {
  const groups = new Map();
  const missingIndices = [];
  rows.forEach((row, index) => {
    const values = names.map(name => fieldValue(row, name));
    if (skipMissing && values.some(isMissing)) {
      missingIndices.push(index);
      return;
    }
    const key = JSON.stringify(values.map(fingerprint));
    const indices = groups.get(key);
    if (indices) indices.push(index);
    else groups.set(key, [index]);
  });
  const duplicateIndices = [];
  let groupCount = 0;
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    groupCount += 1;
    for (const index of indices) duplicateIndices.push(index);
  }
  return { groupCount, indices: duplicateIndices.sort((a, b) => a - b), missingIndices };
}

export function findInvalidRows(rows, { field, requirement, minimum, maximum, allowed }) {
  const allowedValues = requirement === 'allowed' ? new Set(allowed) : null;
  const passes = value => {
    if (isMissing(value)) return false;
    if (requirement === 'required') return true;
    if (requirement === 'number') return Number.isFinite(value);
    if (requirement === 'range') return Number.isFinite(value) && value >= minimum && value <= maximum;
    return ['string', 'number', 'boolean'].includes(typeof value) && allowedValues.has(String(value));
  };
  const invalid = [];
  rows.forEach((row, index) => {
    if (!passes(fieldValue(row, field))) invalid.push(index);
  });
  return invalid;
}

export function summarizeWorkingRows(rows, fields, measure) {
  const groups = new Map();
  for (const row of rows) {
    const values = fields.map(name => {
      const value = fieldValue(row, name);
      return isMissing(value) ? null : value;
    });
    const key = JSON.stringify(values.map(fingerprint));
    let group = groups.get(key);
    if (!group) {
      group = { values, rowCount: 0, numericCount: 0, total: 0 };
      groups.set(key, group);
    }
    group.rowCount += 1;
    const amount = measure ? fieldValue(row, measure) : undefined;
    if (Number.isFinite(amount)) {
      group.numericCount += 1;
      group.total += amount;
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.rowCount - a.rowCount);
}

export function displayCell(value) {
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
