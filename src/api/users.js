import { apiClient } from './client';

export const usersApi = {
  // GET /users
  async getUsers() {
    const res = await apiClient.request({ path: '/api/v1/users' });
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.users)) return res.users;
    return [];
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
