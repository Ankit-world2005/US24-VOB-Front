import { apiClient } from './client';
import { assignmentsApi } from './assignments';

export const uploadsApi = {
  // POST /uploads
  uploadFile(fileData, client) {
    return apiClient.request({
      path: '/api/v1/uploads',
      method: 'POST',
      data: fileData,
      params: { client }
    });
  },

  // GET /uploads/:id/preview
  getPreview(uploadId) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/preview`
    });
  },

  // POST /uploads/:id/commit
  commitUpload(uploadId, adminEmail, assignedTo) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/commit`,
      method: 'POST',
      data: { adminEmail, assignedTo }
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
