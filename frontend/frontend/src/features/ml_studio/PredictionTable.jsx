import React from 'react';
import { readable } from './TrainingStage';
import { metricText } from './EvidencePlot';

export default function PredictionTable({ receipt }) {
  const columns = receipt.output_columns || ['input_row', 'prediction'];
  return <div className="ml-table-scroll"><table><thead><tr>{columns.map(column => <th key={column}>{readable(column)}</th>)}</tr></thead><tbody>{receipt.preview.map(row => <tr key={row.input_row}>{columns.map(column => <td key={column}>{typeof row[column] === 'number' ? metricText(row[column]) : String(row[column] ?? '')}</td>)}</tr>)}</tbody></table></div>;
}
