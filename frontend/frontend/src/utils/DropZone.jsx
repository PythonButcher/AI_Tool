import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';

const DropZone = ({ axis, currentField }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `${axis}-axis` });

  const label = currentField || `${axis.toUpperCase()} Axis`;

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
