import React, { useContext } from 'react';
import { WarehouseContext } from '../../context/WarehouseContext';
import './MentionDropdown.css'; // We will add the styles for this below

const MentionDropdown = ({ query, position, onSelect, onClose, children }) => {
  const { datasets } = useContext(WarehouseContext);

  // 1. Safe check: If no position is provided, we can't render it correctly
  if (!position) return null;

  // 2. Filter datasets based on the user's query (case-insensitive)
  //    e.g. if query is "sal", it finds "SalesData2023"
  const filteredDatasets = datasets.filter((ds) =>
    ds.name.toLowerCase().includes(query.toLowerCase())
  );

  // 3. If no matches and no children (custom messages), don't render anything
  if (filteredDatasets.length === 0 && !children) {
    return null;
  }

  return (
    <>
      {/* Invisible overlay to close menu if user clicks away */}
      <div className="mention-overlay" onClick={onClose} />

      <div 
        className="mention-dropdown"
        style={{ 
          top: position.top, 
          left: position.left 
        }}
      >
        {/* Render the matching datasets */}
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

        {/* Render specific 'children' if passed (e.g. "No results found") */}
        {filteredDatasets.length === 0 && (
          <div className="mention-empty">
             No datasets found for "{query}"
          </div>
        )}
        
        {/* Render any other custom children passed from parent */}
        {children}
      </div>
    </>
  );
};

export default MentionDropdown;