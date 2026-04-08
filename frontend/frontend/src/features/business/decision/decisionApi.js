import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Runs the unified decision pipeline.
 * 
 * @param {Object} payload - The decision request payload.
 * @param {Object} payload.dataset_ref - Dataset reference { source, dataset_id }.
 * @param {Array<string>} [payload.metric_ids] - Optional metric IDs to focus on.
 * @param {Array<Object>} [payload.filters] - Optional filters to apply.
 * @param {number} [payload.max_signals] - Max signals to return.
 * @param {number} [payload.max_recommendations] - Max recommendations to return.
 * @param {boolean} [payload.include_anomaly_detection] - Whether to include anomalies.
 * @param {boolean} [payload.include_scenario_preview] - Whether to include scenario preview.
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
