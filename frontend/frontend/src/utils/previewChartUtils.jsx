// utils/previewChartUtils.js

/**
 * transformPreviewData(uploadedData)
 *
 * Transforms the raw uploadedData (specifically its data_preview) into
 * a small Chart.js data object. We simply use the first and second columns
 * as our "labels" and "data," respectively.
 */
export function transformPreviewData(uploadedData) {
    if (!uploadedData || !uploadedData.data_preview) {
      return null;
    }
  
    // data_preview could be an array or a JSON string
    let rows = [];
    if (Array.isArray(uploadedData.data_preview)) {
      rows = uploadedData.data_preview;
    } else {
      try {
        rows = JSON.parse(uploadedData.data_preview);
      } catch (err) {
        console.error('Error parsing data_preview for preview chart:', err);
        return null;
      }
    }
  
    if (rows.length === 0) {
      return null;
    }
  
    // Assume the first column is labels, the second column is data
    const keys = Object.keys(rows[0]);
    if (keys.length < 2) {
      console.warn('Not enough columns to build a simple X vs Y preview chart');
      return null;
    }
  
    const labelField = keys[0];
    const dataField = keys[1];
  
    // Build arrays for Chart.js
    const labels = rows.map((row) => String(row[labelField]));
    const values = rows.map((row) => Number(row[dataField]) || 0);
  
    // Construct a simple Chart.js data object
    return {
      labels,
      datasets: [
        {
          label: `Preview of ${dataField}`,
          data: values,
          backgroundColor: 'rgba(75,192,192,0.6)',
        },
      ],
    };
  }
  