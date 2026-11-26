import React, { useContext, useMemo } from 'react';
import {
  FaArrowRight,
  FaChartBar,
  FaCheck,
  FaColumns,
  FaDatabase,
  FaEye,
  FaFilter,
  FaFolderOpen,
  FaProjectDiagram,
  FaSave,
  FaSlidersH,
  FaUpload,
} from 'react-icons/fa';
import { DataContext, normalizeDatasetRows } from '../../context/DataContext';
import './WorkingDataHome.css';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?/;

function isMissingValue(value) {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

function fingerprintValue(value) {
  if (Array.isArray(value)) return `a:${JSON.stringify(value)}`;
  if (value !== null && typeof value === 'object') {
    const sorted = Object.keys(value)
      .sort()
      .map((key) => [key, value[key]]);
    return `o:${JSON.stringify(sorted)}`;
  }
  return `${typeof value}:${String(value)}`;
}

function formatMetricNumber(value) {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return value.toLocaleString();
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : 2;
  return Number(value.toFixed(digits)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatPercent(numerator, denominator) {
  if (!denominator) return '0%';
  const pct = (numerator / denominator) * 100;
  const rounded = pct === 100 || pct === 0 ? pct.toFixed(0) : pct.toFixed(1);
  return `${rounded}%`;
}

/**
 * Classifies declared schema types or inferred column types into canonical
 * analytical kinds aligned with the shared Datastream theme tokens.
 */
function classifyColumnKind(declaredType, values) {
  const normalized = String(declaredType || '').trim().toLowerCase();
  if (/(int|float|double|decimal|num|real|currency)/.test(normalized)) {
    return { label: 'Numeric', kind: 'numeric' };
  }
  if (/(date|time|timestamp|temporal)/.test(normalized)) {
    return { label: 'Temporal', kind: 'temporal' };
  }
  if (/(bool)/.test(normalized)) {
    return { label: 'Boolean', kind: 'boolean' };
  }
  if (/(json|array|dict|map|record)/.test(normalized)) {
    return { label: 'Structured', kind: 'categorical' };
  }
  if (/(str|text|char|varchar|cat|object)/.test(normalized) && values.length === 0) {
    return { label: 'Text', kind: 'categorical' };
  }
  if (values.length === 0) {
    return { label: 'Text', kind: 'categorical' };
  }

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;
  let objCount = 0;

  for (let i = 0; i < values.length; i += 1) {
    const val = values[i];
    if (typeof val === 'number' && Number.isFinite(val)) {
      numCount += 1;
    } else if (typeof val === 'boolean') {
      boolCount += 1;
    } else if (typeof val === 'object') {
      objCount += 1;
    } else if (typeof val === 'string') {
      const trimmed = val.trim();
      if (ISO_DATE_PATTERN.test(trimmed) && !Number.isNaN(Date.parse(trimmed))) {
        dateCount += 1;
      } else if (trimmed !== '' && Number.isFinite(Number(trimmed)) && /(int|float|num)/.test(normalized)) {
        numCount += 1;
      }
    }
  }

  const total = values.length;
  if (numCount === total) return { label: 'Numeric', kind: 'numeric' };
  if (boolCount === total) return { label: 'Boolean', kind: 'boolean' };
  if (dateCount === total) return { label: 'Temporal', kind: 'temporal' };
  if (objCount === total) return { label: 'Structured', kind: 'categorical' };
  return { label: 'Text', kind: 'categorical' };
}

/**
 * Computes a 100% deterministic structural and statistical summary of the active dataset
 * without exposing any individual data rows or raw record values.
 */
export function buildDeterministicSummary(rows, schema, fallbackCounts = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowCount = safeRows.length || fallbackCounts.rowCount || 0;

  const declaredFields = Array.isArray(schema)
    ? schema.filter((field) => typeof field?.name === 'string' && field.name.trim() !== '')
    : [];

  const fieldEntries = new Map();
  for (const field of declaredFields) {
    fieldEntries.set(field.name, field.data_type || field.dtype || field.type || '');
  }
  if (fieldEntries.size === 0) {
    for (let i = 0; i < safeRows.length; i += 1) {
      const row = safeRows[i];
      if (!row || typeof row !== 'object') continue;
      for (const key of Object.keys(row)) {
        if (!fieldEntries.has(key)) fieldEntries.set(key, '');
      }
    }
  }

  const fieldNames = Array.from(fieldEntries.keys());
  const fieldCount = fieldNames.length || fallbackCounts.fieldCount || 0;

  let duplicateRows = 0;
  let duplicateGroups = 0;
  if (safeRows.length > 1 && fieldNames.length > 0) {
    const rowCounts = new Map();
    for (let i = 0; i < safeRows.length; i += 1) {
      const row = safeRows[i];
      const signature = fieldNames
        .map((name) => (isMissingValue(row?.[name]) ? 'null:' : fingerprintValue(row[name])))
        .join('|');
      rowCounts.set(signature, (rowCounts.get(signature) || 0) + 1);
    }
    for (const count of rowCounts.values()) {
      if (count > 1) {
        duplicateGroups += 1;
        duplicateRows += count;
      }
    }
  }

  let totalFilledCells = 0;
  let totalMissingCells = 0;
  const typeCounts = { numeric: 0, categorical: 0, temporal: 0, boolean: 0 };

  const fields = fieldNames.map((name) => {
    const declaredType = fieldEntries.get(name);
    const nonEmptyValues = [];
    const distinctCounts = new Map();
    let missing = 0;

    for (let i = 0; i < safeRows.length; i += 1) {
      const val = safeRows[i]?.[name];
      if (isMissingValue(val)) {
        missing += 1;
      } else {
        nonEmptyValues.push(val);
        const fp = fingerprintValue(val);
        distinctCounts.set(fp, (distinctCounts.get(fp) || 0) + 1);
      }
    }

    const filled = nonEmptyValues.length;
    totalFilledCells += filled;
    totalMissingCells += missing;

    const distinct = distinctCounts.size;
    let topFrequency = 0;
    for (const count of distinctCounts.values()) {
      if (count > topFrequency) topFrequency = count;
    }

    const classification = classifyColumnKind(declaredType, nonEmptyValues);
    typeCounts[classification.kind] = (typeCounts[classification.kind] || 0) + 1;

    const isUniqueKey = safeRows.length > 1 && missing === 0 && distinct === safeRows.length;
    const isConstant = safeRows.length > 1 && filled > 0 && distinct === 1;

    let distribution = 'No non-empty values';
    if (filled > 0) {
      if (classification.kind === 'numeric') {
        const nums = nonEmptyValues
          .map((val) => (typeof val === 'number' ? val : Number(val)))
          .filter((val) => Number.isFinite(val))
          .sort((a, b) => a - b);

        if (nums.length > 0) {
          const min = nums[0];
          const max = nums[nums.length - 1];
          const sum = nums.reduce((acc, cur) => acc + cur, 0);
          const mean = sum / nums.length;
          const mid = Math.floor(nums.length / 2);
          const median = nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
          distribution = `Min ${formatMetricNumber(min)} · Median ${formatMetricNumber(median)} · Mean ${formatMetricNumber(mean)} · Max ${formatMetricNumber(max)}`;
        }
      } else if (classification.kind === 'boolean') {
        let trueCount = 0;
        for (let i = 0; i < nonEmptyValues.length; i += 1) {
          const val = nonEmptyValues[i];
          if (val === true || String(val).toLowerCase() === 'true') trueCount += 1;
        }
        const falseCount = filled - trueCount;
        distribution = `True ${trueCount.toLocaleString()} (${formatPercent(trueCount, filled)}) · False ${falseCount.toLocaleString()} (${formatPercent(falseCount, filled)})`;
      } else if (classification.kind === 'temporal') {
        const epochs = nonEmptyValues
          .map((val) => Date.parse(String(val)))
          .filter((ms) => Number.isFinite(ms))
          .sort((a, b) => a - b);

        if (epochs.length > 0) {
          const spanDays = Math.round((epochs[epochs.length - 1] - epochs[0]) / 86400000);
          const earliest = new Date(epochs[0]).toISOString().slice(0, 10);
          const latest = new Date(epochs[epochs.length - 1]).toISOString().slice(0, 10);
          distribution = earliest === latest
            ? `Single date (${earliest})`
            : `${earliest} to ${latest} (${spanDays.toLocaleString()}d span)`;
        } else {
          distribution = `${distinct.toLocaleString()} distinct timestamps`;
        }
      } else {
        let minLen = Infinity;
        let maxLen = 0;
        let sumLen = 0;
        for (let i = 0; i < nonEmptyValues.length; i += 1) {
          const text = typeof nonEmptyValues[i] === 'object'
            ? JSON.stringify(nonEmptyValues[i])
            : String(nonEmptyValues[i]);
          const len = text.length;
          if (len < minLen) minLen = len;
          if (len > maxLen) maxLen = len;
          sumLen += len;
        }
        const avgLen = Math.round(sumLen / filled);
        const lengthSummary = minLen === maxLen
          ? `${minLen} chars`
          : `${minLen}–${maxLen} chars (avg ${avgLen})`;
        const modeShare = formatPercent(topFrequency, filled);
        distribution = isUniqueKey
          ? `All values unique · ${lengthSummary}`
          : `Top share ${modeShare} · ${lengthSummary}`;
      }
    }

    return {
      name,
      label: classification.label,
      kind: classification.kind,
      filled,
      missing,
      total: safeRows.length,
      completenessLabel: safeRows.length > 0 ? formatPercent(filled, safeRows.length) : '—',
      distinct,
      isUniqueKey,
      isConstant,
      distribution,
    };
  });

  const totalCells = safeRows.length * fieldNames.length;
  const completenessPercent = totalCells > 0 ? formatPercent(totalFilledCells, totalCells) : '100%';
  const fieldsWithMissing = fields.filter((field) => field.missing > 0);
  const uniqueKeyFields = fields.filter((field) => field.isUniqueKey);

  const typeParts = [];
  if (typeCounts.numeric) typeParts.push(`${typeCounts.numeric} numeric`);
  if (typeCounts.categorical) typeParts.push(`${typeCounts.categorical} text`);
  if (typeCounts.temporal) typeParts.push(`${typeCounts.temporal} temporal`);
  if (typeCounts.boolean) typeParts.push(`${typeCounts.boolean} boolean`);
  const fieldMixLabel = typeParts.length > 0 ? typeParts.join(' · ') : 'Schema pending';

  const highlights = [
    `${rowCount.toLocaleString()} ${rowCount === 1 ? 'row' : 'rows'} across ${fieldCount.toLocaleString()} ${fieldCount === 1 ? 'field' : 'fields'} (${fieldMixLabel}).`,
  ];
  if (totalCells > 0) {
    highlights.push(
      totalMissingCells === 0
        ? `100% cell completeness across ${totalCells.toLocaleString()} evaluated cells with 0 missing values.`
        : `${completenessPercent} cell completeness — ${totalMissingCells.toLocaleString()} missing ${totalMissingCells === 1 ? 'cell' : 'cells'} across ${fieldsWithMissing.length.toLocaleString()} ${fieldsWithMissing.length === 1 ? 'field' : 'fields'}.`
    );
  }
  if (safeRows.length > 1 && fieldNames.length > 0) {
    highlights.push(
      duplicateRows === 0
        ? 'No exact duplicate rows detected across loaded records.'
        : `${duplicateRows.toLocaleString()} rows match across ${duplicateGroups.toLocaleString()} exact duplicate ${duplicateGroups === 1 ? 'group' : 'groups'}.`
    );
  }
  if (uniqueKeyFields.length > 0) {
    const keyNames = uniqueKeyFields.slice(0, 3).map((field) => field.name).join(', ');
    highlights.push(
      `${uniqueKeyFields.length.toLocaleString()} candidate identifier ${uniqueKeyFields.length === 1 ? 'field' : 'fields'} with 100% unique values (${keyNames}).`
    );
  }

  return {
    rowCount,
    fieldCount,
    totalCells,
    totalFilledCells,
    totalMissingCells,
    completenessPercent,
    duplicateRows,
    duplicateGroups,
    fieldMixLabel,
    highlights,
    fields,
  };
}

const ONBOARDING_STEPS = [
  {
    step: '01',
    title: 'Attach a dataset',
    description:
      'Upload a CSV, Excel, or JSON file from your device, reopen a saved dataset from Data Hub, or connect a live API or SQL source.',
  },
  {
    step: '02',
    title: 'Review deterministic summary & refine',
    description:
      'Inspect automatic row and field counts, completeness, and column statistics on arrival, then open Refine data to reshape in Power Query.',
  },
  {
    step: '03',
    title: 'Save Dataset',
    description:
      'Uploads and edits remain in your working session until you choose Save Dataset to publish a reusable version in Data Hub.',
  },
];

export default function WorkingDataHome({
  dataset,
  rows: rowsProp,
  schema: schemaProp,
  filteredRows: filteredRowsProp,
  canRefine = false,
  isApplyingRefine = false,
  refineUnavailableReason = '',
  compact = false,
  actions = {},
}) {
  const dataContext = useContext(DataContext) || {};
  const {
    save,
    upload,
    openSources,
    openHub,
    openRefine,
    inspectRows,
    filterRows,
    openTools,
    openFields,
    openModel,
  } = actions;

  const fallbackRows = useMemo(
    () => normalizeDatasetRows(dataContext.cleanedData ?? dataContext.fullData ?? dataContext.uploadedData),
    [dataContext.cleanedData, dataContext.fullData, dataContext.uploadedData]
  );
  const allRows = Array.isArray(rowsProp) ? rowsProp : fallbackRows;
  const activeFilteredRows = filteredRowsProp !== undefined ? filteredRowsProp : dataContext.filteredData;
  const hasPreviewFilter = Array.isArray(activeFilteredRows);
  const summarySourceRows = hasPreviewFilter ? activeFilteredRows : allRows;
  const effectiveSchema = schemaProp !== undefined ? schemaProp : dataContext.uploadedData?.schema;

  const summary = useMemo(
    () => (dataset
      ? buildDeterministicSummary(summarySourceRows, effectiveSchema, {
          rowCount: dataset.rowCount,
          fieldCount: dataset.fieldCount,
        })
      : null),
    [dataset, summarySourceRows, effectiveSchema]
  );

  const rootClassName = `working-data working-data--workspace${
    !dataset ? ' working-data--empty' : compact ? ' working-data--compact' : ''
  }`;

  const canTriggerSave = Boolean(dataset?.canSave && save && !isApplyingRefine);
  const statusSubtitle = dataset?.savedName
    ? `Linked to Data Hub entry “${dataset.savedName}”. Review the deterministic dataset summary below, refine in Power Query, or save a new revision when ready.`
    : dataset?.canSave
      ? 'Active in your workspace. Review the deterministic summary below, refine columns in Power Query, or use Save Dataset to store a version in Data Hub.'
      : 'Loaded for this session. Review the deterministic summary below, or upload a file or open a Data Hub entry when you need versioned saves.';

  return (
    <section className={rootClassName} aria-label="Workspace">
      {!dataset ? (
        <div className="ws-shell ws-shell--empty">
          <div className="ws-empty-card">
            <div className="ws-hero__eyebrow">
              <span className="ws-kicker">
                <span className="ws-kicker__dot" aria-hidden="true" />
                Active dataset home
              </span>
              <span className="ws-badge ws-badge--waiting">No dataset open</span>
            </div>

            <div className="ws-empty-card__body">
              <h1 id="workspace-heading" className="ws-empty-card__title">
                Workspace
              </h1>
              <p className="ws-empty-card__lead">
                Bring a dataset here to get an instant deterministic summary of its structure,
                completeness, and field distributions. Start by uploading a file or opening a saved
                entry from Data Hub.
              </p>
            </div>

            <div className="ws-actions-bar" role="group" aria-label="Get started with a dataset">
              <div className="ws-actions-bar__group">
                <button
                  type="button"
                  className="ws-btn ws-btn--primary"
                  onClick={upload}
                >
                  <FaUpload aria-hidden="true" />
                  <span>Upload data</span>
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={openHub}
                >
                  <FaFolderOpen aria-hidden="true" />
                  <span>Open from Data Hub</span>
                </button>
              </div>

              <div className="ws-actions-bar__group ws-actions-bar__group--end">
                {openSources && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={openSources}
                  >
                    <FaDatabase aria-hidden="true" />
                    <span>Connect a source</span>
                  </button>
                )}
                {openTools && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={openTools}
                  >
                    <span>Browse data tools</span>
                    <FaArrowRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="ws-empty-readiness" aria-label="Actions unlocked after opening a dataset">
              <span className="ws-empty-readiness__label">Unlocked with an active dataset:</span>
              <span className="ws-empty-readiness__pill">
                <FaChartBar aria-hidden="true" /> Deterministic summary
              </span>
              <span className="ws-empty-readiness__pill">
                <FaSlidersH aria-hidden="true" /> Refine data
              </span>
              <span className="ws-empty-readiness__pill">
                <FaSave aria-hidden="true" /> Save Dataset
              </span>
            </div>
          </div>

          <section className="ws-steps" aria-labelledby="workspace-begin-heading">
            <div className="ws-steps__header">
              <h2 id="workspace-begin-heading">How to begin</h2>
              <p>Follow three steps to move from raw source files to a reusable Data Hub dataset.</p>
            </div>
            <ol className="ws-steps__grid">
              {ONBOARDING_STEPS.map(({ step, title, description }) => (
                <li key={step} className="ws-step-card">
                  <span className="ws-step-card__num" aria-hidden="true">{step}</span>
                  <div className="ws-step-card__content">
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <div className="ws-shell">
          <header className="ws-hero">
            <div className="ws-hero__eyebrow">
              <span className="ws-kicker">
                <span className="ws-kicker__dot" aria-hidden="true" />
                Workspace · Active dataset
              </span>
              <div className="ws-hero__badges">
                {dataset.savedName ? (
                  <span className="ws-badge ws-badge--saved">
                    <FaCheck aria-hidden="true" />
                    <span>Data Hub entry: {dataset.savedName}</span>
                  </span>
                ) : dataset.canSave ? (
                  <span className="ws-badge ws-badge--unsaved">Unsaved working copy</span>
                ) : (
                  <span className="ws-badge ws-badge--session">Session source</span>
                )}
                {hasPreviewFilter && (
                  <span className="ws-badge ws-badge--filtered">
                    <FaFilter aria-hidden="true" />
                    <span>
                    Filtered scope ({summarySourceRows.length.toLocaleString()} {summarySourceRows.length === 1 ? 'row' : 'rows'})
                  </span>
                  </span>
                )}
              </div>
            </div>

            <div className="ws-hero__summary">
              <div className="ws-hero__identity">
                <h1 id="workspace-heading" className="ws-hero__title">{dataset.name}</h1>
                {!compact && <p className="ws-hero__subtitle">{statusSubtitle}</p>}
              </div>

              <dl className="ws-stats" aria-label="Working dataset details">
                <div className="ws-stats__item">
                  <dt>Rows</dt>
                  <dd>{dataset.rowCount.toLocaleString()}</dd>
                </div>
                <div className="ws-stats__item">
                  <dt>Fields</dt>
                  <dd>{dataset.fieldCount.toLocaleString()}</dd>
                </div>
                <div className="ws-stats__item">
                  <dt>Completeness</dt>
                  <dd>{summary.completenessPercent}</dd>
                </div>
                <div className="ws-stats__item">
                  <dt>Duplicate rows</dt>
                  <dd>{summary.duplicateRows.toLocaleString()}</dd>
                </div>
              </dl>
            </div>

            <div className="ws-actions-bar">
              <div className="ws-actions-bar__group" role="group" aria-label="Prepare and save dataset">
                <button
                  type="button"
                  className="ws-btn ws-btn--primary"
                  onClick={openRefine}
                  disabled={!canRefine || isApplyingRefine}
                  aria-describedby={!canRefine && refineUnavailableReason ? 'workspace-refine-reason' : undefined}
                >
                  <FaSlidersH aria-hidden="true" />
                  <span>Refine data</span>
                </button>
                <button
                  type="button"
                  className="ws-btn ws-btn--save"
                  onClick={save}
                  disabled={!canTriggerSave}
                  aria-describedby={!dataset.canSave ? 'workspace-save-reason' : undefined}
                >
                  <FaSave aria-hidden="true" />
                  <span>Save Dataset</span>
                </button>
              </div>

              <div className="ws-actions-bar__group" role="group" aria-label="Switch or attach dataset">
                <button
                  type="button"
                  className="ws-btn"
                  onClick={upload}
                >
                  <FaUpload aria-hidden="true" />
                  <span>Upload data</span>
                </button>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={openHub}
                >
                  <FaFolderOpen aria-hidden="true" />
                  <span>Open from Data Hub</span>
                </button>
              </div>

              <div className="ws-actions-bar__group ws-actions-bar__group--end" role="group" aria-label="Inspect and explore">
                {inspectRows && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={inspectRows}
                  >
                    <FaEye aria-hidden="true" />
                    <span>Inspect rows</span>
                  </button>
                )}
                {openFields && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={openFields}
                  >
                    <FaColumns aria-hidden="true" />
                    <span>Fields &amp; metrics</span>
                  </button>
                )}
                {openModel && dataset.canModel && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={openModel}
                  >
                    <FaProjectDiagram aria-hidden="true" />
                    <span>Data Model</span>
                  </button>
                )}
                {openTools && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--subtle"
                    onClick={openTools}
                  >
                    <span>Browse data tools</span>
                    <FaArrowRight aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {(!canRefine && refineUnavailableReason) || !dataset.canSave ? (
              <div className="ws-notices">
                {!canRefine && refineUnavailableReason && (
                  <p className="ws-notice" id="workspace-refine-reason">{refineUnavailableReason}</p>
                )}
                {!dataset.canSave && (
                  <p className="ws-notice" id="workspace-save-reason">
                    Upload a file or open a Data Hub entry to save durable revisions in Data Hub.
                  </p>
                )}
              </div>
            ) : null}
          </header>

          {!compact && (
            <section className="ws-summary" aria-labelledby="workspace-summary-heading">
              <div className="ws-summary__bar">
                <div className="ws-summary__title-group">
                  <h2 id="workspace-summary-heading">
                    <FaChartBar aria-hidden="true" />
                    <span>Deterministic dataset summary</span>
                  </h2>
                  <span className="ws-summary__meta">
                    {summary.fieldMixLabel} · Individual rows open in Data Tools or Inspect rows
                  </span>
                </div>

                {hasPreviewFilter && filterRows && (
                  <button type="button" className="ws-link-btn" onClick={filterRows}>
                    Review active filter in Data Tools
                  </button>
                )}
              </div>

              <ul className="ws-summary__highlights" aria-label="Dataset summary highlights">
                {summary.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {summary.fields.length === 0 ? (
                <div className="ws-summary__empty">
                  <p>No fields were detected in this dataset.</p>
                </div>
              ) : (
                <div
                  className="ws-summary__scroll"
                  role="region"
                  aria-label="Field summary scroll area"
                  tabIndex={0}
                >
                  <table className="ws-summary__table" aria-label="Deterministic field summary">
                    <thead>
                      <tr>
                        <th scope="col">Field</th>
                        <th scope="col">Type</th>
                        <th scope="col">Completeness</th>
                        <th scope="col">Distinct values</th>
                        <th scope="col">Statistical profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.fields.map((field) => (
                        <tr key={field.name}>
                          <th scope="row" className="ws-summary__field-cell">
                            <span className="ws-summary__field-name" title={field.name}>
                              {field.name}
                            </span>
                            {field.isUniqueKey && (
                              <span className="ws-role-tag ws-role-tag--key">Unique key</span>
                            )}
                            {field.isConstant && (
                              <span className="ws-role-tag ws-role-tag--constant">Constant</span>
                            )}
                          </th>
                          <td>
                            <span className={`ws-type-pill ws-type-pill--${field.kind}`}>
                              {field.label}
                            </span>
                          </td>
                          <td>
                            <div className="ws-completeness">
                              <meter
                                className="ws-completeness__meter"
                                min={0}
                                max={Math.max(1, field.total)}
                                value={field.filled}
                                aria-label={`${field.name} completeness`}
                              />
                              <span className="ws-completeness__text">
                                {field.completenessLabel}
                                {field.total > 0 && (
                                  <span className="ws-completeness__detail">
                                    {' '}({field.filled.toLocaleString()}/{field.total.toLocaleString()}
                                    {field.missing > 0 ? `, ${field.missing.toLocaleString()} empty` : ''})
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="ws-summary__num-cell">
                            {field.distinct.toLocaleString()}
                          </td>
                          <td className="ws-summary__profile-cell">
                            {field.distribution}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
