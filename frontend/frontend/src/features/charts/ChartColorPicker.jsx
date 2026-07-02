import React, { useState, useRef, useEffect } from 'react';
import { MdOutlineColorLens } from 'react-icons/md';
import './ChartColorPicker.css';

export const PALETTES = {
  default: {
    id: 'default',
    label: 'App Default',
    colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
    isDefault: true,
  },
  categorical: {
    id: 'categorical',
    label: 'Categorical',
    colors: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    colors: ['#0284c7', '#0369a1', '#075985', '#0c4a6e', '#0891b2', '#0e7490'],
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    colors: ['#f43f5e', '#e11d48', '#be123c', '#9f1239', '#f97316', '#ea580c'],
  },
  high_contrast: {
    id: 'high_contrast',
    label: 'High Contrast',
    colors: ['#1e1e1e', '#404040', '#000000', '#525252', '#737373', '#a3a3a3'],
  }
};

const ChartColorPicker = ({ display = {}, onChange, buttonClassName = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  const activePaletteId = display.paletteId || 'default';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePaletteSelect = (paletteId) => {
    onChange({
      ...display,
      paletteId,
      customColors: [], // Reset custom colors when switching palettes
    });
  };

  const handleReset = () => {
    onChange({
      ...display,
      paletteId: 'default',
      customColors: [],
      seriesColors: {},
    });
    setIsOpen(false);
  };

  return (
    <div className="chart-color-picker" ref={containerRef}>
      <button 
        className={`chart-color-picker__trigger ${buttonClassName} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Chart Appearance"
      >
        <MdOutlineColorLens size={18} />
      </button>

      {isOpen && (
        <div className="chart-color-picker__popover">
          <div className="chart-color-picker__header">
            <strong>Palette</strong>
            <button className="chart-color-picker__reset" onClick={handleReset}>
              Reset
            </button>
          </div>
          
          <div className="chart-color-picker__palettes">
            {Object.values(PALETTES).map(palette => (
              <button
                key={palette.id}
                className={`chart-color-picker__palette-item ${activePaletteId === palette.id ? 'selected' : ''}`}
                onClick={() => handlePaletteSelect(palette.id)}
              >
                <div className="palette-preview">
                  {palette.colors.slice(0, 5).map((color, i) => (
                    <div 
                      key={i} 
                      className="palette-swatch" 
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="palette-label">{palette.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartColorPicker;
