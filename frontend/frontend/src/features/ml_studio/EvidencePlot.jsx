import React, { useState } from 'react';

export const metricText = value => Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumSignificantDigits: 4 }) : 'Unavailable';

export default function EvidencePlot({ evidence, title }) {
  if (!evidence) return null;
  if (evidence.kind === 'forecast') return <ForecastEvidence evidence={evidence} title={title} />;
  if (evidence.kind === 'clusters') return <ClusterEvidence evidence={evidence} title={title} />;
  if (evidence.kind === 'anomaly_scores') return <AnomalyEvidence evidence={evidence} title={title} />;
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

function ClusterEvidence({ evidence, title }) {
  const numeric = [...new Set(evidence.profiles.flatMap(profile => Object.keys(profile.numeric_means)))];
  const categorical = [...new Set(evidence.profiles.flatMap(profile => Object.keys(profile.categorical_modes)))];
  return <figure className="ml-evidence-figure"><figcaption>{title} · cluster profiles</figcaption><p>{evidence.partition}. Cluster IDs are arbitrary; these profiles describe groups, not predicted classes.</p>
    <div className="ml-cluster-sizes" aria-label="Cluster sizes">{evidence.profiles.map(profile => <div key={profile.cluster}><span>Cluster {profile.cluster}</span><meter min="0" max={evidence.total_rows} value={profile.rows} aria-label={`Cluster ${profile.cluster} row count`} /><strong>{profile.rows} rows</strong></div>)}</div>
    <div className="ml-table-scroll"><table><thead><tr><th>Cluster</th><th>Rows</th>{numeric.map(name => <th key={name}>{name} · mean</th>)}{categorical.map(name => <th key={name}>{name} · most common</th>)}</tr></thead><tbody>{evidence.profiles.map(profile => <tr key={profile.cluster}><th scope="row">{profile.cluster}</th><td>{profile.rows}</td>{numeric.map(name => <td key={name}>{metricText(profile.numeric_means[name])}</td>)}{categorical.map(name => <td key={name}>{profile.categorical_modes[name] ?? 'Unavailable'}</td>)}</tr>)}</tbody></table></div>
    <p>{evidence.distance}. {evidence.stability_method}</p>{evidence.valid_metric_folds && <p>Valid folds: {Object.entries(evidence.valid_metric_folds).map(([name, count]) => `${name.replaceAll('_', ' ')} ${count}`).join(' · ')}</p>}
  </figure>;
}

function AnomalyEvidence({ evidence, title }) {
  const maximum = Math.max(1, ...evidence.histogram.map(bin => bin.count));
  const width = 410 / evidence.histogram.length;
  return <figure className="ml-evidence-figure"><figcaption>{title} · anomaly score distribution</figcaption><p>{evidence.partition}. {evidence.interpretation}</p><div className="ml-final-metrics"><div><span>Flagged observations</span><strong>{evidence.flagged_rows} / {evidence.rows}</strong></div><div><span>Fitted threshold</span><strong>{metricText(evidence.selected_threshold)}</strong></div><div><span>Evaluation labels</span><strong>{evidence.labeled_rows || 'None'}</strong><small>{evidence.labeled_rows ? `${evidence.known_anomalies} known anomalies` : 'Detection accuracy unavailable'}</small></div></div>
    <svg viewBox="0 0 500 235" role="img" aria-label={`${title} anomaly scores: ${evidence.rows} observations, ${evidence.flagged_rows} flagged`}><line x1="55" x2="465" y1="195" y2="195" className="ml-plot-axis" />{evidence.histogram.map((bin, index) => <rect key={index} className="ml-score-bin" x={55 + index * width} y={195 - bin.count / maximum * 150} width={Math.max(1, width - 3)} height={bin.count / maximum * 150}><title>{metricText(bin.low)} to {metricText(bin.high)}: {bin.count} rows</title></rect>)}<text x="55" y="218">{metricText(evidence.histogram[0]?.low)}</text><text x="465" y="218" textAnchor="end">{metricText(evidence.histogram[evidence.histogram.length - 1]?.high)}</text></svg>
    <details><summary>Score bins and fitted thresholds</summary><div className="ml-table-scroll"><table><thead><tr><th>Score from</th><th>Score to</th><th>Rows</th></tr></thead><tbody>{evidence.histogram.map((bin, index) => <tr key={index}><td>{metricText(bin.low)}</td><td>{metricText(bin.high)}</td><td>{bin.count}</td></tr>)}</tbody></table></div><ul>{evidence.thresholds.map((threshold, index) => <li key={index}>{threshold.fold ? `Fold ${threshold.fold}` : 'Development fit'} · threshold {metricText(threshold.value)} · {threshold.training_rows} training rows · {metricText(threshold.training_flag_fraction * 100)}% training flags</li>)}</ul></details>
    {evidence.valid_metric_folds && <p>Valid folds: {Object.entries(evidence.valid_metric_folds).map(([name, count]) => `${name.replaceAll('_', ' ')} ${count}`).join(' · ')}</p>}
  </figure>;
}

function ForecastEvidence({ evidence, title }) {
  const series = [...new Set(evidence.points.map(point => point.series))];
  const [selectedSeries, setSelectedSeries] = useState(series[0]);
  const selected = series.includes(selectedSeries) ? selectedSeries : series[0];
  const points = evidence.points.filter(point => point.series === selected).sort((a, b) => a.time.localeCompare(b.time));
  if (!points.length) return null;
  const values = points.flatMap(point => [point.actual, point.predicted, point.baseline]);
  const low = Math.min(...values), high = Math.max(...values), spread = high - low || 1;
  const x = index => 55 + index / Math.max(1, points.length - 1) * 410;
  const y = value => 195 - (value - low) / spread * 155;
  const line = name => points.map((point, index) => `${x(index)},${y(point[name])}`).join(' ');
  return <figure className="ml-evidence-figure ml-forecast-figure"><div className="ml-section-heading"><figcaption>{title} · forecast horizon</figcaption>{series.length > 1 && <label>Evidence series<select value={selected} onChange={event => setSelectedSeries(event.target.value)}>{series.map(value => <option key={value}>{value}</option>)}</select></label>}</div><p>Actual observations, model forecasts and the last-observation baseline. Each forecast starts before its scored horizon; no prediction intervals are implied.</p><div className="ml-plot-legend"><span className="actual">Actual</span><span className="predicted">Forecast</span><span className="baseline">Naive baseline</span></div><svg viewBox="0 0 500 245" role="img" aria-label={`${title} forecast for ${selected}, ${points.length} displayed observations`}>
    <line x1="55" x2="55" y1="30" y2="200" className="ml-plot-axis" />
    {['baseline', 'actual', 'predicted'].map(name => <polyline key={name} className={`ml-forecast-line ${name}`} points={line(name)} />)}
    {points.map((point, index) => <circle key={`${point.time}-${index}`} cx={x(index)} cy={y(point.predicted)} r="3"><title>{point.time}: horizon {point.horizon}, forecast {metricText(point.predicted)}, actual {metricText(point.actual)}</title></circle>)}
    <text x="48" y="44" textAnchor="end">{metricText(high)}</text><text x="48" y="198" textAnchor="end">{metricText(low)}</text><text x="55" y="224">{points[0].time.slice(0, 10)}</text><text x="465" y="224" textAnchor="end">{points[points.length - 1].time.slice(0, 10)}</text>
  </svg><details><summary>Horizon values ({points.length} rows)</summary><div className="ml-table-scroll"><table><thead><tr><th>Time</th><th>Horizon</th><th>Actual</th><th>Forecast</th><th>Baseline</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><td>{point.time}</td><td>{point.horizon}</td><td>{metricText(point.actual)}</td><td>{metricText(point.predicted)}</td><td>{metricText(point.baseline)}</td></tr>)}</tbody></table></div></details>{evidence.seasonal_baseline_metrics && <p>Seasonal naive final RMSE: {metricText(evidence.seasonal_baseline_metrics.rmse)} · MAE: {metricText(evidence.seasonal_baseline_metrics.mae)}</p>}</figure>;
}
