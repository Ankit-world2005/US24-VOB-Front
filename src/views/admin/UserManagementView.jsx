import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { usersApi } from '../../api/users';

export function UserManagementView() {
  const { showToast } = useWorkspace();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadUsers = () => {
    setLoading(true);
    setLoadError('');
    usersApi.getUsers().then(res => {
      setUsers(res);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  };

  useEffect(() => {
    loadUsers();
  }, [reloadKey]);

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    try {
      await usersApi.patchUser(user.id, { status: nextStatus });
      showToast(`User ${user.name} is now ${nextStatus.toUpperCase()}. Session immediately terminated if revoked.`, "info");
      loadUsers();
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await usersApi.patchUser(user.id, { role: nextRole });
      showToast(`Role updated for ${user.name} to ${nextRole.toUpperCase()}`, "success");
      loadUsers();
    } catch (err) {
      showToast("Failed to update role", "error");
    }
  };

  return (
    <div className="user-management-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>User Access & Role Management (FR-2, SEC-7)</h3>
            <span className="panel-sub">Grant, update, or immediately revoke employee portal access and security permissions</span>
          </div>
          <div className="security-pill">
            Immediate Revocation Active (SEC-7)
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Company Outlook ID</th>
                <th>Access Level</th>
                <th>Assigned Client Queues</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="table-empty">Loading users…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="6" className="table-empty">Could not load this data.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <span className="user-avatar-sm">{u.name.split(' ').map(p => p[0]).join('')}</span>
                        <span className="bold">{u.name}</span>
                      </div>
                    </td>
                    <td className="mono">{u.email}</td>
                    <td>
                      <span className={`role ${u.role}`}>
                        {u.role === 'admin' ? '★ Administrator' : '● Specialist'}
                      </span>
                    </td>
                    <td>
                      {u.assignedClients.includes('all') ? (
                        <span className="badge-all-clients">All 8 Clients</span>
                      ) : (
                        <div className="client-tags-group">
                          {u.assignedClients.map(c => (
                            <span key={c} className="mini-tag">{c}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${u.status === 'active' ? 'active-green' : 'revoked-red'}`}>
                        {u.status === 'active' ? '● Active' : '✕ Revoked'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn-action-link"
                          onClick={() => handleToggleRole(u)}
                        >
                          Change to {u.role === 'admin' ? 'Specialist' : 'Admin'}
                        </button>
                        <button
                          type="button"
                          className={`btn-action-link ${u.status === 'active' ? 'danger-link' : 'success-link'}`}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.status === 'active' ? 'Revoke Access' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
