import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DataProvider } from './context/DataContext';
import { WindowProvider } from './context/WindowContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <WindowProvider>
        <App />
      </WindowProvider>
    </DataProvider>
  </React.StrictMode>
);
