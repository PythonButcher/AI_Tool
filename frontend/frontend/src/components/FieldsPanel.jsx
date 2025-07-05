import React from 'react';
import PropTypes from 'prop-types';
import { useDraggable } from '@dnd-kit/core';
import Paper from '@mui/material/Paper';
import Grid2 from '@mui/material/Grid2';
import './css/FieldsPanel.css';

// DraggableField Component
const DraggableField = ({ fieldName }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fieldName,
  });
  console.log("Draggable field ID:", fieldName);

  return (
    <Paper
      ref={setNodeRef}
      elevation={1}
      className={`fields-panel-item ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      {fieldName}
    </Paper>
  );
};

DraggableField.propTypes = {
  fieldName: PropTypes.string.isRequired,
};

// FieldsPanel Component
const FieldsPanel = ({ cleanedData }) => {
  if (!cleanedData || cleanedData.length === 0) {
    return null; // No data to display
  }

  const fields = Object.keys(cleanedData[0]);

  return (
    <div className="fields-panel-container">
      <h3 className="fields-panel-header">Fields in Dataset</h3>
      <Grid2 container spacing={2}>
        {fields.map((field) => (
          <Grid2 xs={12} key={field}>
            <DraggableField fieldName={field} />
          </Grid2>
        ))}
      </Grid2>
    </div>
  );
};

FieldsPanel.propTypes = {
  cleanedData: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default FieldsPanel;
