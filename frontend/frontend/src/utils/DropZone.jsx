import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';

const DropZone = ({ axis, currentField, allowedTypes, roleLabel, helperText }) => {
  const safeAxis = axis || '';
  const { isOver, setNodeRef, active } = useDroppable({
    id: `${safeAxis}-axis`,
    data: { axis: safeAxis, allowedTypes },
  });

  const fallbackLabel = roleLabel || `${safeAxis.toUpperCase()} Axis`;
  const label = currentField || fallbackLabel;

  const activeFieldType = active?.data?.current?.fieldType;
  const requiresValidation = allowedTypes && allowedTypes.length > 0;
  const isCompatible = !requiresValidation || !activeFieldType || allowedTypes.includes(activeFieldType);

  const zoneState = [
    'drop-zone',
    isOver ? 'is-over' : '',
    currentField ? 'has-field' : 'is-empty',
    isCompatible ? 'is-compatible' : 'is-incompatible',
  ]
    .filter(Boolean)
    .join(' ');

  const compatibilityCopy =
    allowedTypes && allowedTypes.length ? `Accepts: ${allowedTypes.join(', ')}` : '';

  const emptyHelper = helperText || compatibilityCopy;

  return (
    <div ref={setNodeRef} className={zoneState}>
      <div className="drop-zone-label">{label}</div>
      {!currentField && emptyHelper && <div className="drop-zone-helper">{emptyHelper}</div>}
      {currentField && compatibilityCopy && (
        <div className="drop-zone-helper">{compatibilityCopy}</div>
      )}
    </div>
  );
};

DropZone.propTypes = {
  axis: PropTypes.oneOf(['x', 'y']).isRequired,
  currentField: PropTypes.string,
  allowedTypes: PropTypes.arrayOf(PropTypes.string),
  roleLabel: PropTypes.string,
  helperText: PropTypes.string,
};

DropZone.defaultProps = {
  currentField: '',
  allowedTypes: undefined,
  roleLabel: '',
  helperText: '',
};

export default DropZone;
