import React, { useState, useEffect } from 'react';
import './RelationshipInspector.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const RelationshipInspector = ({ workspaceId, relationship, sources, onSave, onCancel, onRefresh }) => {
  const isDraft = !relationship.relationship_id;
  
  const [formData, setFormData] = useState({
    cardinality: relationship.cardinality || 'one_to_one',
    join_behavior: relationship.join_behavior || 'inner',
    filter_direction: relationship.filter_direction || 'none',
    field_pairs: relationship.field_pairs || [],
  });
  
  const [version, setVersion] = useState(relationship.version);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState(relationship.diagnostics || []);
  
  const leftSource = sources.find(s => s.source_id === relationship.left_source_id);
  const rightSource = sources.find(s => s.source_id === relationship.right_source_id);
  
  useEffect(() => {
    // Reset form when relationship changes
    setFormData({
      cardinality: relationship.cardinality || 'one_to_one',
      join_behavior: relationship.join_behavior || 'inner',
      filter_direction: relationship.filter_direction || 'none',
      field_pairs: relationship.field_pairs || [],
    });
    setVersion(relationship.version);
    setDiagnostics(relationship.diagnostics || []);
    setError(null);
  }, [relationship]);

  const handleFieldChange = (index, field, value) => {
    const newPairs = [...formData.field_pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setFormData({ ...formData, field_pairs: newPairs });
  };
  
  const addFieldPair = () => {
    setFormData({
      ...formData,
      field_pairs: [...formData.field_pairs, { left_field: '', right_field: '' }]
    });
  };
  
  const removeFieldPair = (index) => {
    const newPairs = formData.field_pairs.filter((_, i) => i !== index);
    setFormData({ ...formData, field_pairs: newPairs });
  };

  const handleSave = async () => {
    // Prevent empty or duplicate fields
    if (formData.field_pairs.length === 0) {
      setError('At least one field pair is required.');
      return;
    }
    for (const pair of formData.field_pairs) {
      if (!pair.left_field || !pair.right_field) {
        setError('Both left and right fields must be selected for all pairs.');
        return;
      }
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      let res;
      if (isDraft) {
        res = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/relationships`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            left_source_id: relationship.left_source_id,
            right_source_id: relationship.right_source_id,
            field_pairs: formData.field_pairs,
            cardinality: formData.cardinality,
            join_behavior: formData.join_behavior,
            filter_direction: formData.filter_direction,
            validate: true
          })
        });
      } else {
        res = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/relationships/${relationship.relationship_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version,
            field_pairs: formData.field_pairs,
            cardinality: formData.cardinality,
            join_behavior: formData.join_behavior,
            filter_direction: formData.filter_direction
          })
        });
      }
      
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.diagnostics) {
          setDiagnostics(data.error.diagnostics);
        }
        throw new Error(data.error?.message || 'Failed to save relationship');
      }
      
      onSave(data.relationship);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleValidate = async () => {
    if (isDraft) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/relationships/${relationship.relationship_id}/validate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.diagnostics) setDiagnostics(data.error.diagnostics);
        throw new Error(data.error?.message || 'Validation failed');
      }
      onSave(data.relationship);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleActivation = async (activate) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = { version };
      if (activate) {
        payload.is_active = true;
        payload.is_confirmed = true;
      } else {
        payload.is_active = false;
      }
      
      const res = await fetch(`${API_URL}/api/data-workspaces/${workspaceId}/relationships/${relationship.relationship_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.diagnostics) setDiagnostics(data.error.diagnostics);
        // Refresh version if conflict
        if (data.error?.code === 'relationship_version_conflict' || data.error?.code === 'relationship_not_activatable' || data.error?.code === 'relationship_confirmation_required') {
           onRefresh(); // Trigger parent to reload this relationship from server to reconcile
        }
        throw new Error(data.error?.message || `Failed to ${activate ? 'activate' : 'deactivate'} relationship`);
      }
      onSave(data.relationship);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relationship-inspector">
      <div className="inspector-header">
        <h3>{isDraft ? 'Create Relationship' : 'Edit Relationship'}</h3>
        <button className="close-btn" onClick={onCancel} aria-label="Close">&times;</button>
      </div>
      
      <div className="inspector-body">
        {error && (
          <div className="inspector-alert error" role="alert">
            {error}
          </div>
        )}
        
        {!isDraft && (
          <div className="status-panel">
            <div className="status-row">
              <span className="status-label">Validation:</span>
              <span className={`status-value badge-${relationship.validation_state}`}>
                {relationship.validation_state}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Status:</span>
              <span className={`status-value ${relationship.is_active ? 'active' : 'inactive'}`}>
                {relationship.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="status-row">
              <span className="status-label">Confirmed:</span>
              <span>{relationship.is_confirmed ? 'Yes' : 'No'}</span>
            </div>
          </div>
        )}

        <div className="form-section">
          <div className="source-headers">
            <div className="source-name" title={leftSource?.name}>{leftSource?.alias || leftSource?.name || 'Left Source'}</div>
            <div className="link-icon">↔</div>
            <div className="source-name" title={rightSource?.name}>{rightSource?.alias || rightSource?.name || 'Right Source'}</div>
          </div>
          
          <div className="field-pairs">
            <h4>Field Pairs</h4>
            {formData.field_pairs.map((pair, idx) => (
              <div key={idx} className="field-pair-row">
                <select 
                  value={pair.left_field} 
                  onChange={(e) => handleFieldChange(idx, 'left_field', e.target.value)}
                  className="field-select"
                >
                  <option value="">Select field...</option>
                  {leftSource?.schema?.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                
                <span className="equals-sign">=</span>
                
                <select 
                  value={pair.right_field} 
                  onChange={(e) => handleFieldChange(idx, 'right_field', e.target.value)}
                  className="field-select"
                >
                  <option value="">Select field...</option>
                  {rightSource?.schema?.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                
                <button 
                  className="remove-pair-btn" 
                  onClick={() => removeFieldPair(idx)}
                  disabled={formData.field_pairs.length <= 1}
                  title="Remove pair"
                >&times;</button>
              </div>
            ))}
            <button className="btn-secondary btn-small add-pair-btn" onClick={addFieldPair}>
              + Add Field Pair
            </button>
          </div>
          
          <div className="config-grid">
            <div className="config-group">
              <label>Cardinality</label>
              <select 
                value={formData.cardinality} 
                onChange={(e) => setFormData({...formData, cardinality: e.target.value})}
              >
                <option value="one_to_one">One to One (1:1)</option>
                <option value="one_to_many">One to Many (1:N)</option>
                <option value="many_to_one">Many to One (N:1)</option>
                <option value="many_to_many">Many to Many (N:M)</option>
              </select>
            </div>
            
            <div className="config-group">
              <label>Join Behavior</label>
              <select 
                value={formData.join_behavior} 
                onChange={(e) => setFormData({...formData, join_behavior: e.target.value})}
              >
                <option value="inner">Inner</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="full">Full Outer</option>
              </select>
            </div>
            
            <div className="config-group">
              <label>Filter Direction</label>
              <select 
                value={formData.filter_direction} 
                onChange={(e) => setFormData({...formData, filter_direction: e.target.value})}
              >
                <option value="none">None</option>
                <option value="left_to_right">Left → Right</option>
                <option value="right_to_left">Right → Left</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
        </div>

        {diagnostics && diagnostics.length > 0 && (
          <div className="diagnostics-section">
            <h4>Diagnostics</h4>
            <ul className="diagnostics-list">
              {diagnostics.map((diag, i) => (
                <li key={i} className={`diagnostic-item severity-${diag.severity}`}>
                  <strong>{diag.code}:</strong> {diag.message}
                  {diag.next_action && <div className="next-action">Action: {diag.next_action}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {!isDraft && (
          <div className="edit-warning">
            Note: Saving changes will deactivate the relationship and require fresh validation.
          </div>
        )}
      </div>
      
      <div className="inspector-footer">
        <div className="footer-left">
          {!isDraft && (
            <button 
              className="btn-danger" 
              onClick={() => handleActivation(!relationship.is_active)}
              disabled={isSubmitting}
            >
              {relationship.is_active ? 'Deactivate' : 'Activate'}
            </button>
          )}
          {!isDraft && (
            <button 
              className="btn-secondary" 
              onClick={handleValidate}
              disabled={isSubmitting}
            >
              Validate
            </button>
          )}
        </div>
        <div className="footer-right">
          <button className="btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isSubmitting}>
            {isDraft ? 'Create' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelationshipInspector;
