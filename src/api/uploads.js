import { apiClient } from './client';

export const uploadsApi = {
  // POST /uploads
  uploadFile(fileData, client) {
    return apiClient.request({
      path: '/uploads',
      method: 'POST',
      data: fileData,
      params: { client }
    });
  },

  // GET /uploads/:id/preview
  getPreview(uploadId) {
    return apiClient.request({
      path: `/uploads/${uploadId}/preview`
    });
  },

  // POST /uploads/:id/commit
  commitUpload(uploadId, adminEmail) {
    return apiClient.request({
      path: `/uploads/${uploadId}/commit`,
      method: 'POST',
      data: { adminEmail }
    });
  },

  // POST /assignments
  assignVobs({ vobIds, assignees, adminEmail }) {
    return apiClient.request({
      path: '/assignments',
      method: 'POST',
      data: { vobIds, assignees },
      params: { adminEmail }
    });
  }
};
