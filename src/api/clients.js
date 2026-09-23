import { apiClient } from './client';

export const clientsApi = {
  // GET /clients/:id/format
  getClientFormat(clientId) {
    return apiClient.request({ path: `/api/v1/clients/${clientId}/format` });
  },

  // POST /exports
  exportClientVobs(clientId, format = 'xlsx') {
    return apiClient.request({
      path: '/api/v1/exports',
      method: 'POST',
      data: { client: clientId, format }
    });
  }
};
