import { useEffect } from "react";
import PropTypes from 'prop-types';
import { useDroppable } from '@dnd-kit/core';

// DropZone accepts items by matching this `id` with the active drag id
const DropZone = ({ id, label, onDrop }) => {
    const { isOver, setNodeRef } = useDroppable({ id }); // ✅ use real ID passed from props

    useEffect(() => {
        if (isOver) {
            console.log(`🟢 ENTERED DropZone (${id})`);
        } else {
            console.log(`🔴 LEFT DropZone (${id})`);
        }
    }, [isOver, id]);

    return (
        <div
            ref={setNodeRef}
            style={{
                backgroundColor: isOver ? 'rgba(144, 238, 144, 0.5)' : 'white',
                padding: '20px',
                margin: '10px',
                transition: 'background-color 0.3s ease-in-out',
                border: '2px dashed #ccc',
                borderRadius: '8px',
            }}
        >
            <p style={{ textAlign: 'center', fontWeight: 'bold' }}>
                {label || `Drop here: ${id}`}
            </p>
        </div>
    );
};



DropZone.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    onDrop: PropTypes.func,
};

export default DropZone;
