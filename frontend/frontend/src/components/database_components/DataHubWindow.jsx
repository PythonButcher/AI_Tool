import React, { useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { WarehouseContext } from '../../context/WarehouseContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function DataHubWindow() {
  const hasLogged = useRef(false);
  const { datasets, setDatasets, isLoading, setIsLoading, error, setError } =
  useContext(WarehouseContext);


  const handleDataHub = useCallback(() => {
    if (!hasLogged.current) {
      console.log("📂 Data Hub button clicked — placeholder active");
      hasLogged.current = true;
    }
  }, []);

  useEffect(() => {
    handleDataHub();
  }, [handleDataHub]);

  return <div style={{ padding: '8px' }}>Data Hub Placeholder Active</div>;
}

export default DataHubWindow;
