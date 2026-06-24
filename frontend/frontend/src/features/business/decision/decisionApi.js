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

/**
 * Analyzes a scoped decision workspace (DI 2.0 V3).
 * 
 * @param {Object} payload - The analysis request payload.
 * @param {Object} payload.decision_workspace - The workspace to analyze.
 * @param {Object} [payload.analysis_preferences] - Optional analysis hints.
 * @returns {Promise<Object>} The workspace analysis response.
 */
export const analyzeDecisionWorkspace = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/workspaces/analyze`, {
      ...payload,
      contract_version: 'di_2_0_v1'
    });
    return response.data;
  } catch (error) {
    console.error('Error analyzing decision workspace:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Fetches eligible candidates for a decision graph.
 *
 * @param {Object} payload - The candidates request payload.
 * @param {Object} payload.dataset - Resolved dataset summary.
 * @param {Object} payload.semantic_model - The current semantic model.
 * @returns {Promise<Object>} The candidates response.
 */
export const getDecisionGraphCandidates = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/graph/candidates`, payload);
    return response.data;
  } catch (error) {
    console.error('Error fetching decision graph candidates:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Builds the decision graph from selected variables and evidence.
 *
 * @param {Object} payload - The graph build request payload.
 * @param {Object} payload.dataset - Resolved dataset summary.
 * @param {Object} payload.semantic_model - The current semantic model.
 * @param {Array} payload.selected_variables - Selected metrics/dimensions.
 * @param {string} [payload.graph_mode] - 'evidence_coverage', 'observed_association', or 'mixed'.
 * @returns {Promise<Object>} The decision graph response.
 */
export const buildDecisionGraph = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/graph/build`, payload);
    return response.data;
  } catch (error) {
    console.error('Error building decision graph:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Plans a follow-up action from a decision graph node or edge.
 *
 * @param {Object} payload - The action plan request payload.
 * @param {string} payload.action_id - Action ID (e.g., breakdown, send_to_scenario_compare).
 * @param {Object} [payload.decision_graph] - The full decision graph.
 * @param {Object} [payload.target_edge] - Selected edge.
 * @param {Object} [payload.target_node] - Selected node.
 * @returns {Promise<Object>} The action planning response.
 */
export const planDecisionGraphAction = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/graph/actions`, payload);
    return response.data;
  } catch (error) {
    console.error('Error planning decision graph action:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Saves a decision asset (POST /api/decision/assets).
 *
 * @param {Object} payload - The payload containing optional title, decision_output, and optional graph_state.
 * @returns {Promise<Object>} The saved DecisionAsset.
 */
export const saveDecisionAsset = async (payload) => {
  try {
    const response = await axios.post(`${API_URL}/api/decision/assets`, payload);
    return response.data;
  } catch (error) {
    console.error('Error saving decision asset:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Fetches all saved decision asset summaries (GET /api/decision/assets).
 *
 * @param {Object} [params] - Optional query params (e.g. limit).
 * @returns {Promise<Object>} Object containing the list of asset summaries.
 */
export const getDecisionAssets = async (params = {}) => {
  try {
    const response = await axios.get(`${API_URL}/api/decision/assets`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching decision assets:', error);
    throw error?.response?.data || error;
  }
};

/**
 * Fetches a single complete DecisionAsset by its ID (GET /api/decision/assets/<asset_id>).
 *
 * @param {string} assetId - The stable asset identifier.
 * @returns {Promise<Object>} The complete DecisionAsset.
 */
export const getDecisionAssetById = async (assetId) => {
  try {
    const response = await axios.get(`${API_URL}/api/decision/assets/${assetId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching decision asset ${assetId}:`, error);
    throw error?.response?.data || error;
  }
};
