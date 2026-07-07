import React from 'react';
import { Typography, Button, Tooltip, Chip, TextField } from '@mui/material';
import {
  FaShieldAlt, FaCheckCircle, FaExclamationTriangle, FaEye, FaDatabase,
  FaInfoCircle, FaTools, FaSearch, FaLayerGroup, FaCircle
} from 'react-icons/fa';
import SemanticRef from '../business/decision/SemanticRef';
import ScenarioPreview from '../business/decision/ScenarioPreview';
import DecisionCommandCenter from './DecisionCommandCenter';

export default function DecisionOutputReview({
  artifact,
  isInspector,
  contextActions,
  contextSessionState,
  contextCapabilityState,
  contextDecisionReadiness,
  renderArtifactExportBar,
  handleExportArtifactPdf,
  fullscreenAsset,
  setFullscreenAsset,
  saveTitle,
  setSaveTitle,
  handleSaveAsset,
  savingAsset,
  saveSuccess,
  saveError,
  loading,
  handleActionClick,
  onOpenDecisionGraph,
  hasData,
  datasetContext,
  semanticModel,
  correctionPanelOpen,
  setCorrectionPanelOpen,
  correctionType,
  setCorrectionType,
  correctionTargetPath,
  setCorrectionTargetPath,
  correctionReplacement,
  setCorrectionReplacement,
  correctionReason,
  setCorrectionReason,
  handleCorrectionSubmit,
  resolveDatasetForNlp
}) {
  const baseClass = isInspector ? "ai-shell__active-artifact" : "ai-shell__artifact-preview-card";
  const lookupSessionState = contextSessionState;
  const lookupCapabilityState = contextCapabilityState;
  const lookupDecisionReadiness = contextDecisionReadiness;
  const lookupActions = contextActions || [];

  const doTitle = artifact.title || artifact.content?.title || 'Decision Framework';
  const doSummary = artifact.summary || artifact.content?.summary || '';
  const doDt = artifact.dataset_trust || artifact.content?.dataset_trust;
  const doFrame = artifact.frame || artifact.content?.frame;
  const doReadiness = artifact.readiness || artifact.content?.readiness || lookupDecisionReadiness;
  const doCorrection = artifact.correction_state || artifact.content?.correction_state;
  const doEvidence = artifact.evidence_board || artifact.content?.evidence_board;
  const doMap = artifact.decision_map || artifact.content?.decision_map;
  const doScenario = artifact.scenario_compare || artifact.content?.scenario_compare;
  const doGates = artifact.advanced_gates || artifact.content?.advanced_gates || [];
  const doTruthBoundary = artifact.truth_boundary || artifact.content?.truth_boundary || 'observational_analysis_only';
  const doCommandCenter = artifact.command_center || artifact.content?.command_center;

  // Helper to format object arrays into SemanticRef components
  const renderSemanticList = (items, type) => {
    if (!Array.isArray(items) || items.length === 0) return <Typography variant="body2" sx={{ opacity: 0.5 }}>Not specified</Typography>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '12px', borderLeft: '2px solid var(--text-primary)' }}>
        {items.map((item, i) => {
          const metricRef = item.metric_ref || (type === 'lever' && item.binding?.binding_type === 'metric' ? item.binding.metric_ref : null);
          const dimensionRef = item.dimension_ref || (type === 'lever' && item.binding?.binding_type === 'dimension' ? item.binding.dimension_ref : null);

          if (metricRef?.metric_id || dimensionRef?.dimension_id) {
            return <SemanticRef key={i} metric_ref={metricRef} dimension_ref={dimensionRef} type={type} compact />;
          }

          const fallbackLabel = item.label || item.binding_label || item.metric || item.dimension_id || item.field || item.strings || (typeof item === 'string' ? item : 'Unbound item');
          const fallbackRef = { label: fallbackLabel };

          return (
            <SemanticRef
              key={i}
              metric_ref={type !== 'segment' ? fallbackRef : null}
              dimension_ref={type === 'segment' ? fallbackRef : null}
              type={type}
              compact
            />
          );
        })}
      </div>
    );
  };

  if (doCommandCenter) {
    return (
      <DecisionCommandCenter
        artifact={artifact}
        isInspector={isInspector}
        baseClass={baseClass}
        doCommandCenter={doCommandCenter}
        doTitle={doTitle}
        doSummary={doSummary}
        doDt={doDt}
        doFrame={doFrame}
        doReadiness={doReadiness}
        doCorrection={doCorrection}
        doEvidence={doEvidence}
        doMap={doMap}
        doScenario={doScenario}
        doGates={doGates}
        doTruthBoundary={doTruthBoundary}
        renderSemanticList={renderSemanticList}
        renderArtifactExportBar={renderArtifactExportBar}
        handleExportArtifactPdf={handleExportArtifactPdf}
        contextActions={contextActions}
        contextSessionState={contextSessionState}
        contextCapabilityState={contextCapabilityState}
        contextDecisionReadiness={contextDecisionReadiness}
        fullscreenAsset={fullscreenAsset}
        setFullscreenAsset={setFullscreenAsset}
        saveTitle={saveTitle}
        setSaveTitle={setSaveTitle}
        handleSaveAsset={handleSaveAsset}
        savingAsset={savingAsset}
        saveSuccess={saveSuccess}
        saveError={saveError}
        loading={loading}
        handleActionClick={handleActionClick}
        onOpenDecisionGraph={onOpenDecisionGraph}
        hasData={hasData}
        datasetContext={datasetContext}
        semanticModel={semanticModel}
        correctionPanelOpen={correctionPanelOpen}
        setCorrectionPanelOpen={setCorrectionPanelOpen}
        correctionType={correctionType}
        setCorrectionType={setCorrectionType}
        correctionTargetPath={correctionTargetPath}
        setCorrectionTargetPath={setCorrectionTargetPath}
        correctionReplacement={correctionReplacement}
        setCorrectionReplacement={setCorrectionReplacement}
        correctionReason={correctionReason}
        setCorrectionReason={setCorrectionReason}
        handleCorrectionSubmit={handleCorrectionSubmit}
      />
    );
  }

  return (
    <div className={`${baseClass} is-decision-output decision-review-library`} style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', background: 'var(--bg-primary)', borderRadius: '12px' }}>
      <div className="ai-shell__artifact-content drl-content" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {isInspector && renderArtifactExportBar(artifact, lookupSessionState, lookupCapabilityState, lookupDecisionReadiness)}

        <div className="drl-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <FaShieldAlt style={{ fontSize: '2.5rem', color: 'var(--accent-blue)' }} />
                <Typography variant="h3" sx={{ fontWeight: 900, m: 0 }}>Decision Review</Typography>
              </div>
              {artifact.asset_id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{
                    padding: '8px 12px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    color: 'var(--accent-green)',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    alignSelf: 'flex-start'
                  }}>
                    <FaCheckCircle /> Saved Snapshot
                  </div>
                  {artifact.created_at && (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Saved: {new Date(artifact.created_at).toLocaleString()}
                    </Typography>
                  )}
                  {artifact.snapshot_notice && (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.6, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      {artifact.snapshot_notice}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontWeight: 700, color: 'var(--accent-blue)' }}>
                    Observational Boundary: observational_analysis_only
                  </Typography>
                  {!fullscreenAsset && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setFullscreenAsset(artifact)}
                      startIcon={<FaEye />}
                      sx={{
                        mt: 1,
                        alignSelf: 'flex-start',
                        fontWeight: 800,
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'var(--bg-secondary)'
                        }
                      }}
                    >
                      Open full review
                    </Button>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#f59e0b',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <FaExclamationTriangle /> Current Session Only
                </div>
              )}
            </div>

            {/* Save Control Form (only for live/unsaved assets) */}
            {!artifact.asset_id && (
              <div className="ai-shell__save-control" style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <TextField
                    size="small"
                    placeholder="Custom display title..."
                    variant="outlined"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    disabled={savingAsset}
                    sx={{
                      flex: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        bgcolor: 'var(--bg-secondary)',
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSaveAsset}
                    disabled={savingAsset}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 800,
                      bgcolor: 'var(--accent-blue)',
                      color: '#fff',
                      '&:hover': {
                        bgcolor: 'var(--accent-blue)',
                        filter: 'brightness(1.1)'
                      }
                    }}
                  >
                    {savingAsset ? 'Saving...' : 'Save'}
                  </Button>
                </div>
                {saveSuccess && (
                  <Typography variant="caption" sx={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                    ✓ Saved successfully!
                  </Typography>
                )}
                {saveError && (
                  <Typography variant="caption" sx={{ color: 'var(--accent-red)', fontWeight: 700 }}>
                    ⚠ {saveError}
                  </Typography>
                )}
              </div>
            )}
          </div>
          <Typography variant="body2" sx={{ mt: 2, opacity: 0.6, maxWidth: '800px' }}>
            {artifact.asset_id
              ? "This is an immutable snapshot of a saved Decision Review. Live editing and modifications are disabled."
              : "This is a read-only review of the active decision output from AI Chat. To edit or run new analysis, use the chat or actions below."
            }
          </Typography>
        </div>

        {/* 1. EXECUTIVE BRIEF */}
        <section className="drl-section">
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>{doTitle}</Typography>
          {doSummary && <Typography variant="body1" sx={{ fontSize: '1.15rem', lineHeight: 1.6, opacity: 0.9, maxWidth: '900px' }}>{doSummary}</Typography>}
        </section>

        {/* 2. DATASET TRUST */}
        {doDt && (
          <section className="drl-section" style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <FaDatabase style={{ fontSize: '1.5rem', opacity: 0.7 }} />
              <div>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Dataset Trust</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {doDt.source_label || 'Grounded'}: {doDt.dataset?.dataset_name || 'Active dataset'}
                </Typography>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Tooltip title={`Rows: ${doDt.row_count?.toLocaleString() || 0} • Cols: ${doDt.column_count?.toLocaleString() || 0} • Transforms: ${doDt.transform_state || 'unknown'} • Freshness: ${doDt.stale_state?.replace(/_/g, ' ') || 'unknown'}`} arrow>
                  <span style={{ fontSize: '0.85rem', opacity: 0.7, cursor: 'help', marginRight: '8px' }}>Health Metrics <FaInfoCircle /></span>
                </Tooltip>
                {doDt.warnings && doDt.warnings.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                    {doDt.warnings.map((w, idx) => (
                      <Tooltip key={idx} title={w} arrow>
                        <span style={{ color: '#f59e0b', cursor: 'help' }}><FaExclamationTriangle /></span>
                      </Tooltip>
                    ))}
                  </div>
                )}
                {doDt.semantic_ready ? (
                  <span style={{ padding: '6px 12px', background: 'var(--accent-green)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>Semantic Ready</span>
                ) : (
                  <span style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800 }}>No Semantic Model</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 3. DECISION FRAME */}
        {doFrame && (
          <section className="drl-section">
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 4, borderBottom: '2px solid var(--border-color)', pb: 1 }}>Decision Frame</Typography>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.6, display: 'block', mb: 3, fontSize: '0.9rem' }}>Target & Drivers</Typography>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '12px' }}>Goal</strong>
                    {doFrame.goal ? (
                      <SemanticRef metric_ref={doFrame.goal.metric_ref || doFrame.goal.metric_id ? doFrame.goal : { label: doFrame.goal.label || 'Not specified' }} type="objective" />
                    ) : <span style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.85rem' }}>Not specified</span>}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '12px' }}>Levers</strong>
                    {renderSemanticList(doFrame.drivers, 'lever')}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.6, display: 'block', mb: 3, fontSize: '0.9rem' }}>Constraints & Breakdowns</Typography>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '12px' }}>Limits</strong>
                    {renderSemanticList(doFrame.limits, 'guardrail')}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '12px' }}>Segments</strong>
                    {renderSemanticList(doFrame.breakdowns, 'segment')}
                  </div>
                </div>
              </div>
            </div>
            {(doFrame.assumptions?.length > 0 || doFrame.unknowns?.length > 0) && (
              <details style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none' }}>Assumptions & Unknowns ({((doFrame.assumptions?.length || 0) + (doFrame.unknowns?.length || 0))})</summary>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {doFrame.assumptions?.map((item, idx) => <div key={`a-${idx}`} style={{ fontSize: '0.9rem' }}>• {typeof item === 'object' ? item.statement || item.label : item}</div>)}
                  {doFrame.unknowns?.map((item, idx) => <div key={`u-${idx}`} style={{ fontSize: '0.9rem', color: '#f59e0b' }}>• {typeof item === 'object' ? item.statement || item.label : item}</div>)}
                </div>
              </details>
            )}
          </section>
        )}

        {/* 4. EVIDENCE BOARD */}
        {doEvidence && (
          <section className="drl-section">
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 4, borderBottom: '2px solid var(--border-color)', pb: 1 }}>Evidence Board</Typography>
            {doEvidence.status === 'analyzed' && doEvidence.items && doEvidence.items.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {doEvidence.items.map((rd, i) => (
                  <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: rd.strength === 'strong' ? '#10b981' : rd.strength === 'weak' ? '#ef4444' : '#f59e0b' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 900, opacity: 0.2 }}>{rd.rank || (i + 1)}</span>
                        <Typography variant="h6" sx={{ fontWeight: 800, m: 0 }}>{rd.title || 'Observational Insight'}</Typography>
                        {rd.source_diagnostic_id && (
                          <Tooltip title={`Source ID: ${rd.source_diagnostic_id}`} arrow>
                            <span style={{ opacity: 0.5, cursor: 'help' }}><FaInfoCircle /></span>
                          </Tooltip>
                        )}
                      </div>
                      <span style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 900, borderRadius: '6px', textTransform: 'uppercase', background: rd.strength === 'strong' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: rd.strength === 'strong' ? '#10b981' : '#f59e0b' }}>
                        {rd.strength || 'Moderate'}
                      </span>
                    </div>
                    <Typography variant="body1" sx={{ lineHeight: 1.6, opacity: 0.9, mb: 3 }}>{rd.summary}</Typography>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      {rd.covers && (
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                          <strong>Coverage:</strong> {[
                            rd.covers.goal && 'Goal',
                            ...(rd.covers.drivers?.map(d => d.label || d.name) || []),
                            ...(rd.covers.limits?.map(l => l.label || l.name) || []),
                            ...(rd.covers.breakdowns?.map(b => b.label || b.name) || [])
                          ].filter(Boolean).join(', ') || 'General'}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        {rd.data_sufficiency && (
                          <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: rd.data_sufficiency.status === 'sufficient' ? 'var(--accent-green)' : '#f59e0b' }}>
                            <FaCircle size={8} /> {rd.data_sufficiency.status === 'sufficient' ? 'Data Sufficient' : 'Data Limited'}
                          </span>
                        )}
                        {rd.limitations && rd.limitations.length > 0 && (
                          <Tooltip title={rd.limitations.join(' • ')} arrow>
                            <span style={{ fontSize: '0.85rem', opacity: 0.7, display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '4px', cursor: 'help' }}>
                              <FaExclamationTriangle size={12} /> {rd.limitations.length} Caveats
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    {rd.next_checks && rd.next_checks.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--border-color)' }}>
                        {rd.next_checks.map((check, cIdx) => (
                          <Tooltip key={`check-${cIdx}`} title={`${check.enabled ? (check.description || '') : (check.disabled_reason || check.reason || 'Disabled')}${check.source_refs?.length ? ` (Refs: ${check.source_refs.join(', ')})` : ''}${check.truth_boundary ? ` [Boundary: ${check.truth_boundary}]` : ''}`} arrow>
                            <span>
                              <Button
                                variant="outlined"
                                size="small"
                                disabled={!check.enabled}
                                sx={{
                                  fontSize: '0.75rem',
                                  padding: '2px 8px',
                                  textTransform: 'none',
                                  opacity: check.enabled ? 1 : 0.6,
                                  borderColor: check.enabled ? 'var(--accent-blue)' : 'var(--border-color)',
                                  color: check.enabled ? 'var(--accent-blue)' : 'var(--text-secondary)'
                                }}
                              >
                                {check.label || check.check_id?.replace(/_/g, ' ')}
                              </Button>
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.6, fontStyle: 'italic', mt: 1 }}>
                {doEvidence.summary || 'Run observational analysis to ground decision drivers.'}
              </Typography>
            )}
          </section>
        )}

        {/* 5. SECONDARY SECTIONS (Map, Compare, Gates) */}
        <section className="drl-section">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* DECISION MAP */}
            {doMap && doMap.nodes && doMap.nodes.length > 0 && (
              <details style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <summary style={{ fontWeight: 800, cursor: 'pointer', outline: 'none' }}>Decision Map</summary>
                <div className="ai-shell__do-map-wrap" style={{ marginTop: '16px' }}>
                  <div className="ai-shell__do-map-nodes">
                    {doMap.nodes.map((node, i) => (
                      <div key={i} className={`ai-shell__do-map-node is-${node.node_type || 'unknown'}`}>
                        <span className="ai-shell__do-map-node-lbl">{node.label}</span>
                        <span className="ai-shell__do-map-node-type">{node.node_type}</span>
                        {node.next_checks && node.next_checks.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {node.next_checks.map((check, cIdx) => (
                              <Tooltip key={`node-check-${cIdx}`} title={`${check.enabled ? (check.description || '') : (check.disabled_reason || check.reason || 'Disabled')}${check.source_refs?.length ? ` (Refs: ${check.source_refs.join(', ')})` : ''}${check.truth_boundary ? ` [Boundary: ${check.truth_boundary}]` : ''}`} arrow>
                                <span style={{
                                  fontSize: '0.65rem',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: check.enabled ? 'rgba(0, 102, 255, 0.1)' : 'rgba(0,0,0,0.05)',
                                  color: check.enabled ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                  border: check.enabled ? '1px solid rgba(0, 102, 255, 0.2)' : '1px solid transparent',
                                  cursor: 'help'
                                }}>
                                  {check.label || check.check_id?.replace(/_/g, ' ')}
                                </span>
                              </Tooltip>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {doMap.edges && doMap.edges.length > 0 && (
                    <div className="ai-shell__do-map-edges">
                      {doMap.edges.map((edge, i) => {
                        const srcNode = doMap.nodes.find(n => n.node_id === edge.source_node_id);
                        const tgtNode = doMap.nodes.find(n => n.node_id === edge.target_node_id);
                        return (
                          <div key={i} className="ai-shell__do-map-edge" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>{srcNode?.label || edge.source_node_id} ‹ {edge.relationship_type?.replace(/_/g, ' ')} › {tgtNode?.label || edge.target_node_id}</span>
                            {edge.next_checks && edge.next_checks.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {edge.next_checks.map((check, cIdx) => (
                                  <Tooltip key={`edge-check-${cIdx}`} title={`${check.enabled ? (check.description || '') : (check.disabled_reason || check.reason || 'Disabled')}${check.source_refs?.length ? ` (Refs: ${check.source_refs.join(', ')})` : ''}${check.truth_boundary ? ` [Boundary: ${check.truth_boundary}]` : ''}`} arrow>
                                    <span style={{
                                      fontSize: '0.65rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: check.enabled ? 'rgba(0, 102, 255, 0.1)' : 'rgba(0,0,0,0.05)',
                                      color: check.enabled ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                      border: check.enabled ? '1px solid rgba(0, 102, 255, 0.2)' : '1px solid transparent',
                                      cursor: 'help'
                                    }}>
                                      {check.label || check.check_id?.replace(/_/g, ' ')}
                                    </span>
                                  </Tooltip>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* SCENARIO COMPARE */}
            {doScenario && (
              <details open style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <summary style={{ fontWeight: 800, cursor: 'pointer', outline: 'none' }}>Scenario Compare</summary>
                <div style={{ marginTop: '16px' }}>
                  <ScenarioPreview preview={doScenario} />
                </div>
              </details>
            )}

            {/* ADVANCED GATES */}
            {doGates && doGates.length > 0 && (
              <details style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <summary style={{ fontWeight: 800, cursor: 'pointer', outline: 'none' }}>Advanced Capabilities</summary>
                <div className="ai-shell__do-gates-wrap" style={{ marginTop: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {doGates.map((gate, i) => (
                    <div key={i} className="ai-shell__do-gate-card">
                      <span className="ai-shell__do-gate-title">{gate.capability?.replace(/_/g, ' ') || 'capability'}</span>
                      <span className="ai-shell__do-gate-reason">{gate.reason || 'Unsupported'}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>

        {/* 6. RELIABILITY BOUNDARY */}
        <section className="drl-section">
          <div style={{ padding: '20px', background: 'rgba(0, 102, 255, 0.05)', border: '1px solid var(--accent-blue)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--accent-blue)' }}>
            <FaInfoCircle style={{ fontSize: '1.5rem' }} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              <strong>Observational Boundary:</strong> {doTruthBoundary.replace(/_/g, ' ')}. No causal forecast claims supported.
            </Typography>
          </div>
        </section>

        {/* 7. ACTIONS & CORRECTION STATE */}
        <section className="drl-section" style={{ borderTop: '2px solid var(--border-color)', paddingTop: '32px' }}>
          <div className="ai-shell__do-action-bar" style={{ padding: '24px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            {doCorrection && (doCorrection.status === 'updated' || doCorrection.status === 'success') && (
              <div className="ai-shell__do-correction-toast" style={{ marginBottom: '16px' }}>
                <FaTools className="ai-shell__do-correction-icon" />
                <span>{doCorrection.latest?.summary || doCorrection.summary || 'Correction applied'}</span>
                {doCorrection.latest && (
                  <Tooltip title={`Target: ${doCorrection.latest.target_path} | Prev: ${typeof doCorrection.latest.previous_value === 'object' ? JSON.stringify(doCorrection.latest.previous_value) : String(doCorrection.latest.previous_value ?? 'None')} | New: ${typeof doCorrection.latest.new_value === 'object' ? JSON.stringify(doCorrection.latest.new_value) : String(doCorrection.latest.new_value ?? '—')}`} arrow>
                    <span className="ai-shell__do-correction-diff">Details</span>
                  </Tooltip>
                )}
              </div>
            )}

            {doReadiness && (
              <div className="ai-shell__do-readiness">
                <div className="ai-shell__do-readiness-status" style={{ marginBottom: '16px' }}>
                  <FaCheckCircle className={`ai-shell__do-readiness-icon ${doReadiness.readiness_state === 'analysis_ready' ? 'is-ready' : 'is-standby'}`} />
                  <div>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {doReadiness.readiness_state ? doReadiness.readiness_state.replace(/_/g, ' ') : 'Incomplete Frame'}
                    </Typography>
                  </div>
                </div>
                {doReadiness.blocked_state?.is_blocked && doReadiness.blocked_state.blocking_missing_inputs?.length > 0 && (
                  <div className="ai-shell__do-readiness-blockers" style={{ marginBottom: '16px' }}>
                    <span className="ai-shell__do-readiness-blocker-lbl">Missing Inputs:</span>
                    {doReadiness.blocked_state.blocking_missing_inputs.join(', ')}
                  </div>
                )}
                <div className="ai-shell__do-readiness-actions" style={{ flexWrap: 'wrap' }}>
                  {!artifact.asset_id && doReadiness.allowed_next_actions?.filter(actId => actId !== 'open_workspace').map((actId, idx) => {
                    const actDetails = lookupActions.find(a => a.action_id === actId) || { label: actId.replace(/_/g, ' '), enabled: true };
                    const isPrimary = actDetails.priority === 'primary' || actId === 'analyze_workspace';
                    const isEnabled = doReadiness.allowed_next_actions.includes(actId) && actDetails.enabled !== false;
                    return (
                      <Button
                        key={idx}
                        variant={isPrimary ? "contained" : "outlined"}
                        disabled={loading || !isEnabled}
                        startIcon={actId === 'analyze_workspace' ? <FaSearch /> : <FaTools />}
                        size="large"
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 800,
                          px: 3,
                          py: 1,
                          bgcolor: isPrimary ? 'var(--text-primary)' : 'transparent',
                          color: isPrimary ? 'var(--bg-primary)' : 'var(--text-primary)',
                          borderColor: 'var(--text-primary)',
                          '&:hover': {
                            bgcolor: isPrimary ? 'var(--text-primary)' : 'var(--bg-secondary)',
                            filter: isPrimary ? 'brightness(1.1)' : 'none'
                          }
                        }}
                        onClick={() => handleActionClick(actId, lookupSessionState)}
                      >
                        {actDetails.label || actId.replace(/_/g, ' ')}
                      </Button>
                    );
                  })}
                  {(() => {
                    const hasDataContext = datasetContext && !!semanticModel;

                    if (!hasDataContext) {
                      return (
                        <Tooltip title="Decision Graph requires an active dataset and semantic model." arrow placement="top">
                          <span>
                            <Button
                              variant="contained"
                              disabled={true}
                              startIcon={<FaLayerGroup />}
                              size="large"
                              sx={{
                                borderRadius: '8px',
                                textTransform: 'none',
                                fontWeight: 800,
                                px: 3,
                                py: 1,
                                bgcolor: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              Launch Decision Graph
                            </Button>
                          </span>
                        </Tooltip>
                      );
                    }

                    return (
                      <Button
                        variant="contained"
                        disabled={loading}
                        startIcon={<FaLayerGroup />}
                        size="large"
                        sx={{
                          borderRadius: '8px',
                          textTransform: 'none',
                          fontWeight: 800,
                          px: 3,
                          py: 1,
                          bgcolor: 'var(--accent-blue)',
                          color: '#fff',
                          '&:hover': {
                            bgcolor: 'var(--accent-blue)',
                            filter: 'brightness(1.1)'
                          }
                        }}
                        onClick={() => {
                          if (onOpenDecisionGraph) {
                            onOpenDecisionGraph({
                              evidence_board: doEvidence,
                              frame: doFrame,
                              dataset: datasetContext,
                              semantic_model: semanticModel
                            });
                          }
                        }}
                      >
                        Launch Decision Graph
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Inline Correction Panel (Phase 5) */}
            {isInspector && !artifact.asset_id && (
              <div className="ai-shell__correction-panel-zone" style={{ marginTop: '24px' }}>
                {!correctionPanelOpen ? (
                  <button id="ai-shell-correction-trigger-btn" className="ai-shell__correction-trigger-btn" onClick={() => setCorrectionPanelOpen(true)} disabled={loading}>
                    <FaTools style={{ fontSize: '0.75rem' }} /> Adjust Frame
                  </button>
                ) : (
                  <div id="ai-shell-correction-panel" className="ai-shell__correction-form-panel">
                    <div className="ai-shell__correction-form-header">
                      <Typography variant="overline" sx={{ fontWeight: 900, opacity: 0.5 }}>Apply Correction</Typography>
                      <button className="ai-shell__correction-form-close" onClick={() => { setCorrectionPanelOpen(false); setCorrectionReplacement(''); setCorrectionReason(''); }}>✕</button>
                    </div>
                    <div className="ai-shell__correction-form-row">
                      <label className="ai-shell__correction-form-label">Type</label>
                      <select className="ai-shell__correction-form-select" value={correctionType} onChange={(e) => {
                          const selected = e.target.value;
                          setCorrectionType(selected);
                          const pathMap = { time_horizon: 'decision_scope.objective.time_horizon', objective_direction: 'decision_scope.objective.direction', objective_metric: 'decision_scope.objective.metric_ref', lever_controllability: 'decision_scope.levers[0].controllable' };
                          setCorrectionTargetPath(pathMap[selected] || `decision_scope.${selected}`);
                          if (selected === 'objective_direction') setCorrectionReplacement('maximize');
                          else if (selected === 'lever_controllability') setCorrectionReplacement('true');
                          else setCorrectionReplacement('');
                        }}>
                        <option value="time_horizon">Time Horizon</option>
                        <option value="objective_direction">Objective Direction</option>
                        <option value="objective_metric">Objective Metric</option>
                        <option value="lever_controllability">Lever Controllability</option>
                      </select>
                    </div>
                    <div className="ai-shell__correction-form-row">
                      <label className="ai-shell__correction-form-label">New Value</label>
                      {correctionType === 'objective_direction' ? (
                        <select className="ai-shell__correction-form-select" value={correctionReplacement || 'maximize'} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading}>
                          <option value="maximize">maximize</option><option value="minimize">minimize</option><option value="maintain">maintain</option><option value="achieve_target">achieve_target</option>
                        </select>
                      ) : correctionType === 'lever_controllability' ? (
                        <select className="ai-shell__correction-form-select" value={correctionReplacement || 'true'} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading}>
                          <option value="true">Controllable</option><option value="false">Outcome (false)</option>
                        </select>
                      ) : (
                        <input className="ai-shell__correction-form-input" type="text" value={correctionReplacement} onChange={(e) => setCorrectionReplacement(e.target.value)} disabled={loading} />
                      )}
                    </div>
                    <div className="ai-shell__correction-form-row">
                      <label className="ai-shell__correction-form-label">Reason (optional)</label>
                      <input className="ai-shell__correction-form-input" type="text" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} disabled={loading} />
                    </div>
                    <button className="ai-shell__correction-submit-btn" disabled={loading || !String(correctionReplacement).trim()} onClick={() => handleCorrectionSubmit({ correction_type: correctionType, target_path: correctionTargetPath, replacement: typeof correctionReplacement === 'string' ? correctionReplacement.trim() : correctionReplacement, reason: correctionReason.trim() || null }, lookupSessionState)}>
                      {loading ? 'Applying…' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
