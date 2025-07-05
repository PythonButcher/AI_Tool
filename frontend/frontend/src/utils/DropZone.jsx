import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';

const DropZone = ({ axis, currentField }) => {
  const safeAxis = axis || '';
  const { isOver, setNodeRef } = useDroppable({ id: `${safeAxis}-axis` });

  const label = currentField || `${safeAxis.toUpperCase()} Axis`;

  return (
    <div ref={setNodeRef} className={`drop-zone ${isOver ? 'active' : ''}`}>
      {label}
    </div>
  );
};



DropZone.propTypes = {
  axis: PropTypes.oneOf(['x', 'y']).isRequired,
  currentField: PropTypes.string,
};

export default DropZone;
