import { analyticsChatRequest } from './analyticsChatBridge';
import { inlineIdentity } from './analyticsModel';

test('Data Hub context excludes unrelated attached data and workspace', () => {
  expect(analyticsChatRequest({ source: { kind: 'datahub', id: 'orders' } }, [{ wrong: 1 }], {})).toEqual({ dataset_ref: { source: 'datahub', dataset_id: 'orders', dataset_name: undefined } });
});
test('workspace analysis preserves exact versioned relationship context', () => {
  const analysis_context = { workspace_id: 'ws', workspace_version: 3, relationship_ids: ['join'] };
  expect(analyticsChatRequest({ source: { kind: 'workspace', analysis_context } })).toEqual({ workspace_id: 'ws', analysis_context });
});
test('inline context requires the exact attachment and imported context requires confirmation', () => {
  const rows = [{ revenue: 12 }];
  const context = { source: { kind: 'inline', id: inlineIdentity(rows) } };
  expect(analyticsChatRequest(context, rows, {}).dataset).toBe(rows);
  expect(() => analyticsChatRequest(context, [{ revenue: 99 }], {})).toThrow(/no longer selected/);
  expect(() => analyticsChatRequest({ ...context, requiresSourceReview: true }, rows)).toThrow(/Confirm/);
});
