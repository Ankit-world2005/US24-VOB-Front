import { apiClient } from './client';
import { toServerClientId } from './clientIds';

export const clientsApi = {
  // GET /clients/:id/format
  getClientFormat(clientId) {
    return apiClient.request({ path: `/api/v1/clients/${clientId}/format` });
  },

  /**
   * POST /exports - the client's VOBs as tracker rows: { filename, exportedRows,
   * columns, rows }. The caller writes the file. A client the server does not
   * hold for this caller has nothing to export.
   */
  async exportClientVobs(clientId, format = 'xlsx') {
    const client = await toServerClientId(clientId);
    if (client === null) return { filename: null, exportedRows: 0, columns: [], rows: [] };
    return apiClient.request({
      path: '/api/v1/exports',
      method: 'POST',
      data: { client: client ?? 'all', format }
    });
  }
};
