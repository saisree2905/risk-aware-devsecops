import apiClient from './api';

export const policyService = {
  /**
   * Fetch security policy list and active gating thresholds
   */
  async getPolicies() {
    const res = await apiClient.get('/policies');
    return res.data; // { policies: [], total: number }
  },
};

export default policyService;
