// DragDrop.js
import React, { useState, useRef, useCallback } from 'react';
import { AiOutlineCloudUpload } from 'react-icons/ai';
import './DragDrop.css';

const DragDrop = ({ onFilesSelected, width, height }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const notifySelection = useCallback(
    (filesLike) => {
      const files = Array.from(filesLike || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected]
  );

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    notifySelection(event.dataTransfer?.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBrowseClick();
    }
  };

  return (
    <section
      className={`drag-drop ${isDragging ? 'dragging' : ''}`}
      style={{ width, height }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Upload data files"
    >
      <div className="upload-info">
        <AiOutlineCloudUpload />
        <div>
          <p>Drag and drop your files here</p>
          <p>Supported files: CSV, XLSX, JSON</p>
          <button type="button" className="browse-btn" onClick={handleBrowseClick}>
            Browse files
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(event) => {
          notifySelection(event.target.files);
          event.target.value = '';
        }}
        accept=".csv,.xlsx,.json"
        multiple
      />
    </section>
  );
};

export default DragDrop;
