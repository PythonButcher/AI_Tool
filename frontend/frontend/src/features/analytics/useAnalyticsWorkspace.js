import { useCallback, useEffect, useRef, useState } from 'react';
import { clone, commitWorkspace, loadAnalytics, STORAGE_KEY } from './analyticsStorage';

export default function useAnalyticsWorkspace() {
  const [initial] = useState(() => loadAnalytics(localStorage));
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState(initial.status === 'recovery_required' ? 'Analytics storage needs recovery. Original data has been preserved.' : null);
  const [pending, setPending] = useState(null);
  const current = useRef(initial.workspace);
  const expected = useRef(initial.original);
  const pendingRef = useRef(null);
  const recovery = useRef(initial.status === 'recovery_required');
  const write = useCallback(candidate => {
    try {
      expected.current = commitWorkspace(localStorage, expected.current, candidate);
      current.current = candidate;
      pendingRef.current = null;
      setWorkspace(candidate); setPending(null); setError(null); setStatus('ready');
      return true;
    } catch (failure) {
      pendingRef.current = candidate;
      setPending(candidate); setStatus('write_failed');
      setError(`Could not save Analytics: ${failure.message}. Your saved work and draft are retained.`);
      return false;
    }
  }, []);
  const commit = useCallback(update => {
    if (recovery.current || pendingRef.current) return false;
    try {
      const next = typeof update === 'function' ? update(clone(current.current)) : clone(update);
      return write({ ...next, revision: current.current.revision + 1 });
    } catch (failure) { setError(failure.message); return false; }
  }, [write]);
  useEffect(() => { if (initial.status === 'migrate') write(initial.workspace); }, [initial, write]);
  const retry = useCallback(() => pendingRef.current ? write(pendingRef.current) : false, [write]);
  const discard = useCallback(() => { pendingRef.current = null; setPending(null); setError(null); setStatus(recovery.current ? 'recovery_required' : 'ready'); }, []);
  const recover = useCallback(() => {
    try {
      const original = localStorage.getItem(STORAGE_KEY);
      if (original !== null) localStorage.setItem(`${STORAGE_KEY}:recovery:${Date.now()}`, original);
      expected.current = original;
      recovery.current = false;
      return write(current.current);
    } catch (failure) { setError(`Recovery failed: ${failure.message}`); return false; }
  }, [write]);
  return { workspace, commit, status, error, pending, retry, discard, recover };
}
