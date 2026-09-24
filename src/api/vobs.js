import { apiClient } from './client';
import { toServerClientId } from './clientIds';
import {
  normalizeVobListItem,
  normalizeSingleVob,
  toBackendPatchPayload,
  STATUS_MAP_TO_BACKEND
} from '../utils/vobAdapter';

/** An empty result in the shape getVobs() returns. */
function emptyPage() {
  const list = [];
  list.page = { limit: 0, next_cursor: null, has_more: false };
  list.data = list;
  return list;
}

export const vobsApi = {
  /**
   * GET /api/v1/vobs - The task list filtered to caller's role and parameters
   * Supports: status, client_id, assignee_id, dos_from, dos_to, updated_since, q, sort, limit, cursor
   */
  async getVobs(query = {}) {
    const params = {};

    // Map status (can be array or string, e.g. ['assigned', 'in_progress'] or 'Approved')
    if (query.status && query.status !== 'all') {
      if (Array.isArray(query.status)) {
        params.status = query.status.map(s => STATUS_MAP_TO_BACKEND[s] || s.toLowerCase());
      } else {
        const mapped = STATUS_MAP_TO_BACKEND[query.status] || query.status.toLowerCase();
        params.status = mapped;
      }
    }

    // Map client_id: the UI's slug to the API's UUID. A client the server does not
    // hold for this caller has no VOBs, so there is nothing to ask for.
    const clientId = await toServerClientId(query.client_id || query.clientId);
    if (clientId === null) return emptyPage();
    if (clientId) params.client_id = clientId;

    // Map assignee_id (Admin only)
    const assigneeId = query.assignee_id || query.assigneeId;
    if (assigneeId) {
      params.assignee_id = assigneeId;
    }

    // Map search query (q)
    const q = query.q || query.search;
    if (q) {
      params.q = q;
    }

    // Dates & sorting
    if (query.dos_from || query.dosFrom) params.dos_from = query.dos_from || query.dosFrom;
    if (query.dos_to || query.dosTo) params.dos_to = query.dos_to || query.dosTo;
    if (query.updated_since || query.updatedSince) params.updated_since = query.updated_since || query.updatedSince;
    if (query.sort) params.sort = query.sort;
    if (query.limit) params.limit = query.limit;
    if (query.cursor) params.cursor = query.cursor;

    // The email filter is for the mock server only; the backend filters by token.
    const res = await apiClient.request({
      path: '/api/v1/vobs',
      params,
      mockParams: query.userEmail ? { userEmail: query.userEmail } : null
    });

    // Handle both { data: [...], page: {...} } backend format and legacy array
    const rawList = Array.isArray(res) ? res : (res?.data || []);
    const normalizedList = rawList.map(normalizeVobListItem);

    // Attach pagination info to the array so callers can inspect page if needed
    normalizedList.page = res?.page || { limit: normalizedList.length, next_cursor: null, has_more: false };
    normalizedList.data = normalizedList;

    return normalizedList;
  },

  /**
   * GET /api/v1/vobs/:id - One VOB with everything the fill screen needs
   */
  async getVobById(id) {
    const raw = await apiClient.request({
      path: `/api/v1/vobs/${id}`
    });
    return normalizeSingleVob(raw);
  },

  /**
   * PATCH /api/v1/vobs/:id - User (the assignee) only. Saves field edits.
   * Body: { version, fields: { ... }, extra: { ... }, confirm: [...] }
   */
  async patchVob(id, edits, version = 1, userEmail) {
    let payload;
    if (edits && edits.fields !== undefined) {
      payload = {
        version: edits.version !== undefined ? edits.version : version,
        fields: edits.fields || {},
        extra: edits.extra || {},
        confirm: edits.confirm || []
      };
    } else {
      payload = toBackendPatchPayload(edits, version);
    }

    // Include userEmail for mockServer audit log when offline
    if (userEmail) {
      payload.userEmail = userEmail;
    }

    return apiClient.request({
      path: `/api/v1/vobs/${id}`,
      method: 'PATCH',
      data: payload
    });
  },

  /**
   * POST /api/v1/vobs/:id/submit - User (the assignee) only. Checks VOB and routes it.
   * Body: { version }
   */
  async submitVob(id, versionOrEmail, optionalVersion) {
    // Handle both submitVob(id, version) and legacy submitVob(id, userEmail)
    let version = 1;
    let userEmail = null;

    if (typeof versionOrEmail === 'number') {
      version = versionOrEmail;
    } else if (typeof optionalVersion === 'number') {
      version = optionalVersion;
      userEmail = versionOrEmail;
    } else if (typeof versionOrEmail === 'string') {
      userEmail = versionOrEmail;
    }

    try {
      const res = await apiClient.request({
        path: `/api/v1/vobs/${id}/submit`,
        method: 'POST',
        data: { version, userEmail }
      });
      return res;
    } catch (err) {
      // Backend returns 422 with validation_failed when required fields are empty
      if (err.status === 422 && err.data?.error) {
        const errDetails = err.data.error.details || {};
        return {
          status: 'Error',
          error: err.data.error,
          version: errDetails.version,
          failingRules: errDetails.failures || []
        };
      }
      throw err;
    }
  },

  /**
   * POST /api/v1/vobs/:id/auth - Auth role only, for VOBs in auth_queue.
   * Records prior authorization and closes the VOB as approved.
   * Body: { version, auth_number, auth_valid_from, auth_valid_to }
   */
  async authVob(id, { version, auth_number, auth_valid_from, auth_valid_to, authNumber, authStartDate, authEndDate }) {
    const payload = {
      version: version || 1,
      auth_number: auth_number || authNumber || '',
      auth_valid_from: auth_valid_from || authStartDate || '',
      auth_valid_to: auth_valid_to || authEndDate || ''
    };

    return apiClient.request({
      path: `/api/v1/vobs/${id}/auth`,
      method: 'POST',
      data: payload
    });
  },

  /**
   * POST /api/v1/vobs/:id/transcript - Enqueues transcript extraction job
   */
  postTranscript(id, transcript) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/transcript`,
      method: 'POST',
      data: { transcript }
    });
  },

  /**
   * GET /api/v1/vobs/:id/extraction/:jobId - Polls extraction progress and result
   */
  getExtraction(id, jobId) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/extraction/${jobId}`
    });
  },

  /**
   * GET /api/v1/vobs/:id/audit - HIPAA audit log for this VOB
   */
  getAudit(id) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/audit`
    });
  },

  /**
   * GET /api/v1/audit - All audit logs (Admin only)
   */
  getAllAuditLogs() {
    return apiClient.request({
      path: '/api/v1/audit'
    });
  }
};
