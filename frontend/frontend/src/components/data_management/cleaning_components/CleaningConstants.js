import React from 'react';
import {
  FaFont, FaEraser, FaFilter, FaExchangeAlt, FaFillDrip, FaTrash,
  FaArrowUp, FaArrowDown, FaClone, FaHashtag, FaObjectGroup, FaCalendarAlt,
  FaEdit, FaSortAmountDown, FaTable, FaColumns, FaLayerGroup, FaIndent, FaOutdent
} from 'react-icons/fa';
import { MdMergeType, MdSplitscreen } from 'react-icons/md';

export const TRANSFORM_LIBRARY = [
  {
    category: 'Text',
    transforms: [
      {
        type: 'trim_whitespace',
        label: 'Trim Whitespace',
        description: 'Remove leading and trailing spaces.',
        icon: <FaEraser />,
        fields: [{ name: 'columns', type: 'column-multi', label: 'Columns (optional)' }],
      },
      {
        type: 'change_case',
        label: 'Change Case',
        description: 'Uppercase, lowercase, or title case text.',
        icon: <FaFont />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          {
            name: 'case',
            type: 'select',
            label: 'Case',
            options: [
              { label: 'lowercase', value: 'lower' },
              { label: 'UPPERCASE', value: 'upper' },
              { label: 'Title Case', value: 'title' },
            ],
            defaultValue: 'lower',
          },
        ],
      },
      {
        type: 'replace_values',
        label: 'Replace Values',
        description: 'Swap specific values with new content.',
        icon: <FaExchangeAlt />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          { name: 'replacements', type: 'replacements', label: 'Value Replacements' },
        ],
      },
    ],
  },
  {
    category: 'Missing & Rows',
    transforms: [
      {
        type: 'replace_nulls',
        label: 'Replace Nulls',
        description: 'Fill null values with a strategy or value.',
        icon: <FaFillDrip />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns (optional)' },
          {
            name: 'strategy',
            type: 'select',
            label: 'Strategy',
            options: [
              { label: 'Custom Value', value: 'value' },
              { label: 'Forward Fill', value: 'ffill' },
              { label: 'Backward Fill', value: 'bfill' },
              { label: 'Mean (numeric)', value: 'mean' },
              { label: 'Median (numeric)', value: 'median' },
              { label: 'Mode', value: 'mode' },
            ],
            defaultValue: 'value',
          },
          { name: 'value', type: 'text', label: 'Custom Value (optional)' },
        ],
      },
      {
        type: 'remove_nulls',
        label: 'Remove Nulls',
        description: 'Drop rows that contain nulls.',
        icon: <FaTrash />,
        fields: [{ name: 'columns', type: 'column-multi', label: 'Columns (optional)' }],
      },
      {
        type: 'filter_rows',
        label: 'Filter Rows',
        description: 'Keep rows that satisfy conditions.',
        icon: <FaFilter />,
        fields: [{ name: 'conditions', type: 'conditions', label: 'Conditions' }],
      },
      {
        type: 'remove_top_rows',
        label: 'Remove Top',
        description: 'Remove the first N rows.',
        icon: <FaArrowUp />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 1 }],
      },
      {
        type: 'remove_bottom_rows',
        label: 'Remove Bottom',
        description: 'Remove the last N rows.',
        icon: <FaArrowDown />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 1 }],
      },
      {
        type: 'keep_top_rows',
        label: 'Keep Top',
        description: 'Keep only the first N rows.',
        icon: <FaIndent />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 5 }],
      },
      {
        type: 'keep_bottom_rows',
        label: 'Keep Bottom',
        description: 'Keep only the last N rows.',
        icon: <FaOutdent />,
        fields: [{ name: 'count', type: 'number', label: 'Number of rows', defaultValue: 5 }],
      },
      {
        type: 'remove_duplicates',
        label: 'Remove Dupes',
        description: 'Remove duplicate rows.',
        icon: <FaClone />,
        fields: [
          { name: 'subset', type: 'column-multi', label: 'Subset columns (optional)' },
          {
            name: 'keep',
            type: 'select',
            label: 'Keep',
            options: [
              { label: 'First', value: 'first' },
              { label: 'Last', value: 'last' },
              { label: 'None', value: false },
            ],
            defaultValue: 'first',
          },
        ],
      },
    ],
  },
  {
    category: 'Columns & Types',
    transforms: [
      {
        type: 'convert_type',
        label: 'Data Type',
        description: 'Cast columns to numeric, string, date, or boolean.',
        icon: <FaHashtag />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns' },
          {
            name: 'target',
            type: 'select',
            label: 'Target Type',
            options: [
              { label: 'String', value: 'string' },
              { label: 'Integer', value: 'int' },
              { label: 'Float', value: 'float' },
              { label: 'Numeric (coerce)', value: 'numeric' },
              { label: 'Datetime', value: 'datetime' },
              { label: 'Boolean', value: 'bool' },
            ],
            defaultValue: 'string',
          },
        ],
      },
      {
        type: 'split_column',
        label: 'Split Column',
        description: 'Split one column into many by delimiter.',
        icon: <MdSplitscreen />,
        fields: [
          { name: 'column', type: 'column', label: 'Column' },
          { name: 'delimiter', type: 'text', label: 'Delimiter', defaultValue: ' ' },
          { name: 'new_columns', type: 'text', label: 'New column names (comma separated)' },
          { name: 'drop_original', type: 'checkbox', label: 'Drop original column?' },
        ],
      },
      {
        type: 'merge_columns',
        label: 'Merge Columns',
        description: 'Combine multiple columns with a separator.',
        icon: <MdMergeType />,
        fields: [
          { name: 'columns', type: 'column-multi', label: 'Columns' },
          { name: 'separator', type: 'text', label: 'Separator', defaultValue: ' ' },
          { name: 'new_column', type: 'text', label: 'New column name', defaultValue: 'merged' },
        ],
      },
      {
        type: 'extract_date_component',
        label: 'Date Parts',
        description: 'Create a new column from date parts.',
        icon: <FaCalendarAlt />,
        fields: [
          { name: 'column', type: 'column', label: 'Date column' },
          {
            name: 'component',
            type: 'select',
            label: 'Component',
            options: [
              { label: 'Year', value: 'year' },
              { label: 'Month', value: 'month' },
              { label: 'Day', value: 'day' },
              { label: 'Weekday', value: 'weekday' },
              { label: 'ISO Week', value: 'week' },
            ],
            defaultValue: 'year',
          },
          { name: 'new_column', type: 'text', label: 'New column name (optional)' },
        ],
      },
      {
        type: 'rename_columns',
        label: 'Rename',
        description: 'Rename one or more columns.',
        icon: <FaEdit />,
        fields: [{ name: 'mappings', type: 'rename-map', label: 'Column Renames' }],
      },
      {
        type: 'reorder_columns',
        label: 'Reorder',
        description: 'Arrange columns in a custom order.',
        icon: <FaColumns />,
        fields: [{ name: 'order', type: 'order-text', label: 'Desired order (comma separated)' }],
      },
    ],
  },
  {
    category: 'Sorting & Shaping',
    transforms: [
      {
        type: 'sort_rows',
        label: 'Sort Rows',
        description: 'Sort by one or more columns.',
        icon: <FaSortAmountDown />,
        fields: [{ name: 'sort_by', type: 'sort-rules', label: 'Sort rules' }],
      },
      {
        type: 'group_by',
        label: 'Group By',
        description: 'Group rows and aggregate columns.',
        icon: <FaObjectGroup />,
        fields: [
          { name: 'group_columns', type: 'column-multi', label: 'Group columns' },
          { name: 'aggregations', type: 'aggregations', label: 'Aggregations' },
        ],
      },
      {
        type: 'pivot',
        label: 'Pivot',
        description: 'Create a pivot table.',
        icon: <FaTable />,
        fields: [
          { name: 'index', type: 'column-multi', label: 'Index columns' },
          { name: 'columns', type: 'column', label: 'Columns field' },
          { name: 'values', type: 'column', label: 'Values field' },
          {
            name: 'aggfunc',
            type: 'select',
            label: 'Aggregation',
            options: [
              { label: 'Sum', value: 'sum' },
              { label: 'Mean', value: 'mean' },
              { label: 'Count', value: 'count' },
              { label: 'Max', value: 'max' },
              { label: 'Min', value: 'min' },
            ],
            defaultValue: 'sum',
          },
        ],
      },
      {
        type: 'unpivot',
        label: 'Unpivot',
        description: 'Unpivot columns into attribute/value rows.',
        icon: <FaLayerGroup />,
        fields: [
          { name: 'id_vars', type: 'column-multi', label: 'ID columns' },
          { name: 'value_vars', type: 'column-multi', label: 'Value columns' },
          { name: 'var_name', type: 'text', label: 'Variable name', defaultValue: 'variable' },
          { name: 'value_name', type: 'text', label: 'Value name', defaultValue: 'value' },
        ],
      },
    ],
  },
];

export const buildDefaultValues = (fields = []) => {
  const defaults = {};
  fields.forEach((field) => {
    if (field.type === 'conditions') {
      defaults[field.name] = [{ column: '', operator: 'eq', value: '' }];
    } else if (field.type === 'replacements') {
      defaults[field.name] = [{ from: '', to: '' }];
    } else if (field.type === 'aggregations') {
      defaults[field.name] = [{ column: '', agg: 'sum', as: '' }];
    } else if (field.type === 'sort-rules') {
      defaults[field.name] = [{ column: '', direction: 'asc' }];
    } else if (field.type === 'rename-map') {
      defaults[field.name] = [{ from: '', to: '' }];
    } else {
      defaults[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
    }
  });
  return defaults;
};

const getTransformLookup = () => {
  const lookup = {};
  TRANSFORM_LIBRARY.forEach((group) => {
    group.transforms.forEach((transform) => {
      lookup[transform.type] = transform;
    });
  });
  return lookup;
};

export const transformLookup = getTransformLookup();
