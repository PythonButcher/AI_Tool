// src/components/TableListDropdown.jsx
import React, { useState } from 'react';
import '../css/db_css/DatabaseConnectForm.css';           // reuse same CSS

const TableListDropdown = ({ tables = [], onSelectTable }) => {
  const [selectedTable, setSelectedTable] = useState('');

  const handleChange = (e) => {
    const name = e.target.value;
    setSelectedTable(name);
    onSelectTable(name);
  };

  return (
    <div className="table-dropdown">
      <label htmlFor="table-select" className="table-dropdown__label">
        Select a Table
      </label>

      <select
        id="table-select"
        className="table-dropdown__select"
        value={selectedTable}
        onChange={handleChange}
      >
        <option value="" disabled>
          {tables.length ? 'Choose…' : 'No tables available'}
        </option>

        {tables.map((tbl, i) => {
          const name = typeof tbl === 'string' ? tbl : tbl.table_name;
          return (
            <option key={i} value={name}>
              {name}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default TableListDropdown;
