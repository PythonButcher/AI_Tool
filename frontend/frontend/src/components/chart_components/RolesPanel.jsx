import React from 'react';
import PropTypes from 'prop-types';
import DropZone from '../../utils/DropZone';
import { chartRoles } from '../../utils/chartRoleConfig';
import '../css/chart_css/RolesPanel.css'; // Optional: use this if you want specific styling

function RolesPanel({ chartType, mapping, setMapping }) {
  if (!chartType || !chartRoles[chartType]) return null;

  return (
    <div className="roles-panel-container">
      {chartRoles[chartType].map((role) => (
        <div className="role-dropzone-wrapper" key={role}>
          <DropZone
            id={role}
            label={`${role}: ${mapping[role] || 'Drop field'}`}
            onDrop={(field) => setMapping({ ...mapping, [role]: field })}
          />
        </div>
      ))}
    </div>
  );
}

RolesPanel.propTypes = {
  chartType: PropTypes.string.isRequired,
  mapping: PropTypes.object.isRequired,
  setMapping: PropTypes.func.isRequired,
};

export default RolesPanel;
