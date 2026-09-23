import { apiClient } from './client';

export const usersApi = {
  // GET /users
  getUsers() {
    return apiClient.request({ path: '/api/v1/users' });
  },

  // POST /users
  createUser(userData) {
    return apiClient.request({
      path: '/api/v1/users',
      method: 'POST',
      data: userData
    });
  },

  // PATCH /users/:id
  patchUser(id, updates) {
    return apiClient.request({
      path: `/api/v1/users/${id}`,
      method: 'PATCH',
      data: updates
    });
  }
};
