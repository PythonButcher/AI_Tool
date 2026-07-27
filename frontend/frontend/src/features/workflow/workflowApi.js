import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WORKFLOW_URL = `${API_URL}/api/workflows`;

export const workflowApi = {
  async list() {
    const response = await axios.get(WORKFLOW_URL);
    return response.data;
  },

  async get(workflowId) {
    const response = await axios.get(`${WORKFLOW_URL}/${workflowId}`);
    return response.data;
  },

  async create(workflow) {
    const response = await axios.post(WORKFLOW_URL, { workflow });
    return response.data;
  },

  async update(workflowId, workflow) {
    const response = await axios.patch(`${WORKFLOW_URL}/${workflowId}`, { workflow });
    return response.data;
  },

  async duplicate(workflowId, name) {
    const response = await axios.post(`${WORKFLOW_URL}/${workflowId}/duplicate`, { name });
    return response.data;
  },

  async createFromTemplate(templateId, name) {
    const response = await axios.post(`${WORKFLOW_URL}/from-template/${templateId}`, { name });
    return response.data;
  },

  async execute(workflow, dataset, idempotencyKey) {
    const payload = { workflow, dataset };
    if (idempotencyKey) {
      payload.idempotency_key = idempotencyKey;
    }
    const response = await axios.post(`${WORKFLOW_URL}/execute`, payload);
    return response.data;
  },

  async getRun(runId) {
    const response = await axios.get(`${WORKFLOW_URL}/runs/${runId}`);
    return response.data;
  },

  /**
   * List workflow runs with optional filtering and pagination.
   * @param {Object} [params] - Query parameters.
   * @param {string} [params.workflowId] - Filter by workflow ID.
   * @param {number} [params.limit=50] - Max results per page.
   * @param {number} [params.offset=0] - Pagination offset.
   */
  async listRuns({ workflowId, limit = 50, offset = 0 } = {}) {
    const params = { limit, offset };
    if (workflowId) {
      params.workflow_id = workflowId;
    }
    const response = await axios.get(`${WORKFLOW_URL}/runs`, { params });
    return response.data;
  },

  /**
   * Request cooperative cancellation of a running workflow.
   * @param {string} runId - The run ID to cancel.
   */
  async cancelRun(runId) {
    const response = await axios.post(`${WORKFLOW_URL}/runs/${runId}/cancel`);
    return response.data;
  },

  /**
   * Get paginated events for a specific run.
   * @param {string} runId - The run ID.
   * @param {Object} [params] - Query parameters.
   * @param {number} [params.limit=100] - Max events per page.
   * @param {number} [params.offset=0] - Pagination offset.
   */
  async getRunEvents(runId, { limit = 100, offset = 0 } = {}) {
    const response = await axios.get(`${WORKFLOW_URL}/runs/${runId}/events`, {
      params: { limit, offset },
    });
    return response.data;
  },
};
