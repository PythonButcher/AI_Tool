import { createContext, useState, useCallback, useMemo } from "react";

export const WarehouseContext = createContext(null);

export const WarehouseProvider = ({ children }) => {
  // --- State ---
  const [datasets, setDatasets] = useState([]);

  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Handlers ---
  const addDataset = useCallback((datasetObj) => {
    // datasetObj must always follow this shape: { id, name, path }
    if (!datasetObj?.id || !datasetObj?.name || !datasetObj?.path) {
      setError("Invalid dataset object — must include id, name, and path.");
      return;
    }
    setDatasets((prev) => [...prev, datasetObj]);
  }, []);

  const removeDataset = useCallback((id) => {
    setDatasets((prev) => prev.filter((ds) => ds.id !== id));
  }, []);

  const refreshDatasets = useCallback((nextDatasets) => {
    if (!Array.isArray(nextDatasets)) return;
    setDatasets(nextDatasets);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // --- Context Value ---
  const value = useMemo(
    () => ({
      datasets,          // [{ id, name, path }]
      addDataset,        // adds new dataset
      removeDataset,     // removes dataset by id
      refreshDatasets,   // replace entire dataset array
      error,             // error message if any
      clearError,        // clears error
      isLoading,         // for async states later
      setIsLoading,      // expose control if needed
      setError,          // expose setter if needed
      setDatasets,       // expose setter for backend sync
    }),
    [
      datasets,
      error,
      isLoading,
      addDataset,
      removeDataset,
      refreshDatasets,
      clearError,
      setDatasets,
    ]
  );

  // --- Return Provider ---
  return (
    <WarehouseContext.Provider value={value}>
      {children}
    </WarehouseContext.Provider>
  );
};
