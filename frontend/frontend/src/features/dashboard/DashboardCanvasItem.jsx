import React from 'react';
import { useWindowContext } from '../../context/WindowContext';
import { FaLock, FaUnlock, FaTrash, FaCopy } from 'react-icons/fa';
import './DashboardCanvasItem.css';
import SmartChartWindow from '../charts/SmartChartWindow';
import KpiCardWindow from './KpiCardWindow';

const DashboardCanvasItem = React.forwardRef(({
  style,
  className,
  onMouseDown,
  onMouseUp,
  onTouchEnd,
  children,
  item,
  cleanedData,
  uploadedData,
  dashboardFilters,
  ...props
}, ref) => {
  const { dashboardState, removeDashboardItem, toggleDashboardItemLock } = useWindowContext();
  const isEditMode = dashboardState.mode === 'edit';
  const isLocked = item.locked;

  // Render the inner content based on itemType
  const renderInnerContent = () => {
    if (item.itemType === 'kpi') {
      return (
        <KpiCardWindow
          id={item.id}
          item={item}
          dashboardFilters={dashboardFilters}
          isLocked={isLocked || !isEditMode}
        />
      );
    }
    return (
      <SmartChartWindow
        id={item.id}
        data={cleanedData || uploadedData}
        type={item.chartType}
        mapping={item.mapping}
        isLocked={isLocked || !isEditMode}
        dataSourceMode={item.dataSourceMode}
        semanticConfig={item.semanticConfig}
        externalFilters={dashboardFilters}
        display={item.display}
      />
    );
  };

  return (
    <div
      style={{ ...style }}
      className={`dashboard-canvas-item ${className || ''} ${isEditMode ? 'is-edit-mode' : 'is-view-mode'} ${isLocked ? 'is-locked' : ''}`}
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchEnd={onTouchEnd}
      {...props}
    >
      {isEditMode && (
        <div className="dashboard-canvas-item__chrome">
          <div className="dashboard-canvas-item__drag-handle">
            <span className="dashboard-canvas-item__title">{item.title || (item.itemType === 'kpi' ? 'KPI Card' : 'Chart')}</span>
          </div>
          <div className="dashboard-canvas-item__actions">
            <button
              className={`dashboard-canvas-item__btn ${isLocked ? 'is-locked-btn' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleDashboardItemLock(item.id); }}
              title={isLocked ? "Unlock item" : "Lock item"}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isLocked ? <FaLock size={12} /> : <FaUnlock size={12} />}
            </button>
            <button
              className="dashboard-canvas-item__btn dashboard-canvas-item__btn--danger"
              onClick={(e) => { e.stopPropagation(); removeDashboardItem(item.id); }}
              title="Remove from dashboard"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <FaTrash size={12} />
            </button>
          </div>
        </div>
      )}
      <div className="dashboard-canvas-item__content">
        {renderInnerContent()}
      </div>
      {children /* For react-grid-layout resize handle */}
    </div>
  );
});

export default DashboardCanvasItem;
