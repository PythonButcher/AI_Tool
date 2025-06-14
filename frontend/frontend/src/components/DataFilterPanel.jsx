import React, { useState, useContext } from 'react';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { DataContext } from '../context/DataContext';
import { inferFieldTypes, applyRules } from '../utils/filterUtils';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const operatorOptions = [
  { value: 'equals',      label: 'Equals' },
  { value: 'notEquals',   label: 'Not Equals' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan',    label: 'Less Than' },
  { value: 'contains',    label: 'Contains' },
];

function DataFilterPanel({ openDataFilter, setOpenDataFilter }) {
  const { uploadedData, fullData, setFilteredData } = useContext(DataContext);

  const [field,    setField]    = useState('');
  const [operator, setOperator] = useState('');
  const [value,    setValue]    = useState('');
  const [rules,    setRules]    = useState([]);

  // ---------- helpers ----------
  const parseDataset = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;

    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }

    if (raw?.data_preview) {
      const preview = raw.data_preview;
      if (Array.isArray(preview)) return preview;
      if (typeof preview === 'string') {
        try { return JSON.parse(preview); } catch { return []; }
      }
    }

    if (raw?.data && Array.isArray(raw.data)) return raw.data;   // 🔥 handles {data:[…]}
    return [];
  };

  const dropdownDataset = parseDataset(uploadedData);            // column list (preview OK)

  const fullDataset     = parseDataset(fullData);                // 🔥 normalise fullData
  const filterDataset   = fullDataset.length ? fullDataset       // 🔥 pick full when ready
                                             : dropdownDataset;

  const fieldTypes = inferFieldTypes(dropdownDataset);

  const toggleDrawer = (open) => () => setOpenDataFilter(open);

  const handleAddRule = () => {
    if (!field || !operator || value === '') return;
    setRules((prev) => [...prev, { field, operator, value }]);
    setField('');
    setOperator('');
    setValue('');
  };

  const handleApplyFilters = async () => {
    if (rules.length === 0) return;

    const result = applyRules(filterDataset, rules);
    setFilteredData(result);

    try {
      await axios.post(`${API_URL}/api/filtered-upload`, { data_preview: result });
    } catch (err) {
      console.error('Failed to send filtered dataset:', err);
    }

    setOpenDataFilter(false);
  };

  const handleClearFilters = async () => {
    setRules([]);
    setFilteredData(null);

    const original = fullDataset.length ? fullDataset : dropdownDataset;

    try {
      await axios.post(`${API_URL}/api/filtered-upload`, { data_preview: original });
    } catch (err) {
      console.error('Failed to restore full dataset:', err);
    }

    setOpenDataFilter(false);
  };

  return (
    <Drawer anchor="right" open={openDataFilter} onClose={toggleDrawer(false)}>
      <div style={{ width: 300, padding: 20 }}>
        <Typography variant="h6" gutterBottom>Filters</Typography>
        <IconButton onClick={toggleDrawer(false)} style={{ float: 'right', marginTop: -40 }}>✕</IconButton>

        <TextField
          select fullWidth label="Field" value={field}
          onChange={(e) => setField(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          {Object.keys(fieldTypes).map((name) => (
            <MenuItem key={name} value={name}>{name}</MenuItem>
          ))}
        </TextField>

        <TextField
          select fullWidth label="Operator" value={operator}
          onChange={(e) => setOperator(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          {operatorOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth label="Value" value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <Button variant="outlined" onClick={handleAddRule} fullWidth style={{ marginBottom: 20 }}>
          + Add Rule
        </Button>

        {rules.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <Typography variant="subtitle1">Rules:</Typography>
            <ul style={{ paddingLeft: 20 }}>
              {rules.map((r, i) => (
                <li key={i}>{r.field} {r.operator} "{r.value}"</li>
              ))}
            </ul>
          </div>
        )}

        <Button variant="contained" color="primary" onClick={handleApplyFilters} fullWidth style={{ marginBottom: 10 }}>
          Apply Filters
        </Button>

        <Button variant="text" onClick={handleClearFilters} fullWidth>
          Clear Filters
        </Button>
      </div>
    </Drawer>
  );
}

export default DataFilterPanel;
