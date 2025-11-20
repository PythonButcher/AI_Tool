import React, { useContext } from 'react';
import { WarehouseContext } from '../../context/WarehouseContext';
import './MentionDropdown.css'; // We will add the styles for this below

const MentionDropdown = ({ query, position, onSelect, onClose, children }) => {
  const { datasets } = useContext(WarehouseContext);

  // DEBUG: See if data is actually loaded in the context
  console.log("MentionDropdown | Context Datasets:", datasets);
  console.log("MentionDropdown | Current Query:", query);

  if (!position) return null;

  // Filter datasets
  const filteredDatasets = datasets.filter((ds) =>
    ds.name.toLowerCase().includes(query.toLowerCase())
  );

  // REMOVED THE "Early Return" here so we can see the "Empty" message

  return (
    <>
      <div className="mention-overlay" onClick={onClose} />

      <div 
        className="mention-dropdown"
        style={{ 
          top: position.top, 
          left: position.left 
        }}
      >
        <div className="mention-header">Select a dataset</div>
        {/* 1. List Matches */}
        {filteredDatasets.map((ds) => (
          <div
            key={ds.id}
            className="mention-item"
            onClick={() => onSelect(ds.name)}
          >
            <span className="mention-icon">🗄️</span>
            {ds.name}
          </div>
        ))}

        {/* 2. Show "No results" if list is empty */}
        {filteredDatasets.length === 0 && (
          <div className="mention-empty">
             No datasets found for "{query}"
          </div>
        )}
        
        {children}
      </div>
    </>
  );
};

export default MentionDropdown;