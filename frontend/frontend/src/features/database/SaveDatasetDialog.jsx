import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function SaveDatasetDialog({ workspace, savedDataset, analysisContext, datasetName, hasPreviewFilter, onClose, onSaved }) {
  const [name, setName] = useState(savedDataset?.name || datasetName || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(null);
  const inFlight = useRef(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function save(update) {
    if (inFlight.current || !name.trim()) return;
    const fields = {
      name: name.trim(), kind: 'current', workspace_id: workspace.workspace_id,
      workspace_version: workspace.version, source_id: workspace.primary_source_id,
      ...(analysisContext && { analysis_context: analysisContext }),
      ...(update && { dataset_id: savedDataset.dataset_id, expected_revision: savedDataset.revision }),
    };
    const signature = JSON.stringify(fields);
    if (request.current?.signature !== signature) {
      request.current = { signature, id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` };
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setPending(true);
    setError('');
    try {
      const { data } = await axios.post(`${API_URL}/api/datahub/saved-datasets`, { ...fields, request_id: request.current.id }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!data?.dataset?.dataset_id || !Number.isInteger(data.dataset.revision)) throw new Error('Incomplete save response');
      onSaved(data.dataset);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.response?.data?.error?.message || 'Could not confirm the save. Try again.');
    } finally {
      if (!controller.signal.aborted) {
        inFlight.current = null;
        setPending(false);
      }
    }
  }

  return (
    <Dialog open onClose={() => { if (!inFlight.current) onClose(); }} fullWidth maxWidth="xs" aria-labelledby="save-dataset-title">
      <DialogTitle id="save-dataset-title">Save Dataset</DialogTitle>
      <form onSubmit={event => { event.preventDefault(); save(Boolean(savedDataset)); }}>
        <DialogContent>
          <TextField autoFocus required fullWidth label="Dataset name" value={name} inputProps={{ maxLength: 160 }}
            onChange={event => setName(event.target.value)} disabled={pending} />
          {hasPreviewFilter && <p>Preview filters affect the view. Apply row changes in Refine to save them.</p>}
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button type="button" disabled={pending} onClick={onClose}>Cancel</Button>
          {savedDataset && <Button type="button" disabled={pending || !name.trim()} onClick={() => save(false)}>Save a copy</Button>}
          <Button type="submit" variant="contained" disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : savedDataset ? 'Update dataset' : 'Save to Data Hub'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
