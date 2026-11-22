import React from 'react';
import './SideBar.css';

const destinations = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'data_hub', label: 'Data Hub' },
  { id: 'data_model', label: 'Data Model' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'ml_studio', label: 'ML Studio' },
];

export default function DestinationNav({ activeDestination, onDestinationSelect }) {
  return (
    <nav className="destination-nav" aria-label="Main navigation">
      {destinations.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-current={activeDestination === id ? 'page' : undefined}
          onClick={() => onDestinationSelect(id)}
        >
          {label}
        </button>
      ))}
      {activeDestination === 'ai' && <span aria-current="page">AI Suite</span>}
    </nav>
  );
}
