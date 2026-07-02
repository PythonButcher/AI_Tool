import React, { useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useWindowContext } from '../../context/WindowContext';
import { DataContext } from '../../context/DataContext';
import DashboardCanvasItem from './DashboardCanvasItem';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './DashboardCanvas.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

function DashboardCanvas() {
  const { dashboardState, dashboardItems, updateDashboardItemLayout } = useWindowContext();
  const { cleanedData, fullData } = React.useContext(DataContext);

  const isEditMode = dashboardState.mode === 'edit';
  const canvasConfig = dashboardState.canvas;

  // Generate layout configuration for react-grid-layout
  const layout = useMemo(() => {
    return dashboardItems.map((item) => ({
      i: item.id,
      x: item.layout.x,
      y: item.layout.y,
      w: item.layout.w,
      h: item.layout.h,
      minW: item.layout.minW,
      minH: item.layout.minH,
      maxW: item.layout.maxW,
      maxH: item.layout.maxH,
      static: item.locked || !isEditMode, // Lock in view mode or if item is explicitly locked
    }));
  }, [dashboardItems, isEditMode]);

  const onLayoutChange = (currentLayout) => {
    currentLayout.forEach((l) => {
      // Only update if something actually changed to avoid unnecessary re-renders
      const item = dashboardItems.find((di) => di.id === l.i);
      if (item && (item.layout.x !== l.x || item.layout.y !== l.y || item.layout.w !== l.w || item.layout.h !== l.h)) {
        updateDashboardItemLayout(l.i, { x: l.x, y: l.y, w: l.w, h: l.h });
      }
    });
  };

  const hasItems = dashboardItems.length > 0;

  return (
    <div className={`dashboard-canvas-container ${isEditMode ? 'is-edit-mode' : 'is-view-mode'}`}>
      {!hasItems ? (
        <div className="dashboard-canvas__empty">
          <p>Your dashboard is empty.</p>
          <p className="dashboard-canvas__empty-sub">
            Add a Chart or KPI from the command bar, or pin visuals from the AI Chat and Explorer.
          </p>
        </div>
      ) : (
        <ResponsiveGridLayout
          className="dashboard-canvas"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: canvasConfig.columns, md: canvasConfig.columns, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={canvasConfig.rowHeight}
          margin={canvasConfig.margin}
          containerPadding={canvasConfig.containerPadding}
          compactType={canvasConfig.compactType}
          preventCollision={canvasConfig.preventCollision}
          onLayoutChange={onLayoutChange}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".dashboard-canvas-item__drag-handle"
        >
          {dashboardItems.map((item) => (
            <div key={item.id}>
              <DashboardCanvasItem
                item={item}
                cleanedData={cleanedData}
                uploadedData={fullData}
                dashboardFilters={dashboardState.filters}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}

export default DashboardCanvas;
