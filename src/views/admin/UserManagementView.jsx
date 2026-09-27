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
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.users)
        ? res.users
        : [];
      setUsers(list);
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
    const isActive = user.status === 'active' || (user.status !== 'deactivated' && user.status !== 'inactive' && user.status !== 'revoked' && user.active !== false && user.is_active !== false);
    const nextStatus = isActive ? 'deactivated' : 'active';
    const userId = user.id || user._id;
    try {
      await usersApi.patchUser(userId, { status: nextStatus, active: !isActive });
      showToast(`User ${user.name || user.email} is now ${nextStatus.toUpperCase()}. Session immediately terminated if revoked.`, "info");
      loadUsers();
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const userId = user.id || user._id;
    try {
      await usersApi.patchUser(userId, { role: nextRole });
      showToast(`Role updated for ${user.name || user.email} to ${nextRole === 'admin' ? 'ADMIN' : 'SPECIALIST'}`, "success");
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
              ) : (!users || users.length === 0) ? (
                <tr><td colSpan="6" className="table-empty">No users found.</td></tr>
              ) : (
                users.map(u => {
                  const id = u.id || u._id || u.email || Math.random().toString();
                  const displayName = u.name || (u.email ? u.email.split('@')[0] : 'User');
                  const initials = displayName
                    .split(' ')
                    .filter(Boolean)
                    .map(p => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U';

                  const isAdmin = u.role === 'admin';
                  const roleLabel = isAdmin ? '★ Administrator' : '● Specialist';

                  // Support array, comma string, or fallback properties (assignedClients, assigned_clients, clients)
                  const rawClients = u.assignedClients ?? u.assigned_clients ?? u.clients;
                  let assignedClients = [];
                  if (Array.isArray(rawClients)) {
                    assignedClients = rawClients;
                  } else if (typeof rawClients === 'string' && rawClients.trim()) {
                    assignedClients = rawClients.split(',').map(s => s.trim()).filter(Boolean);
                  } else if (isAdmin) {
                    assignedClients = ['all'];
                  }

                  const isAllClients = assignedClients.some(c => typeof c === 'string' && c.toLowerCase() === 'all') || (isAdmin && assignedClients.length === 0);

                  const isActive = u.status === 'active' || (u.status !== 'deactivated' && u.status !== 'inactive' && u.status !== 'revoked' && u.active !== false && u.is_active !== false);

                  return (
                    <tr key={id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-avatar-sm">{initials}</span>
                          <span className="bold">{displayName}</span>
                        </div>
                      </td>
                      <td className="mono">{u.email || '—'}</td>
                      <td>
                        <span className={`role ${u.role || 'user'}`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td>
                        {isAllClients ? (
                          <span className="badge-all-clients">All Clients</span>
                        ) : assignedClients.length > 0 ? (
                          <div className="client-tags-group">
                            {assignedClients.map(c => (
                              <span key={c} className="mini-tag">{c}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="mini-tag" style={{ opacity: 0.6, background: '#334155', color: '#94a3b8' }}>None assigned</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${isActive ? 'active-green' : 'revoked-red'}`}>
                          {isActive ? '● Active' : '✕ Revoked'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            type="button"
                            className="btn-action-link"
                            onClick={() => handleToggleRole(u)}
                          >
                            Change to {isAdmin ? 'Specialist' : 'Admin'}
                          </button>
                          <button
                            type="button"
                            className={`btn-action-link ${isActive ? 'danger-link' : 'success-link'}`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {isActive ? 'Revoke Access' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
