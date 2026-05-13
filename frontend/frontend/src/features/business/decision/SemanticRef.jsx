import React from 'react';
import { Tooltip, Box, Typography, Chip } from '@mui/material';
import { 
  FaLink, FaCircleExclamation, FaTriangleExclamation,
  FaBullseye, FaGears, FaShieldHalved, FaLayerGroup, FaClock
} from 'react-icons/fa6';

/**
 * SemanticRef
 * 
 * A compact, high-fidelity renderer for Metric and Dimension references.
 * Supports Phase 2 semantic role strengthening fields: decision_semantics, 
 * binding confidence, reasons, sources, and warnings.
 */
const SemanticRef = ({ metric_ref, dimension_ref, type, compact = false }) => {
  const ref = metric_ref || dimension_ref;
  if (!ref) return null;

  const semantics = ref.decision_semantics;
  const confidence = ref.semantic_binding_confidence ?? ref.confidence ?? semantics?.confidence;
  const reason = ref.semantic_binding_reason || ref.reason || semantics?.confidence_reason;
  const warnings = [...(ref.semantic_role_warnings || []), ...(semantics?.unresolved_reasons || [])];
  const source = ref.semantic_role_source;
  const candidateLabels = ref.candidate_labels || [];

  const isUnresolved = type === 'unresolved' || source === 'unresolved' || (!ref.metric_id && !ref.dimension_id);

  // Confidence color mapping
  const getConfidenceColor = (c) => {
    if (c === undefined || c === null) return 'var(--text-secondary)';
    if (c >= 0.8) return 'var(--accent-green)';
    if (c >= 0.5) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const roleBadges = [];
  if (semantics) {
    if (semantics.objective_candidate) roleBadges.push({ label: 'OBJ', icon: <FaBullseye />, color: 'var(--text-primary)' });
    if (semantics.lever_candidate) roleBadges.push({ label: 'LVR', icon: <FaGears />, color: 'var(--text-primary)' });
    if (semantics.guardrail_candidate) roleBadges.push({ label: 'GRD', icon: <FaShieldHalved />, color: 'var(--text-primary)' });
    if (semantics.segment_candidate) roleBadges.push({ label: 'SEG', icon: <FaLayerGroup />, color: 'var(--text-primary)' });
    if (semantics.temporal_candidate) roleBadges.push({ label: 'TMP', icon: <FaClock />, color: 'var(--text-primary)' });
  }

  const renderTooltipContent = () => (
    <Box sx={{ p: 1, maxWidth: 300 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
        {ref.label || ref.name || 'Semantic Reference'}
      </Typography>
      
      {confidence !== undefined && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
          <strong>Confidence:</strong> {(confidence * 100).toFixed(0)}%
          <span style={{ 
            display: 'inline-block', 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            marginLeft: 8, 
            backgroundColor: getConfidenceColor(confidence) 
          }} />
        </Typography>
      )}

      {reason && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.9 }}>
          <strong>Evidence:</strong> {reason}
        </Typography>
      )}

      {source && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.7, fontStyle: 'italic' }}>
          Source: {source.replace('_', ' ')}
        </Typography>
      )}

      {candidateLabels.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, opacity: 0.6, fontSize: '0.65rem', textTransform: 'uppercase' }}>
            Candidates:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {candidateLabels.map((l, i) => (
              <Chip key={i} label={l} size="small" sx={{ height: 16, fontSize: '0.6rem', opacity: 0.8 }} />
            ))}
          </Box>
        </Box>
      )}

      {warnings.length > 0 && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {warnings.map((w, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fca5a5', mb: 0.5 }}>
              <FaTriangleExclamation fontSize="0.7rem" /> {w}
            </Typography>
          ))}
        </Box>
      )}

      {semantics?.business_terms?.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {semantics.business_terms.map((term, i) => (
            <Chip key={i} label={term} size="small" sx={{ height: 16, fontSize: '0.6rem', opacity: 0.6 }} />
          ))}
        </Box>
      )}
    </Box>
  );

  if (isUnresolved) {
    return (
      <Tooltip title={renderTooltipContent()} arrow>
        <div className="semantic-ref is-unresolved">
          <FaCircleExclamation className="ref-icon" />
          <span className="ref-label">{ref.label || ref.name || 'Unresolved mapping'}</span>
          {warnings.length > 0 && <span className="ref-warning-dot" />}
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={renderTooltipContent()} arrow>
      <div className={`semantic-ref ${compact ? 'is-compact' : ''} type--${type}`}>
        <div className="ref-main">
          <FaLink className="ref-icon" />
          <span className="ref-label">{ref.label}</span>
          
          {confidence !== undefined && (
            <div className="ref-confidence" style={{ color: getConfidenceColor(confidence) }}>
              {(confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>

        {roleBadges.length > 0 && !compact && (
          <div className="ref-badges">
            {roleBadges.map((badge, i) => (
              <span key={i} className="role-badge" title={badge.label}>
                {badge.icon}
              </span>
            ))}
          </div>
        )}
        
        {warnings.length > 0 && <FaTriangleExclamation className="ref-warning-icon" />}
      </div>
    </Tooltip>
  );
};

export default SemanticRef;
