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

  async execute(workflow, dataset) {
    const response = await axios.post(`${WORKFLOW_URL}/execute`, { workflow, dataset });
    return response.data;
  },

  async getRun(runId) {
    const response = await axios.get(`${WORKFLOW_URL}/runs/${runId}`);
    return response.data;
  },
};
