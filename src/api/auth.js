import { apiClient } from './client';

export const authApi = {
  // POST /api/v1/auth/login
  login({ email, password }) {
    return apiClient.request({
      path: '/api/v1/auth/login',
      method: 'POST',
      data: { email, password }
    });
  },

  // GET /api/v1/auth/me
  getMe(email) {
    return apiClient.request({
      path: '/api/v1/auth/me',
      params: email ? { email } : undefined
    });
  },

  // POST /api/v1/auth/logout
  logout() {
    return apiClient.request({
      path: '/api/v1/auth/logout',
      method: 'POST'
    });
  },

  // POST /api/v1/auth/refresh
  refresh() {
    return apiClient.request({
      path: '/api/v1/auth/refresh',
      method: 'POST'
    });
  }
};
