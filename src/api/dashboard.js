import { apiClient } from './client';

export const dashboardApi = {
  // GET /dashboard/summary?client=&user=&date=
  getSummary({ clientId, userEmail, dateRange } = {}) {
    return apiClient.request({
      path: '/dashboard/summary',
      params: { clientId, userEmail, dateRange }
    });
  }
};
