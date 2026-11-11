import apiClient from './api';

export const scanService = {
  /**
   * Fetch paginated list of scans with optional filters
   * @param {object} params - { page, limit, decision, status, branch }
   */
  async getScans(params = {}) {
    const res = await apiClient.get('/scans', { params });
    return res.data; // { scans: [], pagination: { ... } }
  },

  /**
   * Fetch basic scan summary by ID
   */
  async getScanById(id) {
    const res = await apiClient.get(`/scans/${id}`);
    return res.data;
  },

  /**
   * Fetch comprehensive audit details for a scan
   * (scan info, risk assessment, decision, policy thresholds, scanner telemetry)
   */
  async getFullScan(id) {
    const res = await apiClient.get(`/scans/${id}/full`);
    return res.data; // { scan, scannerExecutions, findingsSummary, totalFindings }
  },

  /**
   * Fetch paginated and filterable security findings for a scan
   * @param {string} id - Scan UUID
   * @param {object} params - { page, limit, severity, scanner, search }
   */
  async getScanFindings(id, params = {}) {
    const res = await apiClient.get(`/scans/${id}/findings`, { params });
    return res.data; // { scanId, findings: [], pagination: { ... } }
  },
};

export default scanService;
