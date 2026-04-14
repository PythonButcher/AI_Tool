import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Runs the unified decision pipeline (Legacy Phase 3).
 * 
 * @param {Object} payload - The decision request payload.
 * @returns {Promise<Object>} The decision bundle response.
 */
export const runDecisionPipeline = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/run`, payload);
    return response.data;
  } catch (error) {
    console.error('Error running decision pipeline:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Creates a scoped decision workspace (DI 2.0).
 * 
 * @param {Object} payload - The decision workspace request payload.
 * @param {string} payload.decision_prompt - The business problem being framed.
 * @param {Object} payload.objective - Primary success definition.
 * @param {Array<Object>} payload.levers - Candidate variables the user can control.
 * @param {Array<Object>} payload.constraints - Guardrails and limits.
 * @returns {Promise<Object>} The decision workspace response.
 */
export const createDecisionWorkspace = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/workspaces`, {
      ...payload,
      contract_version: 'di_2_0_v1'
    });
    return response.data;
  } catch (error) {
    console.error('Error creating decision workspace:', error);
    throw error?.response?.data || error;
  }
};
