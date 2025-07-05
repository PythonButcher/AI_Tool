import PropTypes from 'prop-types';
import { useDrop } from 'react-dnd';

const DropZone = ({ axis, currentField, onFieldDrop }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'field',
    drop: (item) => onFieldDrop(item.id),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const label = currentField || `${axis.toUpperCase()} Axis`;

  return (
    <div ref={drop} className={`drop-zone ${isOver ? 'active' : ''}`}> 
      {label}
    </div>
  );
};



DropZone.propTypes = {
  axis: PropTypes.oneOf(['x', 'y']).isRequired,
  currentField: PropTypes.string,
  onFieldDrop: PropTypes.func.isRequired,
};

export default DropZone;
