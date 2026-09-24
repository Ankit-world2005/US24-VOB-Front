import { apiClient } from './client';
import { assignmentsApi } from './assignments';

export const uploadsApi = {
  /**
   * POST /uploads - Check a task file's rows and hold them for commit.
   * `upload` is { client_id, kind: 'tasks', filename, rows: [{ row, patient_name, ... }] };
   * answers with the preview { id, status, total_rows, valid_rows, rejected, duplicates }.
   * `clientSlug` reaches only the mock server, which keys clients by slug.
   */
  uploadFile(upload, clientSlug) {
    return apiClient.request({
      path: '/api/v1/uploads',
      method: 'POST',
      data: upload,
      mockParams: { client: clientSlug }
    });
  },

  // GET /uploads/:id/preview
  getPreview(uploadId) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/preview`
    });
  },

  /**
   * POST /uploads/:id/commit - Creates the held rows as assigned VOBs, less `skipRows`.
   * Idempotent on `idempotencyKey`: a retry returns the first result.
   * Answers { id, created, vob_ids }.
   */
  commitUpload(uploadId, { skipRows = [], idempotencyKey }, adminEmail) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/commit`,
      method: 'POST',
      data: { skip_rows: skipRows, idempotency_key: idempotencyKey },
      mockParams: { adminEmail }
    });
  },

  // POST /api/v1/assignments
  assignVobs(params, adminEmail) {
    return assignmentsApi.assignVobs({
      ...params,
      adminEmail
    });
  }
};
