/** Legacy callers remain valid while Analytics owns the combined destination. */
export function resolveAnalyticsDestination(destination) {
  if (destination === 'explore') return { destination: 'analytics', view: 'explore' };
  if (destination === 'dashboards') return { destination: 'analytics', view: 'dashboards' };
  return { destination, view: null };
}
