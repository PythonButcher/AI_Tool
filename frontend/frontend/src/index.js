import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DataProvider } from './context/DataContext'; // Import the DataProvider
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <DndProvider backend={HTML5Backend}>
        <App />
      </DndProvider>
    </DataProvider>
  </React.StrictMode>
);
