import React, { useCallback, useContext, useMemo, useState } from "react";
import axios from "axios";
import { WarehouseContext } from "../../context/WarehouseContext";
import "./DataHubWindow.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const initialForm = {
  id: "",
  name: "",
  path: "",
};

function DataHubWindow() {
  const {
    datasets,
    setDatasets,
    isLoading,
    setIsLoading,
    error,
    setError,
  } = useContext(WarehouseContext);

  const [formState, setFormState] = useState(initialForm);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const fetchDatasets = useCallback(
    async (queryValue = lastQuery) => {
      const trimmedQuery = queryValue.trim();
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/datahub/list`, {
          params: trimmedQuery ? { query: trimmedQuery } : {},
        });
        setDatasets(Array.isArray(response.data) ? response.data : []);
        setLastQuery(trimmedQuery);
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Failed to load datasets.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [lastQuery, setDatasets, setError, setIsLoading]
  );

  const handleSearchInputChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSearch = useCallback(
    async (event) => {
      event.preventDefault();
      setError(null);
      setSuccessMessage("");
      setHasSearched(true);
      await fetchDatasets(searchTerm);
    },
    [fetchDatasets, searchTerm, setError]
  );

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(initialForm);
  }, []);

  const handleRegister = useCallback(
    async (event) => {
      event.preventDefault();
      setError(null);
      setSuccessMessage("");

      if (!formState.id || !formState.name || !formState.path) {
        setError("Please provide an ID, name, and path for the dataset.");
        return;
      }

      try {
        setIsLoading(true);
        await axios.post(`${API_URL}/api/datahub/register`, formState);
        setSuccessMessage("Dataset registered successfully.");
        resetForm();
        if (hasSearched) {
          await fetchDatasets();
        }
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Failed to register dataset.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDatasets, formState, hasSearched, resetForm, setError, setIsLoading]
  );

  const handleDelete = useCallback(
    async (datasetId) => {
      if (!datasetId) return;

      setError(null);
      setSuccessMessage("");

      try {
        setIsLoading(true);
        await axios.delete(`${API_URL}/api/datahub/${datasetId}`);
        setSuccessMessage("Dataset deleted.");
        if (hasSearched) {
          await fetchDatasets();
        } else {
          setDatasets((prev) => prev.filter((dataset) => dataset.id !== datasetId));
        }
      } catch (err) {
        const message = err.response?.data?.error || err.message || "Failed to delete dataset.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDatasets, hasSearched, setDatasets, setError, setIsLoading]
  );

  const sortedDatasets = useMemo(() => {
    return [...datasets].sort((a, b) => {
      const nameA = a?.name || "";
      const nameB = b?.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [datasets]);

  return (
    <div className="datahub-window">
      <header className="datahub-header">
        <h3>Hub</h3>
        <button
          className="refresh-btn"
          onClick={() => fetchDatasets()}
          disabled={isLoading || !hasSearched}
        >
          Refresh
        </button>
      </header>

      <section className="datahub-search-section">
        <form className="datahub-search" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchInputChange}
            placeholder="Search datasets"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            Search
          </button>
        </form>
      </section>

      <section className="datahub-status">
        {isLoading && <p className="status loading">Loading...</p>}
        {!isLoading && !hasSearched && !error && (
          <p className="status empty">Search for a dataset.</p>
        )}
        {!isLoading && hasSearched && !sortedDatasets.length && !error && (
          <p className="status empty">
            No results found.
          </p>
        )}
        {error && <p className="status error">{error}</p>}
        {successMessage && <p className="status success">{successMessage}</p>}
      </section>

      <section className="datahub-table-wrapper">
        {hasSearched && sortedDatasets.length > 0 && (
          <table className="datahub-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedDatasets.map((dataset) => (
                <tr key={dataset.id}>
                  <td>{dataset.name}</td>
                  <td className="truncate">{dataset.path}</td>
                  <td>
                    <button
                      className="danger"
                      onClick={() => handleDelete(dataset.id)}
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="datahub-form-section">
        <h4>Register</h4>
        <form className="datahub-form" onSubmit={handleRegister}>
          <label>
            ID
            <input
              type="text"
              name="id"
              value={formState.id}
              onChange={handleInputChange}
              placeholder="unique-id"
              disabled={isLoading}
            />
          </label>
          <label>
            Name
            <input
              type="text"
              name="name"
              value={formState.name}
              onChange={handleInputChange}
              placeholder="dataset.csv"
              disabled={isLoading}
            />
          </label>
          <label>
            Path
            <input
              type="text"
              name="path"
              value={formState.path}
              onChange={handleInputChange}
              placeholder="/uploads/dataset.csv"
              disabled={isLoading}
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={resetForm} disabled={isLoading}>
              Clear
            </button>
            <button type="submit" className="primary" disabled={isLoading}>
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default DataHubWindow;
