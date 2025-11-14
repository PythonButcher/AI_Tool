import React from 'react';
import { jsPDF } from 'jspdf';
import { FaImage, FaCopy, FaFileExport, FaCloudUploadAlt } from 'react-icons/fa';

export default function ChartToolbar({ chartRef }) {
    const handleCopyImage = async () => {
        if (chartRef?.current) {
          const base64Image = chartRef.current.toBase64Image();
      
          // Convert base64 to blob
          const res = await fetch(base64Image);
          const blob = await res.blob();
      
          // Write image blob to clipboard
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            alert('Chart image copied to clipboard successfully!');
          } catch (error) {
            console.error('Error copying image:', error);
            alert('Failed to copy image to clipboard.');
          }
        } else {
          alert('Chart is not available.');
        }
      };
      
  const toolbarStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px',
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    boxShadow: '0 3px 8px rgba(0,0,0,0.1)',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };

  const buttonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
    border: 'none',
  };

  const handleClick = (action) => () => {
    alert(`${action} action clicked.`);
  };

  return (
    <div style={toolbarStyle}>
        <button 
        style={{
            ...buttonStyle,
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.2s ease-in-out',
        }}
        onClick={() => {
            if (!chartRef?.current) {
            alert("Chart is not available.");
            return;
            }

            const base64Image = chartRef.current.toBase64Image();
            const link = document.createElement('a');
            link.href = base64Image;
            link.download = `chart_export_${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }}
        onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb'; // Light gray on hover
        }}
        onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6'; // Reset
        }}
        >
        <FaImage style={{ opacity: 0.85 }} />
        Export PNG
        </button>
            
      <button style={buttonStyle} onClick={handleCopyImage}>
        <FaCopy /> Copy Chart Image
      </button>
      
      <button
        style={buttonStyle}
        onClick={() => {
            if (!chartRef?.current) {
            alert("Chart is not available.");
            return;
            }

            const base64Image = chartRef.current.toBase64Image();
            const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [800, 600], // adjust size as needed
            });

            pdf.addImage(base64Image, 'PNG', 20, 20, 760, 560);
            pdf.save(`chart_export_${new Date().toISOString().split('T')[0]}.pdf`);
        }}
        >
        <FaFileExport /> Export as PDF
    </button>

      
      <button style={buttonStyle} onClick={handleClick('Web Clipboard')}>
        <FaCloudUploadAlt /> Web Clipboard
      </button>
    </div>
  );
}
