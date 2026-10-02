import { apiClient } from './client';
import { toServerClientId } from './clientIds';

/**
 * The API's id for the UI's client pick. A slug the server holds no client for
 * is sent as is: the API resolves it to nothing and answers with zeros.
 */
async function clientParam(clientId) {
  const resolved = await toServerClientId(clientId);
  return resolved === null ? clientId : resolved;
}

export const dashboardApi = {
  // GET /dashboard/summary?client=&user=&date=
  async getSummary({ clientId, userEmail, dateRange } = {}) {
    return apiClient.request({
      path: '/api/v1/dashboard/summary',
      params: { clientId: await clientParam(clientId), userEmail, dateRange }
    });
  },

  /**
   * GET /dashboard/breakdown - admin only. VOB volume per client (always every
   * client) and each active specialist's open work and approvals, narrowed to
   * `clientId` when one is picked.
   */
  async getBreakdown({ clientId } = {}) {
    return apiClient.request({
      path: '/api/v1/dashboard/breakdown',
      params: { clientId: await clientParam(clientId) }
    });
  }
};
