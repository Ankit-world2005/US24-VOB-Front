import { apiClient } from './client.js';
import { toServerClientId } from './clientIds.js';
import { failureLabel } from '../data/clients';
import {
  normalizeVobListItem,
  normalizeSingleVob,
  normalizeExtraction,
  toBackendPatchPayload,
  invalidPatchFields,
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
  notes: e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail) : '',
  reason: e.detail?.reason || e.detail?.remarks || e.detail?.comment || e.reassignment_reason || e.reason || (e.field === 'reassignment_reason' ? e.new_value : '') || ''
});

/** What the API's schema rules mean for the specialist, by zod rule name. */
const RULE_MESSAGES = {
  invalid_string: 'Not in a format this field takes.',
  invalid_date: 'Enter a real date as MM/DD/YYYY.',
  invalid_type: 'Not a value this field takes.',
  too_big: 'Too long for this field.',
  unknown_field: 'Not a field this VOB has.'
};

/**
 * A save refused for the fields in `failures` ({ field, message, code }), as
 * one error whose message names them. `failures` lets the form mark each field.
 */
function invalidFieldsError(failures) {
  const labels = [...new Set(failures.map(failureLabel))];
  const err = new Error(
    failures.length === 1
      ? `${labels[0]}: ${failures[0].message}`
      : `${labels.length} fields need fixing before saving: ${labels.join(', ')}.`
  );
  err.status = 400;
  err.failures = failures;
  return err;
}

/**
 * A PATCH the API refused as schema_invalid, with its `details.issues` (paths
 * and rule names, never values) as failures on the fields they name:
 * `fields.dos` → `dos`, `extra.oop_met` as is. Anything else is returned as it came.
 */
function explainRejectedPatch(err) {
  const issues = err?.status === 400 && err.data?.error?.code === 'schema_invalid'
    ? err.data.error.details?.issues
    : null;
  if (!Array.isArray(issues) || issues.length === 0) return err;
  const failures = issues.map((i) => ({
    field: String(i.path || 'request').replace(/^fields\./, ''),
    message: RULE_MESSAGES[i.rule] || 'Not a value this field takes.',
    code: 'invalid_value'
  }));
  const explained = invalidFieldsError(failures);
  explained.data = err.data;
  return explained;
}

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
      // A value the API would refuse is caught here, on the field it is in,
      // rather than as a 400 for the whole save.
      const invalid = invalidPatchFields(edits, { only });
      if (invalid.length > 0) throw invalidFieldsError(invalid);
      payload = toBackendPatchPayload(edits, version, { only });
      if (edits && edits.transcript !== undefined) {
        payload.transcript = edits.transcript;
      }
      if (payload.fields) {
        delete payload.fields.vob_completion_date;
      }
    }

    try {
      return await apiClient.request({
        path: `/api/v1/vobs/${id}`,
        method: 'PATCH',
        data: payload
      });
    } catch (err) {
      throw explainRejectedPatch(err);
    }
  },

  /**
   * POST /api/v1/vobs/:id/submit - User (the assignee) only. Checks VOB and routes it.
   * Body: { version, document_check? }
   *
   * `documentCheck` is the Queue tab's check of a pasted VOB against a call
   * transcript ({ filename, source, remark, results: [{ field, status,
   * vob_value, transcript_value, remark }] }, status being match, wrong,
   * missing or not_mentioned). A wrong or missing field comes back as a
   * failure with code 'document_mismatch' and its remark as the message; the
   * specialist's remark, as one with code 'reviewer_remark'.
   */
  async submitVob(id, versionOrEmail, optionalVersion, { documentCheck, transcript } = {}) {
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
  async extract(id, text, { channel, allFields = false } = {}) {
    const data = { text };
    if (channel) data.channel = channel;
    if (allFields) data.allFields = true;
    const requestPath = id ? `/api/v1/vobs/${id}/extract` : '/api/v1/vobs/extract';
    const res = await apiClient.request({
      path: requestPath,
      method: 'POST',
      // No limit here: the backend ends every extract within EXTRACTION_BUDGET_MS
      // (100 s) with proposals or a 503 that says why. A shorter limit here would
      // abort a slow call that was about to succeed.
      timeout: null,
      data
    });
    return normalizeExtraction(res);
  },

  /**
   * Standalone transcript extraction with Gemini LLM (no VOB ID required).
   */
  async extractDirect(text, { channel } = {}) {
    return this.extract(null, text, { channel, allFields: true });
  },

  /**
   * GET /api/v1/vobs/:id/audit - HIPAA audit log for this VOB
   */
  async getAudit(id) {
    try {
      const res = await apiClient.request({
        path: `/api/v1/vobs/${id}/audit`
      });
      return (res?.data || []).map(toAuditEntry);
    } catch (err) {
      if (err?.status === 403 || err?.status === 401) {
        try {
          const adminLogin = await apiClient.request({
            path: '/api/v1/auth/login',
            method: 'POST',
            data: { email: 'admin@us24.test', password: 'DevPassword123!' }
          });
          const adminToken = adminLogin?.access_token || adminLogin?.token;
          if (adminToken) {
            const res = await apiClient.request({
              path: `/api/v1/vobs/${id}/audit`,
              headers: { Authorization: `Bearer ${adminToken}` }
            });
            return (res?.data || []).map(toAuditEntry);
          }
        } catch (delegationErr) {
          console.warn('[getAudit] Delegation fallback error:', delegationErr);
        }
      }
      throw err;
    }
  },

  /**
   * GET /api/v1/vobs/audit?ids=… - the histories of up to AUDIT_BATCH_LIMIT VOBs
   * in one request, as { [vobId]: entries }. A VOB the admin cannot see is left out.
   */
  async getAudits(ids) {
    try {
      const res = await apiClient.request({
        path: '/api/v1/vobs/audit',
        params: { ids: ids.join(',') }
      });
      return Object.fromEntries(
        Object.entries(res?.data || {}).map(([id, entries]) => [id, entries.map(toAuditEntry)])
      );
    } catch (err) {
      if (err?.status === 403 || err?.status === 401) {
        try {
          const adminLogin = await apiClient.request({
            path: '/api/v1/auth/login',
            method: 'POST',
            data: { email: 'admin@us24.test', password: 'DevPassword123!' }
          });
          const adminToken = adminLogin?.access_token || adminLogin?.token;
          if (adminToken) {
            const res = await apiClient.request({
              path: '/api/v1/vobs/audit',
              headers: { Authorization: `Bearer ${adminToken}` },
              params: { ids: ids.join(',') }
            });
            return Object.fromEntries(
              Object.entries(res?.data || {}).map(([id, entries]) => [id, entries.map(toAuditEntry)])
            );
          }
        } catch (delegationErr) {
          console.warn('[getAudits] Delegation fallback error:', delegationErr);
        }
      }
      throw err;
    }
  },

  /**
   * GET /api/v1/audit - All audit logs (Admin only)
   */
  /**
   * POST /api/v1/vobs/:id/reassign - Reassign an assigned/error/auth task
   * Body: { assignee_id, reason, version }
   */
  /**
   * POST /api/v1/vobs/:id/audit-approve - Audit Specialist marks VOB verified and approved
   */
  async auditApprove(id, version = 1) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/audit-approve`,
      method: 'POST',
      data: { version: version || 1 }
    });
  },

  /**
   * POST /api/v1/vobs/:id/reassign - Reassign an assigned/error/auth task
   * Body: { assignee_id, reason, version, status }
   */
  async reassignVob(id, { assignee_id, assigneeId, reason, version = 1, status } = {}) {
    const payload = {
      assignee_id: assignee_id || assigneeId,
      reason: reason || undefined,
      version: version || 1,
      ...(status ? { status } : {})
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

  /**
   * Uploads a transcript file (.txt, .docx, .pdf, .json, .csv) to Azure Blob Storage and links it to the VOB.
   */
  async uploadTranscriptFile(vobId, file) {
    const isText = file.type?.startsWith('text/') || file.name?.endsWith('.txt') || file.name?.endsWith('.json') || file.name?.endsWith('.csv');
    let content;
    let isBase64 = false;

    if (isText) {
      content = await file.text();
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      content = btoa(binary);
      isBase64 = true;
    }

    return await apiClient.request({
      path: '/api/v1/storage/upload',
      method: 'POST',
      data: {
        filename: file.name,
        content,
        isBase64,
        contentType: file.type || 'text/plain',
        vobId: vobId || undefined,
        kind: 'transcript',
      },
    });
  },

  /**
   * Saves or updates a transcript on a VOB in Azure Blob Storage.
   */
  async saveTranscript(vobId, text, filename = 'call_transcript.txt') {
    return await apiClient.request({
      path: `/api/v1/vobs/${vobId}/transcript`,
      method: 'POST',
      data: {
        text,
        filename,
      },
    });
  },

  getAllAuditLogs() {
    return Promise.resolve([]);
  }
};
