import { memo } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import {
  FiCheck,
  FiX,
  FiLoader,
  FiSlash,
  FiZap,
  FiClock,
  FiCircle,
  FiAlertTriangle,
} from 'react-icons/fi';

/* ── Status configuration ─────────────────────────────────────────
   Each supported run state gets a unique color, icon, and label
   so differentiation never depends on color alone.
   ────────────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  idle: {
    label: 'Idle',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
    border: '#e2e8f0',
    Icon: FiCircle,
    animate: false,
  },
  queued: {
    label: 'Queued',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: '#bfdbfe',
    Icon: FiClock,
    animate: false,
  },
  running: {
    label: 'Running',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.10)',
    border: '#93c5fd',
    Icon: FiLoader,
    animate: true,
  },
  completed: {
    label: 'Completed',
    color: '#059669',
    bg: 'rgba(16,185,129,0.08)',
    border: '#6ee7b7',
    Icon: FiCheck,
    animate: false,
  },
  failed: {
    label: 'Failed',
    color: '#dc2626',
    bg: 'rgba(239,68,68,0.08)',
    border: '#fca5a5',
    Icon: FiX,
    animate: false,
  },
  cancel_requested: {
    label: 'Cancelling',
    color: '#d97706',
    bg: 'rgba(245,158,11,0.08)',
    border: '#fcd34d',
    Icon: FiSlash,
    animate: true,
  },
  cancelled: {
    label: 'Cancelled',
    color: '#d97706',
    bg: 'rgba(245,158,11,0.06)',
    border: '#fcd34d',
    Icon: FiSlash,
    animate: false,
  },
  interrupted: {
    label: 'Interrupted',
    color: '#ea580c',
    bg: 'rgba(249,115,22,0.08)',
    border: '#fdba74',
    Icon: FiZap,
    animate: false,
  },
  skipped: {
    label: 'Skipped',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.06)',
    border: '#e2e8f0',
    Icon: FiSlash,
    animate: false,
  },
};

/* ── Command-group accent colors ──────────────────────────────────
   The left accent stripe on each node is colored by its group.
   ────────────────────────────────────────────────────────────────── */
const GROUP_ACCENTS = {
  Prepare: '#10b981',
  Understand: '#3b82f6',
  Present: '#8b5cf6',
  Decide: '#f59e0b',
  Control: '#64748b',
};

const getGroupColor = (data) => {
  if (data.group && GROUP_ACCENTS[data.group]) return GROUP_ACCENTS[data.group];
  const cmd = data.command || '';
  if (cmd === '/clean') return GROUP_ACCENTS.Prepare;
  if (cmd === '/summary' || cmd === '/outliers') return GROUP_ACCENTS.Understand;
  if (cmd === '/charts') return GROUP_ACCENTS.Present;
  if (cmd === '/insights') return GROUP_ACCENTS.Decide;
  if (cmd === '/execute') return GROUP_ACCENTS.Control;
  return '#64748b';
};

const AiWorkLabNodeSizer = ({ data, selected }) => {
  const DataIcon = data.icon;
  const status = STATUS_CONFIG[data.status] || STATUS_CONFIG.idle;
  const StatusIcon = status.Icon;
  const groupColor = getGroupColor(data);
  const isActive = data.status === 'running' || data.status === 'cancel_requested';

  return (
    <div
      className={`wf-node-wrapper ${selected ? 'selected' : ''}`}
      style={{ position: 'relative' }}
    >
      <NodeResizer
        color={groupColor}
        isVisible={selected}
        minWidth={220}
        minHeight={110}
        lineStyle={{ strokeWidth: 2 }}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: groupColor,
          border: '2px solid #ffffff',
        }}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          width: '14px',
          height: '14px',
          left: '-7px',
          background: '#0c111d',
          border: `3px solid ${groupColor}`,
          borderRadius: '50%',
          zIndex: 10,
          transition: 'all 0.2s ease',
        }}
      />

      {/* Main card — glassmorphic surface with group accent stripe */}
      <div
        className="wf-node-card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          borderRadius: '14px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1.5px solid ${selected ? groupColor : isActive ? status.color : 'rgba(226,232,240,0.8)'}`,
          boxShadow: selected
            ? `0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px ${groupColor}40`
            : isActive
              ? `0 4px 20px ${status.color}25, 0 0 0 1px ${status.color}30`
              : '0 2px 8px rgba(0,0,0,0.06)',
          minWidth: '240px',
          overflow: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'grab',
          animation: isActive ? 'wf-glow 2s ease-in-out infinite' : 'none',
        }}
      >
        {/* Group accent stripe */}
        <div
          style={{
            width: '4px',
            minHeight: '100%',
            background: groupColor,
            flexShrink: 0,
          }}
        />

        {/* Card body */}
        <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Top row: icon + label + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Icon with status ring */}
            <div
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                flexShrink: 0,
              }}
            >
              {/* Status ring */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '10px',
                  border: `2px solid ${status.color}`,
                  background: status.bg,
                  transition: 'all 0.3s ease',
                  animation: status.animate ? 'wf-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
              {/* Icon */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: groupColor,
                }}
              >
                {DataIcon && <DataIcon size={18} />}
              </div>
            </div>

            {/* Label + command */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}
              >
                {data.label}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  letterSpacing: '0.02em',
                }}
              >
                {data.command}
              </div>
            </div>

            {/* Status badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: status.bg,
                color: status.color,
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                border: `1px solid ${status.color}20`,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                animation: status.animate ? 'wf-pulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              <StatusIcon
                size={10}
                style={{
                  animation: data.status === 'running' ? 'wf-spin 1s linear infinite' : 'none',
                }}
              />
              {status.label}
            </div>
          </div>

          {/* Description (clamped to 2 lines) */}
          {data.description && (
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {data.description}
            </div>
          )}

          {/* Error alert */}
          {data.error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '11px',
                color: '#dc2626',
                background: '#fef2f2',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                lineHeight: 1.4,
              }}
            >
              <FiAlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{data.error}</span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: '14px',
          height: '14px',
          right: '-7px',
          background: '#0c111d',
          border: `3px solid ${groupColor}`,
          borderRadius: '50%',
          zIndex: 10,
          transition: 'all 0.2s ease',
        }}
      />
    </div>
  );
};

export default memo(AiWorkLabNodeSizer);
