import { inlineIdentity } from './analyticsModel';

export const CHAT_CONTEXT_KEY = 'analytics:chat-context';

// Explicit context overrides both the attached table and a previous chat's scope.
export function analyticsChatRequest(context, rows, model) {
  const source = context?.source;
  if (!source || context.requiresSourceReview) throw new Error('Confirm an Analytics dataset before discussing this analysis.');
  if (source.kind === 'datahub') return { dataset_ref: { source: 'datahub', dataset_id: source.id, dataset_name: source.name } };
  if (source.kind === 'workspace' && source.analysis_context) return { workspace_id: source.analysis_context.workspace_id, analysis_context: source.analysis_context };
  if (source.kind === 'inline' && source.id === inlineIdentity(rows || [])) return { dataset: rows, semantic_model: model, dataset_ref: { source: 'inline', dataset_name: source.name } };
  throw new Error('The Analytics attachment is no longer selected. Reattach it in Analytics before discussing this analysis.');
}

export function analyticsChatPrompt(context) {
  return `Help me investigate ${context.title || 'this analysis'}.\nAnalytics configuration (recompute results before drawing conclusions):\n${JSON.stringify(context.query)}`;
}
