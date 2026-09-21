import { apiClient } from './client';

export const clientsApi = {
  // GET /clients/:id/format
  getClientFormat(clientId) {
    return apiClient.request({ path: `/clients/${clientId}/format` });
  },

  // POST /exports
  exportClientVobs(clientId, format = 'xlsx') {
    return apiClient.request({
      path: '/exports',
      method: 'POST',
      data: { client: clientId, format }
    });
  }
};
