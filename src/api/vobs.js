import { apiClient } from './client';

export const vobsApi = {
  // GET /vobs
  getVobs({ clientId, status, userEmail, search } = {}) {
    return apiClient.request({
      path: '/api/v1/vobs',
      params: { clientId, status, userEmail, search }
    });
  },

  // GET /vobs/:id
  getVobById(id) {
    return apiClient.request({ path: `/api/v1/vobs/${id}` });
  },

  // PATCH /vobs/:id
  patchVob(id, edits, version, userEmail) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}`,
      method: 'PATCH',
      data: { edits, version, userEmail }
    });
  },

  // POST /vobs/:id/submit
  submitVob(id, userEmail) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/submit`,
      method: 'POST',
      data: { userEmail }
    });
  },

  // POST /vobs/:id/transcript
  postTranscript(id, transcript) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/transcript`,
      method: 'POST',
      data: { transcript }
    });
  },

  // GET /vobs/:id/extraction/:jobId
  getExtraction(id, jobId) {
    return apiClient.request({
      path: `/api/v1/vobs/${id}/extraction/${jobId}`
    });
  },

  // GET /vobs/:id/audit
  getAudit(id) {
    return apiClient.request({ path: `/api/v1/vobs/${id}/audit` });
  },

  // GET /audit (all logs for Admin)
  getAllAuditLogs() {
    return apiClient.request({ path: '/api/v1/audit' });
  }
};
