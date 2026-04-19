// src/components/DatabaseConnectForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import TableListDropdown from './TableListDropdown';
import './DatabaseConnectForm.css';            // ← NEW

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
      console.log("✅ Preview Response:", data);
      handleDatabaseData(data);
      onClose();
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
    <div className="db-form-wrapper">
      <form className="db-form" onSubmit={connectToDatabase}>
        <div className="db-form__header">
          <p className="db-form__eyebrow">Database</p>
          <h3 className="db-form__title">Connect Postgres</h3>
        </div>

        <div className="db-form__grid">
          <div className="db-form__field db-form__field--wide">
            <label>Host</label>
            <input
              type="text"
              name="host"
              value={dbConfig.host}
              onChange={handleInputChange}
              placeholder="localhost"
              required
            />
          </div>
          <div className="db-form__field">
            <label>Port</label>
            <input
              type="text"
              name="port"
              value={dbConfig.port}
              onChange={handleInputChange}
              placeholder="5432"
              required
            />
          </div>
          <div className="db-form__field">
            <label>Database</label>
            <input
              type="text"
              name="dbname"
              value={dbConfig.dbname}
              onChange={handleInputChange}
              placeholder="db_name"
              required
            />
          </div>
          <div className="db-form__field">
            <label>User</label>
            <input
              type="text"
              name="user"
              value={dbConfig.user}
              onChange={handleInputChange}
              placeholder="postgres"
              required
            />
          </div>
          <div className="db-form__field">
            <label>Password</label>
            <input
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
          {isLoading ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {error && <div className="db-form__error">{error}</div>}

      {tables.length > 0 && (
        <div className="db-form__tables">
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
