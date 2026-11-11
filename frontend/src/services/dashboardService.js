import apiClient from './api';

export const dashboardService = {
  /**
   * Fetch aggregated overview metrics, latest scan summary, and active policy
   */
  async getStats() {
    const res = await apiClient.get('/dashboard/stats');
    return res.data;
  },

  /**
   * Fetch backend health status
   */
  async getHealth() {
    return await apiClient.get('/health');
  },
};

export default dashboardService;
