import React from 'react';
import PropTypes from 'prop-types';
import DropZone from '../../utils/DropZone';
import { chartRoles } from '../../utils/chartRoleConfig';
import './RolesPanel.css';

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

const DEFAULT_ALLOWED_BY_AXIS = {
  x: ['categorical', 'temporal'],
  y: ['numeric'],
};

const normalizeRole = (role) => {
  if (typeof role === 'string') {
    const axis = roleToAxis(role);
    return {
      role,
      axis,
      allowedTypes: DEFAULT_ALLOWED_BY_AXIS[axis],
      helperText: axis === 'y' ? 'Numeric value' : 'Category or date field',
    };
  }

  return {
    ...role,
    axis: role.axis || roleToAxis(role.role),
    allowedTypes: role.allowedTypes || DEFAULT_ALLOWED_BY_AXIS[roleToAxis(role.role)],
  };
};

function RolesPanel({ chartType, mapping }) {
  if (!chartType || !chartRoles[chartType]) return null;

  return (
    <div className="roles-panel-container">
      {chartRoles[chartType].map((roleConfig) => {
        const normalized = normalizeRole(roleConfig);
        const { role, axis, allowedTypes, helperText } = normalized;
        const current = mapping[role] || mapping[axis === 'x' ? 'X-Axis' : 'Y-Axis'];
        return (
          <div className="role-dropzone-wrapper" key={role}>
            <DropZone
              axis={axis}
              currentField={current}
              allowedTypes={allowedTypes}
              roleLabel={role}
              helperText={helperText}
            />
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
