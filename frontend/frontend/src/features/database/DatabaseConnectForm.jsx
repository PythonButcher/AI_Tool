// src/components/DatabaseConnectForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import TableListDropdown from './TableListDropdown';
import './DatabaseConnectForm.css';
import { FaDatabase, FaTimes, FaMinus } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function DatabaseConnectForm({ handleDatabaseData, onClose }) {
  /* ─── State ───────────────────────────────────────── */
  const [dbConfig, setDbConfig] = useState({
    host: '',
    port: '',
    dbname: '',
    user: '',
    password: '',
  });

  const [tables, setTables]     = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState(null);

  /* ─── Handlers ────────────────────────────────────── */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDbConfig(prev => ({ ...prev, [name]: value }));
  };

  const connectToDatabase = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setTables([]);

    try {
      const { data } = await axios.post(`${API_URL}/api/db/connect`, dbConfig);
      setTables(data.tables || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Connection failed. Check credentials or server status.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTable = async (tableName) => {
    if (!tableName) return;
    setIsLoading(true);
    setError(null);
  
    try {
      const { data } = await axios.post(`${API_URL}/api/preview`, {
        table: tableName,
        limit: 100,
        dbConfig: dbConfig  // ✔ send full dbConfig for auth
      });
      handleDatabaseData(data);
      if (onClose) onClose();
    } catch (err) {
      console.error("❌ Preview Error:", err);
      setError(
        err.response?.data?.error || 'Failed to load preview for this table.'
      );
    } finally {
      setIsLoading(false);
    }
  };
  

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className="db-connect-content">
      <form className="db-form" onSubmit={connectToDatabase}>
        <div className="db-form__grid">
          <div className="db-form__field db-form__field--wide">
            <label className="db-form__label">Host / Endpoint</label>
            <input
              className="db-form__input"
              type="text"
              name="host"
              value={dbConfig.host}
              onChange={handleInputChange}
              placeholder="e.g. localhost or aurora.aws.com"
              required
            />
          </div>
          <div className="db-form__field">
            <label className="db-form__label">Port</label>
            <input
              className="db-form__input"
              type="text"
              name="port"
              value={dbConfig.port}
              onChange={handleInputChange}
              placeholder="5432"
              required
            />
          </div>
          <div className="db-form__field">
            <label className="db-form__label">Database Name</label>
            <input
              className="db-form__input"
              type="text"
              name="dbname"
              value={dbConfig.dbname}
              onChange={handleInputChange}
              placeholder="inventory_db"
              required
            />
          </div>
          <div className="db-form__field">
            <label className="db-form__label">Username</label>
            <input
              className="db-form__input"
              type="text"
              name="user"
              value={dbConfig.user}
              onChange={handleInputChange}
              placeholder="postgres"
              required
            />
          </div>
          <div className="db-form__field">
            <label className="db-form__label">Password</label>
            <input
              className="db-form__input"
              type="password"
              name="password"
              value={dbConfig.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          className="db-form__submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Establishing Connection...' : 'Connect to Warehouse'}
        </button>
      </form>

      {error && <div className="db-form__error">{error}</div>}

      {tables.length > 0 && (
        <div className="db-form__tables">
          <p className="db-form__tables-label">Select Source Table</p>
          <TableListDropdown
            tables={tables}
            onSelectTable={handleSelectTable}
          />
        </div>
      )}
    </div>
  );
}

export default DatabaseConnectForm;
