import React from 'react';

// A deliberately small, safe Markdown subset. Text remains React text nodes;
// imported notes cannot inject HTML, scripts or executable links.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code>
        : part.startsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : part);
}
export default function AnalyticsNote({ text }) {
  return <div className="analytics-note">{String(text || '').split('\n').map((line, i) => {
    if (line.startsWith('### ')) return <h4 key={i}>{inline(line.slice(4))}</h4>;
    if (line.startsWith('## ')) return <h3 key={i}>{inline(line.slice(3))}</h3>;
    if (line.startsWith('# ')) return <h2 key={i}>{inline(line.slice(2))}</h2>;
    if (/^[-*] /.test(line)) return <div key={i}>• {inline(line.slice(2))}</div>;
    return <p key={i}>{inline(line) || '\u00a0'}</p>;
  })}</div>;
}
