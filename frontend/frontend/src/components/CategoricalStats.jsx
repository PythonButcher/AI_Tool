import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchBar from './SearchBar';
import './css/CategoricalStats.css'; // Create CSS file for styling

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function CategoricalStats() {
    const [categoricalColumns, setCategoricalColumns] = useState([]);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [statsData, setStatsData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get(`${API_URL}/api/categorical-columns`)
        .then(response => {
            setCategoricalColumns(response.data);
        })
        .catch(error => {
            setError('Error fetching categorical columns.');
            console.error(error);
        });
    }, []);

    // Fetch statistics when a column is selected
    useEffect(() => {
        if (selectedColumn) {
            axios.get(`${API_URL}/api/catstats?columnName=${encodeURIComponent(selectedColumn)}`)
            .then(response => {
                setStatsData(response.data);
            })
            .catch(error => {
                setError('Error fetching categorical statistics.');
                console.error(error);
            });
        }
    }, [selectedColumn]);

    // Update search term for filtering
    const handleSearchChange = (newTerm) => setSearchTerm(newTerm);

    // Check if statsData and statsData.counts are defined before using Object.entries
    const filteredCounts = statsData && statsData.counts 
    ? Object.entries(statsData.counts).filter(([category]) =>
        category.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

        return (
            <div className="categorical-stats-dropdown">
              {error && <div className="error-message">{error}</div>}
              
              {/* Dropdown for selecting categorical column */}
              <div className="categorical-dropdown-container">
          <label htmlFor="categorical-column-select">Select a Categorical Column:</label>
          <select
             id="categorical-column-select"
             value={selectedColumn}
             onChange={(e) => setSelectedColumn(e.target.value)}
            >
          <option value="">-- Select Column --</option>
              {categoricalColumns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
         </select>
          </div>
              {/* Search Bar */}
              <SearchBar onSearchChange={handleSearchChange} />
        
              {/* Display filtered statistics */}
              {statsData && (
                <div className="stats-container">
                  <h3>Statistics for {selectedColumn}</h3>
                  <div className="mode-container">
                    <strong>Mode:</strong> {statsData.mode.join(', ')}
                  </div>
                  <div className="frequency-distribution">
                    <h4>Frequency Distribution:</h4>
                    <table className="frequency-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCounts.length > 0 ? (
                          filteredCounts.map(([category, count]) => (
                            <tr key={category}>
                              <td>{category}</td>
                              <td>{count}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2">No results found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        }
        
        export default CategoricalStats;