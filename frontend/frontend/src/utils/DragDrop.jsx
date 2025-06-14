// DragDrop.js
import React, { useState } from 'react';
import { AiOutlineCloudUpload } from 'react-icons/ai';
import '../components/css/DragDrop.css';

const DragDrop = ({ onFilesSelected, width, height }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length > 0) {
      onFilesSelected(Array.from(droppedFiles)); // Pass files back to parent component
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <section
      className={`drag-drop ${isDragging ? 'dragging' : ''}`}
      style={{ width: width, height: height }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="upload-info">
        <AiOutlineCloudUpload />
        <div>
          <p>Drag and drop your files here</p>
          <p>Supported files: CSV, XLSX, JSON</p>
        </div>
      </div>
      <input
        type="file"
        hidden
        id="browse"
        onChange={(e) => onFilesSelected(Array.from(e.target.files))}
        accept=".csv,.xlsx,.json"
        multiple
      />
    </section>
  );
};

export default DragDrop;
