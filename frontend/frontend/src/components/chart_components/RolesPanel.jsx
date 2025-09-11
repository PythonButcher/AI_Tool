import React from 'react';
import PropTypes from 'prop-types';
import DropZone from '../../utils/DropZone';
import { chartRoles } from '../../utils/chartRoleConfig';
import '../css/chart_css/RolesPanel.css';

/**
 * Map a chart role label to its axis identifier.
 */
function roleToAxis(role) {
  switch (role) {
    case 'X-Axis':
      return 'x';
    case 'Y-Axis':
      return 'y';
    case 'Category':
      return 'x';
    case 'Value':
      return 'y';
    default:
      return 'x';
  }
}

function RolesPanel({ chartType, mapping }) {
  if (!chartType || !chartRoles[chartType]) return null;

  return (
    <div className="roles-panel-container">
      {chartRoles[chartType].map((role) => {
        const axis = roleToAxis(role);
        const current = mapping[role] || mapping[axis === 'x' ? 'X-Axis' : 'Y-Axis'];
        return (
          <div className="role-dropzone-wrapper" key={role}>
            <DropZone axis={axis} currentField={current} />
            <span className="role-label">{role}</span>
          </div>
        );
      })}
    </div>
  );
}

RolesPanel.propTypes = {
  chartType: PropTypes.string.isRequired,
  mapping: PropTypes.object.isRequired,
};

export default RolesPanel;
