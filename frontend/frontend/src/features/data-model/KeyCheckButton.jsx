import React, { useEffect, useRef, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function KeyCheckButton({ endpoint, payload, disabled, className, children }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function check() {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'The key check failed.');
      if (!controller.signal.aborted) setResult(body);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'The key check failed.');
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <>
      <div>
        <button type="button" className={className} onClick={check} disabled={disabled || loading}>
          Check keys
        </button>
      </div>
      {loading && <p role="status">Checking keys…</p>}
      {error && <p role="alert">{error}</p>}
      {result && <div aria-live="polite">{children(result)}</div>}
    </>
  );
}

export function KeyIssueRows({ issues, issueCount }) {
  if (!issues?.length) return null;
  return (
    <details>
      <summary>{issues.length < issueCount ? `First ${issues.length} rows with issues` : 'Rows with issues'}</summary>
      <ul>
        {issues.map(({ row_number, reason }) => (
          <li key={row_number}>
            Row {row_number} · {reason === 'missing_or_unsupported' ? 'Blank or unsupported key'
              : reason === 'missing' ? 'Missing key' : 'Repeated key'}
          </li>
        ))}
      </ul>
    </details>
  );
}
