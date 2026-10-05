import React from 'react';

export const metricText = value => Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 4 }) : 'Unavailable';

export default function EvidencePlot({ evidence, title }) {
  if (!evidence) return null;
  if (evidence.kind === 'confusion_matrix') return <figure className="ml-evidence-figure"><figcaption>{title} · confusion matrix</figcaption><p>Rows are actual classes; columns are predicted classes. Diagonal counts are correct predictions.</p><div className="ml-table-scroll"><table><thead><tr><th>Actual / predicted</th>{evidence.labels.map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{evidence.counts.map((row, index) => <tr key={evidence.labels[index]}><th scope="row">{evidence.labels[index]}</th>{row.map((count, column) => <td className={index === column ? 'ml-confusion-correct' : ''} key={column}>{count}</td>)}</tr>)}</tbody></table></div></figure>;
  if (evidence.kind !== 'residuals' || !evidence.points?.length) return null;
  const points = evidence.points;
  const min = Math.min(...points.map(point => point.predicted)), max = Math.max(...points.map(point => point.predicted));
  const residualRange = Math.max(...points.map(point => Math.abs(point.residual)), .000001);
  const x = value => 52 + (value - min) / (max - min || 1) * 410;
  const y = value => 112 - value / residualRange * 80;
  return <figure className="ml-evidence-figure"><figcaption>{title} · residuals</figcaption><p>Residual = actual − predicted. A centered cloud is preferable to a systematic pattern. Showing up to {evidence.sample_limit} rows.</p><svg viewBox="0 0 500 245" role="img" aria-label={`${title}: predicted values from ${metricText(min)} to ${metricText(max)}, residuals within plus or minus ${metricText(residualRange)}`}>
    <line x1="52" x2="462" y1="112" y2="112" className="ml-plot-zero" /><line x1="52" x2="52" y1="26" y2="200" className="ml-plot-axis" />
    {points.map((point, index) => <circle key={index} cx={x(point.predicted)} cy={y(point.residual)} r="3.5"><title>Predicted {metricText(point.predicted)}; residual {metricText(point.residual)}</title></circle>)}
    <text x="52" y="218">{metricText(min)}</text><text x="462" y="218" textAnchor="end">{metricText(max)}</text><text x="257" y="238" textAnchor="middle">Predicted value</text><text x="45" y="30" textAnchor="end">{metricText(residualRange)}</text><text x="45" y="116" textAnchor="end">0</text><text x="45" y="200" textAnchor="end">{metricText(-residualRange)}</text>
  </svg></figure>;
}
