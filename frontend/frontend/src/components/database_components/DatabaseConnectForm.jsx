// src/components/DatabaseConnectForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import TableListDropdown from './TableListDropdown';
import '../css/db_css/DatabaseConnectForm.css';            // ← NEW

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
        <h3 className="db-form__title">Connect to PostgreSQL</h3>

        {['host', 'port', 'dbname', 'user', 'password'].map((field) => (
          <div className="db-form__row" key={field}>
            <label className="db-form__label">{field}</label>
            <input
              className="db-form__input"
              type={field === 'password' ? 'password' : 'text'}
              name={field}
              value={dbConfig[field]}
              onChange={handleInputChange}
              placeholder={field === 'host' ? 'localhost' : field}
              required
            />
          </div>
        ))}

        <button
          className="db-form__button"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Connecting…' : 'Connect'}
        </button>
      </form>

      {error && <div className="db-form__error">{error}</div>}

      {tables.length > 0 && (
        <TableListDropdown
          tables={tables}
          onSelectTable={handleSelectTable}
        />
      )}
    </div>
  );
}

export default DatabaseConnectForm;
