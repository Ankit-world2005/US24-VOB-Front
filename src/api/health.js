import { apiClient } from './client';

export const healthApi = {
  // GET /healthz - Liveness probe: checks if process is up
  getHealthz() {
    return apiClient.request({ path: '/healthz' });
  },

  // GET /readyz - Readiness probe: checks if database is reachable
  getReadyz() {
    return apiClient.request({ path: '/readyz' });
  }
};
