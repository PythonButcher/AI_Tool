import axios from 'axios';

import { workflowApi } from './workflowApi';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

describe('workflowApi reliability endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: {} });
    axios.post.mockResolvedValue({ data: {} });
  });

  test('execute includes an idempotency key only when provided', async () => {
    axios.post.mockResolvedValueOnce({ data: { run_id: 'run-1' } });

    await workflowApi.execute(
      { id: 'workflow-1' },
      [{ value: 1 }],
      'request-key'
    );

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/workflows/execute',
      {
        workflow: { id: 'workflow-1' },
        dataset: [{ value: 1 }],
        idempotency_key: 'request-key',
      }
    );
  });

  test('listRuns maps the saved workflow filter and pagination', async () => {
    axios.get.mockResolvedValueOnce({ data: { runs: [] } });

    await workflowApi.listRuns({
      workflowId: 'workflow-1',
      limit: 20,
      offset: 5,
    });

    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/workflows/runs',
      {
        params: {
          workflow_id: 'workflow-1',
          limit: 20,
          offset: 5,
        },
      }
    );
  });

  test('cancelRun and getRunEvents use the durable run endpoints', async () => {
    await workflowApi.cancelRun('run-1');
    await workflowApi.getRunEvents('run-1', { limit: 10, offset: 2 });

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/workflows/runs/run-1/cancel'
    );
    expect(axios.get).toHaveBeenCalledWith(
      'http://localhost:5000/api/workflows/runs/run-1/events',
      { params: { limit: 10, offset: 2 } }
    );
  });
});
