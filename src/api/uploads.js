import { apiClient } from './client';

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
  commitUpload(uploadId, adminEmail) {
    return apiClient.request({
      path: `/api/v1/uploads/${uploadId}/commit`,
      method: 'POST',
      data: { adminEmail }
    });
  },

  // POST /assignments
  assignVobs({ vobIds, assignees, adminEmail }) {
    return apiClient.request({
      path: '/api/v1/assignments',
      method: 'POST',
      data: { vobIds, assignees },
      params: { adminEmail }
    });
  }
};
