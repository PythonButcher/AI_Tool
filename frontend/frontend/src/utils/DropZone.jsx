import React from 'react';
import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';

/**
 * DropZone
 * 
 * A refined droppable area that supports both raw field drops and semantic object drops.
 * Carries metadata for handleDragEnd in App.jsx to ensure reliable routing.
 */
const DropZone = ({ 
  id,
  axis, 
  currentField, 
  allowedTypes, 
  roleLabel, 
  helperText, 
  icon,
  targetChartId,
  semanticRole,
  dashboardItemId,
  dashboardRole,
  acceptedObjectKinds
}) => {
  // Use a unique ID for the droppable area, combining axis and targetChartId if available
  const droppableId = id || (targetChartId ? `drop-${targetChartId}-${axis}` : `${axis}-axis`);

  const { isOver, setNodeRef, active } = useDroppable({
    id: droppableId,
    data: { 
      axis, 
      allowedTypes,
      targetChartId,
      semanticRole,
      dashboardItemId,
      dashboardRole,
      acceptedObjectKinds
    },
  });

  const fallbackLabel = roleLabel || `${axis?.toUpperCase()} Axis`;
  const label = currentField || fallbackLabel;

  const activeData = active?.data?.current;
  const activeFieldType = activeData?.fieldType || activeData?.type;
  const activeObjectKind = activeData?.objectKind;

  const requiresValidation = allowedTypes && allowedTypes.length > 0;
  const isTypeCompatible = !requiresValidation || !activeFieldType || allowedTypes.includes(activeFieldType);
  
  const requiresKindValidation = acceptedObjectKinds && acceptedObjectKinds.length > 0;
  const isKindCompatible = !requiresKindValidation || !activeObjectKind || acceptedObjectKinds.includes(activeObjectKind);

  const isCompatible = isTypeCompatible && isKindCompatible;
  const isDraggingAny = !!active;

  const zoneState = [
    'drop-zone',
    isOver ? 'is-over' : '',
    currentField ? 'has-field' : 'is-empty',
    isDraggingAny && isCompatible ? 'is-compatible-hint' : '',
    isDraggingAny && !isCompatible ? 'is-incompatible-hint' : '',
    isOver && isCompatible ? 'is-compatible-match' : '',
    isOver && !isCompatible ? 'is-incompatible-match' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const compatibilityCopy =
    allowedTypes && allowedTypes.length ? `Accepts: ${allowedTypes.join(', ')}` : '';

  const emptyHelper = helperText || compatibilityCopy;

  return (
    <div ref={setNodeRef} className={zoneState}>
      {isDraggingAny && isCompatible && !isOver && (
        <div className="drop-zone-compatible-flash" />
      )}
      <div className="drop-zone-content">
        {icon && <div className="drop-zone-icon">{icon}</div>}
        <div className="drop-zone-label">{label}</div>
        {!currentField && emptyHelper && <div className="drop-zone-helper">{emptyHelper}</div>}
        {currentField && compatibilityCopy && (
          <div className="drop-zone-helper">{compatibilityCopy}</div>
        )}
      </div>
    </div>
  );
};

DropZone.propTypes = {
  id: PropTypes.string,
  axis: PropTypes.string.isRequired,
  currentField: PropTypes.string,
  allowedTypes: PropTypes.arrayOf(PropTypes.string),
  roleLabel: PropTypes.string,
  helperText: PropTypes.string,
  icon: PropTypes.node,
  targetChartId: PropTypes.string,
  semanticRole: PropTypes.string,
  dashboardItemId: PropTypes.string,
  dashboardRole: PropTypes.string,
  acceptedObjectKinds: PropTypes.arrayOf(PropTypes.string),
};

DropZone.defaultProps = {
  id: '',
  currentField: '',
  allowedTypes: undefined,
  roleLabel: '',
  helperText: '',
  icon: null,
  targetChartId: '',
  semanticRole: '',
  dashboardItemId: '',
  dashboardRole: '',
  acceptedObjectKinds: undefined,
};

export default DropZone;
