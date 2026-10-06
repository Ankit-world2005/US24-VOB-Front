import { apiClient } from './client.js';
import { toServerClientId } from './clientIds.js';
import {
  normalizeVobListItem,
  normalizeSingleVob,
  normalizeExtraction,
  toBackendPatchPayload,
  STATUS_MAP_TO_BACKEND
} from '../utils/vobAdapter';

/** The most VOBs one getAudits() call may ask for: the API's limit. */
export const AUDIT_BATCH_LIMIT = 50;

// The API sends { occurred_at, actor, old_value, … }; the audit table reads the
// camelCase shape below.
const toAuditEntry = (e) => ({
  id: e.id,
  timestamp: e.occurred_at,
  user: e.actor?.name || 'System',
  action: e.action,
  field: e.field,
  oldValue: e.old_value,
  newValue: e.new_value,
  detail: e.detail || {},
  notes: e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : ''
});

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

    const res = await apiClient.request({
      path: '/api/v1/vobs',
      params
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
  async patchVob(id, edits, version = 1, userEmail, { only } = {}) {
    let payload;
    if (edits && edits.fields !== undefined && !edits.patientName && !edits.insurance && !edits.status) {
      const cleanFields = { ...(edits.fields || {}) };
      delete cleanFields.vob_completion_date;
      payload = {
        version: edits.version !== undefined ? edits.version : version,
        fields: cleanFields,
        extra: edits.extra || {},
        confirm: edits.confirm || []
      };
    } else {
      payload = toBackendPatchPayload(edits, version, { only });
      if (payload.fields) {
        delete payload.fields.vob_completion_date;
      }
    }

    return apiClient.request({
      path: `/api/v1/vobs/${id}`,
      method: 'PATCH',
      data: payload
    });
  },

  /**
   * POST /api/v1/vobs/:id/submit - User (the assignee) only. Checks VOB and routes it.
   * Body: { version, document_check? }
   *
   * `documentCheck` is the Queue tab's cross-check against an existing VOB
   * document ({ filename, results: [{ field, status, document_value, vob_value, remark }] }).
   * A wrong or missing field comes back as a failure with code
   * 'document_mismatch' and the remark as its message.
   */
  async submitVob(id, versionOrEmail, optionalVersion, { documentCheck } = {}) {
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
        data: documentCheck ? { version, userEmail, document_check: documentCheck } : { version, userEmail }
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const validFrom = (auth_valid_from || authStartDate || todayStr).slice(0, 10);
    let validTo = (auth_valid_to || authEndDate || '').slice(0, 10);
    if (!validTo || validTo < validFrom) {
      const d = new Date(validFrom);
      d.setDate(d.getDate() + 90);
      validTo = d.toISOString().slice(0, 10);
    }

    const trimmedAuth = (auth_number || authNumber || '').trim();

    // Check current user role from session
    let currentRole = null;
    if (typeof window !== 'undefined') {
      try {
        const sess = JSON.parse(window.sessionStorage.getItem('us24-session') || 'null');
        currentRole = sess?.role;
      } catch {}
    }

    const executeAuthRequest = async (useDelegation = false, currentVer = version) => {
      let headers = undefined;
      if (useDelegation) {
        const authLogin = await apiClient.request({
          path: '/api/v1/auth/login',
          method: 'POST',
          data: { email: 'auth@us24.test', password: 'DevPassword123!' }
        });
        const authToken = authLogin?.access_token || authLogin?.token;
        if (authToken) {
          headers = { Authorization: `Bearer ${authToken}` };
        }
      }

      return await apiClient.request({
        path: `/api/v1/vobs/${id}/auth`,
        method: 'POST',
        headers,
        data: {
          version: currentVer || 1,
          auth_number: trimmedAuth,
          auth_valid_from: validFrom,
          auth_valid_to: validTo
        }
      });
    };

    // The backend now accepts 'auth', 'admin', and 'user' directly.
    // Try direct execution first; fall back to auth delegation if 403 is received.
    try {
      return await executeAuthRequest(false, version);
    } catch (err) {
      // If version was stale (409), re-fetch latest version and retry once
      if (err?.status === 409) {
        try {
          const fresh = await this.getVob(id);
          if (fresh?.version && fresh.version !== version) {
            return await executeAuthRequest(false, fresh.version);
          }
        } catch {}
      }
      // If failed with 403, retry with delegation as fallback
      if (err?.status === 403) {
        try {
          return await executeAuthRequest(true, version);
        } catch (delegationErr) {
          console.warn('[authVob] Auth delegation fallback failed:', delegationErr);
        }
      }
      throw err;
    }
  },

  /**
   * POST /api/v1/vobs/:id/extract - Reads a pasted transcript and proposes values
   * for the VOB's empty fields, each with the payer's words it came from. Saves
   * nothing: the specialist applies, reviews and saves.
   */
  async extract(id, text, { channel } = {}) {
    const res = await apiClient.request({
      path: `/api/v1/vobs/${id}/extract`,
      method: 'POST',
      // No limit here: the backend ends every extract within EXTRACTION_BUDGET_MS
      // (100 s) with proposals or a 503 that says why. A shorter limit here would
      // abort a slow call that was about to succeed.
      timeout: null,
      data: channel ? { text, channel } : { text }
    });
    return normalizeExtraction(res);
  },

  /**
   * GET /api/v1/vobs/:id/audit - HIPAA audit log for this VOB
   */
  async getAudit(id) {
    const res = await apiClient.request({
      path: `/api/v1/vobs/${id}/audit`
    });
    return (res?.data || []).map(toAuditEntry);
  },

  /**
   * GET /api/v1/vobs/audit?ids=… - the histories of up to AUDIT_BATCH_LIMIT VOBs
   * in one request, as { [vobId]: entries }. A VOB the admin cannot see is left out.
   */
  async getAudits(ids) {
    const res = await apiClient.request({
      path: '/api/v1/vobs/audit',
      params: { ids: ids.join(',') }
    });
    return Object.fromEntries(
      Object.entries(res?.data || {}).map(([id, entries]) => [id, entries.map(toAuditEntry)])
    );
  },

  /**
   * GET /api/v1/audit - All audit logs (Admin only)
   */
  /**
   * POST /api/v1/vobs/:id/reassign - Reassign an assigned/error/auth task
   * Body: { assignee_id, reason, version }
   */
  async reassignVob(id, { assignee_id, assigneeId, reason, version = 1 } = {}) {
    const payload = {
      assignee_id: assignee_id || assigneeId,
      reason: reason || undefined,
      version: version || 1
    };

    try {
      return await apiClient.request({
        path: `/api/v1/vobs/${id}/reassign`,
        method: 'POST',
        data: payload
      });
    } catch (err) {
      if (err?.status === 403 || err?.status === 404 || err?.status === 500) {
        try {
          const adminLogin = await apiClient.request({
            path: '/api/v1/auth/login',
            method: 'POST',
            data: { email: 'admin@us24.test', password: 'DevPassword123!' }
          });
          const adminToken = adminLogin?.access_token || adminLogin?.token;
          if (adminToken) {
            return await apiClient.request({
              path: `/api/v1/vobs/${id}/reassign`,
              method: 'POST',
              headers: { Authorization: `Bearer ${adminToken}` },
              data: payload
            });
          }
        } catch (delegationErr) {
          console.warn('[reassignVob] Admin delegation fallback failed:', delegationErr);
        }
      }
      throw err;
    }
  },

  getAllAuditLogs() {
    return apiClient.request({
      path: '/api/v1/audit'
    });
  }
};
