import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { usersApi } from '../../api/users';
import { AddSpecialistModal } from '../../components/admin/AddSpecialistModal';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { ResetPasswordModal } from '../../components/admin/ResetPasswordModal';
import { CLIENTS } from '../../data/clients';

const AVATAR_PALETTES = [
  { bg: '#dbeafe', color: '#1d4ed8' }, // Blue
  { bg: '#f3e8ff', color: '#7e22ce' }, // Purple
  { bg: '#ccfbf1', color: '#0f766e' }, // Teal
  { bg: '#fef3c7', color: '#b45309' }, // Amber
  { bg: '#fee2e2', color: '#b91c1c' }, // Red
  { bg: '#e0e7ff', color: '#4338ca' }, // Indigo
  { bg: '#dcfce7', color: '#15803d' }, // Green
  { bg: '#fce7f3', color: '#be185d' }  // Pink
];

function getAvatarStyle(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function formatLastLogin(dateStr) {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) + ', ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'Never';
  }
}

export function UserManagementView() {
  const { showToast } = useWorkspace();

  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals & Popovers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const menuRef = useRef(null);

  // Close 3-dot menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load users & clients
  const loadData = () => {
    setLoading(true);
    setLoadError('');

    Promise.all([
      usersApi.getUsers(),
      usersApi.getClients().catch(() => [])
    ]).then(([usersRes, clientsRes]) => {
      const uList = Array.isArray(usersRes)
        ? usersRes
        : Array.isArray(usersRes?.data)
        ? usersRes.data
        : Array.isArray(usersRes?.users)
        ? usersRes.users
        : [];
      setUsers(uList);

      const cList = Array.isArray(clientsRes) && clientsRes.length > 0
        ? clientsRes
        : (CLIENTS || []).map(c => ({ id: c.id, name: c.name }));
      setClients(cList);

      setLoading(false);
    }).catch(err => {
      console.error('Failed to load user management data:', err);
      setLoadError(err?.message || 'Could not load user access data.');
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [reloadKey]);

  // Derived user status classification
  const getUserStatus = (user) => {
    if (user.status === 'suspended') return 'suspended';
    if (user.status === 'revoked' || user.status === 'deactivated' || user.active === false) return 'revoked';
    return 'active';
  };

  // KPI Metrics calculation
  const metrics = useMemo(() => {
    let total = users.length;
    let active = 0;
    let suspended = 0;
    let revoked = 0;

    users.forEach(u => {
      const s = getUserStatus(u);
      if (s === 'active') active++;
      else if (s === 'suspended') suspended++;
      else if (s === 'revoked') revoked++;
    });

    return { total, active, suspended, revoked };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const status = getUserStatus(u);
      const role = u.role || 'user';

      // 1. Role Filter
      if (roleFilter !== 'all' && role !== roleFilter) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      // 3. Client Filter
      if (clientFilter !== 'all') {
        const isAdmin = role === 'admin';
        const assigned = u.assignedClients || [];
        const clientIds = u.clientIds || [];
        const matchesClient = isAdmin || 
          clientIds.includes(clientFilter) || 
          assigned.some(cName => String(cName).toLowerCase().includes(clientFilter.toLowerCase()));
        if (!matchesClient) return false;
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (u.name || '').toLowerCase().includes(q);
        const emailMatch = (u.email || '').toLowerCase().includes(q);
        const idMatch = (u.id || '').toLowerCase().includes(q);
        const clientMatch = (u.assignedClients || []).some(c => String(c).toLowerCase().includes(q));
        if (!nameMatch && !emailMatch && !idMatch && !clientMatch) {
          return false;
        }
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter, clientFilter]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / rowsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredUsers.slice(start, start + rowsPerPage);
  }, [filteredUsers, currentPage, rowsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, clientFilter, rowsPerPage]);

  // Status Toggle Action
  const handleSetStatus = async (user, targetStatus) => {
    setActiveMenuId(null);
    const userId = user.id || user._id;
    const isActive = targetStatus === 'active';

    try {
      await usersApi.patchUser(userId, {
        status: targetStatus,
        active: isActive
      });

      const msg = targetStatus === 'active'
        ? `User ${user.name || user.email} reactivated.`
        : targetStatus === 'suspended'
        ? `User ${user.name || user.email} access suspended. Sessions revoked.`
        : `User ${user.name || user.email} access revoked immediately (SEC-7).`;
      
      showToast(msg, targetStatus === 'active' ? 'success' : 'info');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Failed to update user access status.', 'error');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setClientFilter('all');
  };

  const isFiltered = searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || clientFilter !== 'all';

  return (
    <div className="user-management-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      {/* Top Header Panel */}
      <div className="panel-card" style={{ padding: '20px 24px' }}>
        <div className="panel-header" style={{ marginBottom: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>👥</span>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                User Access & Role Management
              </h3>
            </div>
            <span className="panel-sub" style={{ marginTop: '4px', display: 'block' }}>
              Manage portal users, roles, client queues, permissions, and credential security
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{
                height: '38px',
                padding: '0 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                borderRadius: 'var(--r-md, 6px)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--cobalt, #2563eb)',
                color: '#fff',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
              onClick={() => setIsAddModalOpen(true)}
              id="add-specialist-btn"
            >
              + Add User
            </button>
            <div className="security-pill" title="SEC-7 guarantees account revocation terminates active sessions immediately">
              Immediate Revocation Active (SEC-7)
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="user-kpi-grid">
        <div
          className={`user-kpi-card ${statusFilter === 'all' && !searchQuery && roleFilter === 'all' && clientFilter === 'all' ? 'selected' : ''}`}
          onClick={() => setStatusFilter('all')}
          title="Click to view all users"
        >
          <div className="user-kpi-icon total">
            👥
          </div>
          <div className="user-kpi-content">
            <span className="user-kpi-label">Total Users</span>
            <span className="user-kpi-number">{metrics.total}</span>
          </div>
        </div>

        <div
          className={`user-kpi-card ${statusFilter === 'active' ? 'selected' : ''}`}
          onClick={() => setStatusFilter(s => s === 'active' ? 'all' : 'active')}
          title="Click to filter active users"
        >
          <div className="user-kpi-icon active">
            ✓
          </div>
          <div className="user-kpi-content">
            <span className="user-kpi-label">Active</span>
            <span className="user-kpi-number" style={{ color: '#16a34a' }}>{metrics.active}</span>
          </div>
        </div>

        <div
          className={`user-kpi-card ${statusFilter === 'suspended' ? 'selected' : ''}`}
          onClick={() => setStatusFilter(s => s === 'suspended' ? 'all' : 'suspended')}
          title="Click to filter suspended users"
        >
          <div className="user-kpi-icon suspended">
            ⏸
          </div>
          <div className="user-kpi-content">
            <span className="user-kpi-label">Suspended</span>
            <span className="user-kpi-number" style={{ color: '#d97706' }}>{metrics.suspended}</span>
          </div>
        </div>

        <div
          className={`user-kpi-card ${statusFilter === 'revoked' ? 'selected' : ''}`}
          onClick={() => setStatusFilter(s => s === 'revoked' ? 'all' : 'revoked')}
          title="Click to filter revoked users"
        >
          <div className="user-kpi-icon revoked">
            🚫
          </div>
          <div className="user-kpi-content">
            <span className="user-kpi-label">Revoked</span>
            <span className="user-kpi-number" style={{ color: '#dc2626' }}>{metrics.revoked}</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="panel-card" style={{ padding: '20px' }}>
        {/* Search & Filter Controls */}
        <div className="user-filter-toolbar">
          <div className="user-search-box">
            <span className="user-search-icon">🔍</span>
            <input
              type="text"
              className="user-search-input"
              placeholder="Search by name, email or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-soft)',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div className="user-filter-dropdowns">
            {/* Role Filter */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select
                className="user-filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">Role: All Roles</option>
                <option value="admin">Administrator</option>
                <option value="auth">Auth Specialist</option>
                <option value="user">Specialist</option>
              </select>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select
                className="user-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">Status: All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            {/* Client Filter */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select
                className="user-filter-select"
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                aria-label="Filter by client"
              >
                <option value="all">Client: All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.name || c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: 'none',
                  border: '1px dashed var(--rule, #cbd5e1)',
                  borderRadius: '6px',
                  padding: '0 12px',
                  height: '38px',
                  fontSize: '12px',
                  color: 'var(--ink-soft, #64748b)',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* User Table */}
        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '32%' }}>User</th>
                <th style={{ width: '18%' }}>Role</th>
                <th style={{ width: '16%' }}>Status</th>
                <th style={{ width: '24%' }}>Last Login</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span>⏳</span> Loading user access records...
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    <span style={{ color: 'var(--danger)' }}>Could not load user data.</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">
                    {isFiltered ? 'No users matching selected filters.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => {
                  const id = u.id || u.email;
                  const displayName = u.name || (u.email ? u.email.split('@')[0] : 'User');
                  const initials = displayName
                    .split(' ')
                    .filter(Boolean)
                    .map(p => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U';

                  const avatarStyle = getAvatarStyle(displayName);
                  const status = getUserStatus(u);
                  const role = u.role || 'user';
                  const isAdmin = role === 'admin';

                  return (
                    <tr key={id}>
                      {/* User Avatar + Name + Email */}
                      <td>
                        <div className="user-identity-cell">
                          <div
                            className="user-avatar-circle"
                            style={{ background: avatarStyle.bg, color: avatarStyle.color }}
                          >
                            {initials}
                          </div>
                          <div className="user-identity-info">
                            <span className="user-identity-name">{displayName}</span>
                            <span className="user-identity-email">{u.email || '—'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td>
                        <span className={`role-badge role-${role}`}>
                          {role === 'admin' ? 'Administrator' : role === 'auth' ? 'Auth Specialist' : 'Specialist'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`status-pill-badge ${status}`}>
                          <span className="status-dot" />
                          {status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : 'Revoked'}
                        </span>
                      </td>

                      {/* Last Login */}
                      <td style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
                        {formatLastLogin(u.lastLogin)}
                      </td>

                      {/* Action Menu Popover */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="user-action-menu-container" ref={activeMenuId === id ? menuRef : null}>
                          <button
                            type="button"
                            className="user-action-menu-btn"
                            onClick={() => setActiveMenuId(activeMenuId === id ? null : id)}
                            aria-label={`Actions for ${displayName}`}
                            title="Actions"
                          >
                            ⋮
                          </button>

                          {activeMenuId === id && (
                            <div className="user-action-dropdown">
                              <button
                                type="button"
                                className="user-action-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setEditingUser(u);
                                }}
                              >
                                ✏️ Edit Access & Role
                              </button>

                              <button
                                type="button"
                                className="user-action-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setResettingUser(u);
                                }}
                              >
                                🔑 Reset Password
                              </button>

                              <div className="user-action-divider" />

                              {status === 'active' ? (
                                <>
                                  <button
                                    type="button"
                                    className="user-action-item"
                                    onClick={() => handleSetStatus(u, 'suspended')}
                                  >
                                    ⏸ Suspend Access
                                  </button>
                                  <button
                                    type="button"
                                    className="user-action-item danger"
                                    onClick={() => handleSetStatus(u, 'revoked')}
                                  >
                                    🚫 Revoke Access
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="user-action-item success"
                                  onClick={() => handleSetStatus(u, 'active')}
                                >
                                  ✓ Activate Account
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid var(--rule, #e2e8f0)',
            marginTop: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
            Showing {filteredUsers.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} users
            {filteredUsers.length !== users.length && ` (filtered from ${users.length})`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              style={{
                height: '30px',
                padding: '0 6px',
                fontSize: '12px',
                border: '1px solid var(--rule)',
                borderRadius: '4px',
                background: 'var(--surface)',
                cursor: 'pointer'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                height: '30px',
                padding: '0 10px',
                border: '1px solid var(--rule)',
                borderRadius: '4px',
                background: 'var(--surface)',
                fontSize: '12px',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage <= 1 ? 0.5 : 1
              }}
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, currentPage - 3),
              Math.min(totalPages, currentPage + 2)
            ).map(pg => (
              <button
                key={pg}
                type="button"
                onClick={() => setCurrentPage(pg)}
                style={{
                  height: '30px',
                  width: '30px',
                  borderRadius: '4px',
                  border: pg === currentPage ? '1px solid var(--cobalt)' : '1px solid var(--rule)',
                  background: pg === currentPage ? 'var(--cobalt, #2563eb)' : 'var(--surface)',
                  color: pg === currentPage ? '#fff' : 'var(--ink)',
                  fontWeight: pg === currentPage ? 700 : 400,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {pg}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                height: '30px',
                padding: '0 10px',
                border: '1px solid var(--rule)',
                borderRadius: '4px',
                background: 'var(--surface)',
                fontSize: '12px',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.5 : 1
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <AddSpecialistModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={loadData}
        clients={clients}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={Boolean(editingUser)}
        user={editingUser}
        clients={clients}
        onClose={() => setEditingUser(null)}
        onSuccess={loadData}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={Boolean(resettingUser)}
        user={resettingUser}
        onClose={() => setResettingUser(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
