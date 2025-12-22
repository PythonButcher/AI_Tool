import React, { useState, useMemo, useCallback } from 'react';
import { useDndMonitor, useDroppable } from '@dnd-kit/core';
import ChartComponent from './ChartComponent';
import { transformToChartData } from '../../utils/chartDataUtils';
import { TbChartBar, TbChartDots, TbChartLine, TbChartPie, TbChartDonut } from 'react-icons/tb';
import { IoAddCircleOutline } from 'react-icons/io5';

/**
 * A self-contained "Smart" window that manages a single chart's state.
 * It acts as a drop target listener to reveal overlay zones when dragging starts.
 */
const SmartChartWindow = ({
    id,
    data,
    initialType = 'Bar',
    initialMapping = {},
    onRemove,
    isLocked
}) => {
    const [chartType, setChartType] = useState(initialType);
    const [mapping, setMapping] = useState(initialMapping); // { 'X-Axis': 'field', 'Y-Axis': 'field', ... }
    const [isGlobalDragging, setIsGlobalDragging] = useState(false);

    // Monitor global drag state to reveal drop zones
    useDndMonitor({
        onDragStart: (event) => {
            if (event.active?.data?.current?.type === 'field') {
                setIsGlobalDragging(true);
            }
        },
        onDragEnd: () => {
            setIsGlobalDragging(false);
        },
        onDragCancel: () => {
            setIsGlobalDragging(false);
        },
    });

    const handleDrop = useCallback((axis, fieldName) => {
        setMapping((prev) => ({
            ...prev,
            [axis]: fieldName,
        }));
    }, []);

    // Compute chart data locally for this specific window
    const chartData = useMemo(() => {
        if (!data || !mapping['X-Axis'] || !mapping['Y-Axis']) return null;

        return transformToChartData(data, {
            labelField: mapping['X-Axis'],
            dataFields: [mapping['Y-Axis']],
        });
    }, [data, mapping]);

    // DropZone Sub-component (Extracted for stability)
    const OverlayDropZone = ({ id, axis, label, style, currentMapping }) => {
        const { setNodeRef, isOver } = useDroppable({
            id: `chart-${id}-${axis}`,
            data: {
                targetChartId: id,
                axis: axis === 'X-Axis' ? 'x' : 'y',
                allowedTypes: axis === 'Y-Axis' ? ['numeric'] : ['categorical', 'temporal']
            },
        });

        return (
            <div
                ref={setNodeRef}
                style={{
                    ...style,
                    position: 'absolute',
                    backgroundColor: isOver ? 'rgba(52, 168, 83, 0.2)' : 'rgba(255, 255, 255, 0.85)',
                    border: isOver ? '2px dashed #34a853' : '1px dashed #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    zIndex: 10,
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '8px',
                    color: isOver ? '#1e4620' : '#555',
                    pointerEvents: 'all' // ensure it catches drops
                }}
            >
                <span style={{ fontWeight: 600 }}>{label}</span>
                {currentMapping && (
                    <span style={{ fontSize: '0.8em', marginTop: '4px', padding: '2px 6px', background: '#e0e0e0', borderRadius: '4px' }}>
                        {currentMapping}
                    </span>
                )}
            </div>
        );
    };

    const isEmpty = !chartData;

    const renderToolbar = () => (
        <div style={{
            display: 'flex',
            gap: '8px',
            padding: '8px',
            background: '#f8f9fa',
            borderBottom: '1px solid #eee',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', gap: '4px' }}>
                {[
                    { type: 'Bar', icon: <TbChartBar /> },
                    { type: 'Line', icon: <TbChartLine /> },
                    { type: 'Pie', icon: <TbChartPie /> },
                    { type: 'Scatter', icon: <TbChartDots /> },
                    { type: 'Doughnut', icon: <TbChartDonut /> }
                ].map(t => (
                    <button
                        key={t.type}
                        onClick={() => setChartType(t.type)}
                        className={chartType === t.type ? 'active' : ''}
                        style={{
                            padding: '6px',
                            border: 'none',
                            background: chartType === t.type ? '#e8f0fe' : 'transparent',
                            color: chartType === t.type ? '#1a73e8' : '#666',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex'
                        }}
                        title={t.type}
                    >
                        {t.icon}
                    </button>
                ))}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                {isEmpty ? 'Draft' : `${chartType} Chart`}
            </div>
        </div>
    );

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            background: '#fff',
            overflow: 'hidden'
        }}>
            {renderToolbar()}

            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {/* Actual Chart */}
                {!isEmpty && (
                    <ChartComponent chartType={chartType} chartData={chartData} />
                )}

                {/* Empty State / Call to Action */}
                {isEmpty && !isGlobalDragging && (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#aaa',
                        gap: '12px'
                    }}>
                        <IoAddCircleOutline size={48} />
                        <p>Drag fields here to build a chart</p>
                    </div>
                )}

                {/* Interaction Zones - Only visible when dragging */}
                {isGlobalDragging && (
                    <>
                        {/* Y-Axis Zone (Left or Top) */}
                        <OverlayDropZone
                            id={id}
                            axis="Y-Axis"
                            label="Y-Axis (Values)"
                            style={{ top: '10px', bottom: '50%', left: '10px', right: '10px' }}
                            currentMapping={mapping['Y-Axis']}
                        />
                        {/* X-Axis Zone (Bottom) */}
                        <OverlayDropZone
                            id={id}
                            axis="X-Axis"
                            label="X-Axis (Categories)"
                            style={{ top: '50%', bottom: '10px', left: '10px', right: '10px' }}
                            currentMapping={mapping['X-Axis']}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default SmartChartWindow;
