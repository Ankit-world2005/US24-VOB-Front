import { apiClient } from './client';
import { assignmentsApi } from './assignments';

export const uploadsApi = {
  /**
   * POST /api/v1/uploads - Check a task file's rows and hold them for commit.
   * `upload` is { client_id, kind: 'tasks', filename, rows: [{ row, patient_name, ... }] };
   * answers with the preview { id, status, total_rows, valid_rows, rejected, duplicates }.
   */
  uploadFile(upload) {
    return apiClient.request({
      path: '/api/v1/uploads',
      method: 'POST',
      data: upload
    });
  },

  // GET /api/v1/uploads/:id/preview
  getPreview(uploadId) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/preview`
    });
  },

  /**
   * POST /api/v1/uploads/:id/commit - Creates the held rows as assigned VOBs, less `skipRows`.
   * Idempotent on `idempotencyKey`: a retry returns the first result.
   * Answers { id, created, vob_ids }.
   */
  commitUpload(uploadId, { skipRows = [], idempotencyKey } = {}) {
    const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/commit`,
      method: 'POST',
      data: { skip_rows: skipRows, idempotency_key: key }
    });
  },

  // POST /api/v1/assignments
  assignVobs(params) {
    return assignmentsApi.assignVobs(params);
  }
};
