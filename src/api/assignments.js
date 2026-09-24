import { apiClient } from './client';

export const assignmentsApi = {
  // POST /api/v1/assignments - Admin assigns or reassigns VOBs to active users
  assignVobs({ vobIds, assigneeIds, assignees, strategy = 'even', vob_ids, assignee_ids }) {
    const payload = {
      vob_ids: vob_ids || vobIds || [],
      assignee_ids: assignee_ids || assigneeIds || assignees || [],
      strategy: strategy || 'even'
    };

    return apiClient.request({
      path: '/api/v1/assignments',
      method: 'POST',
      data: payload
    });
  }
};
