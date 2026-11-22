import React, { useLayoutEffect, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { TbAdjustments, TbChartBar, TbCheck, TbDatabase, TbGripVertical, TbLayoutDashboard, TbLock, TbLockOpen, TbRotateClockwise } from 'react-icons/tb';
import {
  applyWorkbenchGrid, defaultWorkbenchLayout, nudgeWorkbenchPanel, readWorkbenchLayout, workbenchOrder,
  WORKBENCH_COLUMNS, WORKBENCH_LAYOUT_KEY, WORKBENCH_MAX_HEIGHT, WORKBENCH_MIN_HEIGHT, WORKBENCH_PANELS, WORKBENCH_ROWS,
} from './analyticsWorkbenchLayout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './AnalyticsWorkbench.css';

const MIN_EDIT_WIDTH = 1060;
const ROW_HEIGHT = 27;
const GUTTER = 10;
const CELL_Y = ROW_HEIGHT + GUTTER;
const MARGIN = [GUTTER, GUTTER];
const PADDING = [0, 0];
const HANDLES = ['e', 's', 'se'];
const PANEL_ICONS = { fields: TbDatabase, builder: TbAdjustments, results: TbChartBar };
const ARROW_STEPS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export default function AnalyticsWorkbench({ fields, builder, results, fieldDetails, fieldActions }) {
  const container = useRef(null);
  const keyboardGrip = useRef(null);
  const [width, setWidth] = useState(0);
  const [layout, setLayout] = useState(readWorkbenchLayout);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const stacked = width < MIN_EDIT_WIDTH;
  const canEdit = editing && !stacked;
  const contents = { fields, builder, results };
  const ordered = [...layout].sort(workbenchOrder);

  useLayoutEffect(() => {
    const element = container.current;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    keyboardGrip.current?.focus({ preventScroll: true });
    keyboardGrip.current = null;
  }, [layout]);

  function commit(next, message = '') {
    setLayout(next);
    try {
      window.localStorage.setItem(WORKBENCH_LAYOUT_KEY, JSON.stringify(next));
      setFeedback(message);
    } catch {
      setFeedback('The layout is active for this session. This browser could not save it.');
    }
  }

  function moveWithKeys(event, panel) {
    const step = ARROW_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    const next = nudgeWorkbenchPanel(layout, panel.id, ...step, event.shiftKey);
    if (!next) {
      setFeedback(`${panel.title} has no room in that direction.`);
      return;
    }
    const position = next.find(item => item.i === panel.id);
    keyboardGrip.current = event.currentTarget;
    commit(next, event.shiftKey ? `${panel.title} resized to ${position.w} by ${position.h}.` :
      `${panel.title} moved to column ${position.x + 1}, row ${position.y + 1}.`);
  }

  const grid = layout.map((item, index) => ({
    i: item.i, x: item.x, y: item.y, w: item.w, h: item.h, static: item.locked,
    minW: WORKBENCH_PANELS[index].minWidth, minH: WORKBENCH_MIN_HEIGHT, maxH: WORKBENCH_MAX_HEIGHT,
  }));
  const saveGrid = next => commit(applyWorkbenchGrid(layout, next));

  return <div ref={container} className={`analytics-workbench${stacked ? ' analytics-workbench--stacked' : ''}${canEdit ? ' is-editing' : ''}`}>
    <div className="analytics-workbench-toolbar">
      <span className="analytics-workbench-context"><TbLayoutDashboard aria-hidden="true" /> Workspace layout</span>
      {canEdit && <span className="analytics-workbench-instructions">Drag the grips to move panels. Pull an edge to resize.</span>}
      <div className="analytics-workbench-tools">
        {canEdit && <button type="button" title="Restore default sizes and positions and unlock panels" onClick={() => commit(defaultWorkbenchLayout(), 'Default workspace layout restored.')}>
          <TbRotateClockwise aria-hidden="true" /> Reset layout
        </button>}
        <button type="button" className={canEdit ? 'is-primary' : ''} disabled={stacked}
          title={stacked ? 'Widen the workspace to arrange panels' : undefined}
          onClick={() => { setEditing(value => !value); setFeedback(''); }}>
          {canEdit ? <TbCheck aria-hidden="true" /> : <TbLayoutDashboard aria-hidden="true" />}
          {canEdit ? 'Done' : 'Edit layout'}
        </button>
      </div>
    </div>
    {stacked && width > 0 && <p className="analytics-workbench-compact-hint">Widen the workspace to arrange panels.</p>}
    <span className="analytics-workbench-announcement" aria-live="polite">{feedback}</span>
    <GridLayout className="analytics-workbench-grid" layout={grid} width={Math.max(width, MIN_EDIT_WIDTH)} cols={WORKBENCH_COLUMNS}
      rowHeight={ROW_HEIGHT} maxRows={WORKBENCH_ROWS} margin={MARGIN} containerPadding={PADDING} compactType={null} preventCollision
      isDraggable={canEdit} isResizable={canEdit} draggableHandle=".analytics-workbench-grip" resizeHandles={HANDLES}
      style={{ '--analytics-workbench-step-x': `${(width + GUTTER) / WORKBENCH_COLUMNS}px`, '--analytics-workbench-step-y': `${CELL_Y}px` }}
      onDragStop={saveGrid} onResizeStop={saveGrid}>
      {ordered.map((item, index) => {
        const panel = WORKBENCH_PANELS.find(entry => entry.id === item.i);
        const Icon = PANEL_ICONS[item.i];
        const Lock = item.locked ? TbLock : TbLockOpen;
        const isFields = item.i === 'fields';
        const lockAction = `${item.locked ? 'Unlock' : 'Lock'} ${panel.title} layout`;
        return <section key={item.i} aria-label={isFields ? 'Dataset fields' : panel.title}
          className={`analytics-workbench-panel analytics-workbench-panel--${item.i}${item.locked ? ' is-locked' : ''}`}
          style={{ '--analytics-panel-order': index }}>
          <header className="analytics-workbench-panel-header">
            {canEdit && !item.locked && <button type="button" className="analytics-workbench-grip" aria-label={`Move or resize ${panel.title}`}
              title="Drag to move. Use arrows to move or Shift + arrows to resize." onKeyDown={event => moveWithKeys(event, panel)}>
              <TbGripVertical aria-hidden="true" />
            </button>}
            <Icon className="analytics-workbench-panel-icon" aria-hidden="true" />
            <div className="analytics-workbench-panel-name"><h2>{panel.title}</h2>{isFields && <small>{fieldDetails}</small>}</div>
            {isFields && fieldActions}
            {canEdit && <button type="button" className="analytics-workbench-lock" aria-label={lockAction} title={lockAction}
              onClick={() => commit(layout.map(entry => entry.i === item.i ? { ...entry, locked: !entry.locked } : entry),
                `${panel.title} ${item.locked ? 'unlocked' : 'locked'}.`)}><Lock aria-hidden="true" /></button>}
            {!canEdit && item.locked && <span className="analytics-workbench-locked-mark" title={`${panel.title} layout locked`} aria-label={`${panel.title} layout locked`} role="img"><TbLock /></span>}
          </header>
          <div className="analytics-workbench-panel-body" tabIndex={stacked ? undefined : 0} role="group" aria-label={`${panel.title} content`}>{contents[item.i]}</div>
        </section>;
      })}
    </GridLayout>
  </div>;
}
