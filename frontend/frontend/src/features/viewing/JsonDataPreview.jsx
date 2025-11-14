// src/components/preview_components/JsonDataPreview.jsx
import React from 'react';
import { JsonViewer } from 'view-json-react';

function JsonDataPreview({ data }) {
  return (
    <div className="json-data-preview">
      <JsonViewer
        data={data}
        expandLevel={2}
        onCopy={(copyData) => console.log('Copied JSON:', copyData)}
        style={{ fontSize: '14px', color: '#383838' }}
      />
    </div>
  );
}

export default JsonDataPreview;
