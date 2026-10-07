import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { useWorkspace } from '../../context/WorkspaceContext';

export function EditUserModal({ isOpen, onClose, user, clients = [], onSuccess }) {
  const { showToast } = useWorkspace();

  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name || '');
      setRole(user.role || 'user');
      setErrorMessage('');

      // Populate selected client IDs from user data
      if (Array.isArray(user.clientIds) && user.clientIds.length > 0) {
        setSelectedClientIds(user.clientIds);
      } else if (Array.isArray(user.assignedClients)) {
        // Fallback: match by name
        const matchedIds = clients
          .filter(c => user.assignedClients.some(ac => 
            String(ac).toLowerCase() === String(c.name).toLowerCase() ||
            String(ac).toLowerCase() === String(c.id).toLowerCase()
          ))
          .map(c => c.id);
        setSelectedClientIds(matchedIds);
      } else {
        setSelectedClientIds([]);
      }
    }
  }, [isOpen, user, clients]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !user) return null;

  const handleToggleClient = (clientId) => {
    setSelectedClientIds(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAllClients = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map(c => c.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMessage('Employee name cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        role,
        clientIds: selectedClientIds
      };

      await usersApi.patchUser(user.id, payload);
      showToast(`User ${cleanName} updated successfully.`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to update user:', err);
      const msg = err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to update user settings.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isAllSelected = clients.length > 0 && selectedClientIds.length === clients.length;

  return (
    <div
      className="modal-overlay"
      style={{ overflowY: 'auto', padding: '24px 16px' }}
      onClick={() => !submitting && onClose()}
    >
      <div
        className="modal-container"
        style={{
          maxWidth: '560px',
          maxHeight: 'min(92vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-eyebrow">Access Control · FR-2</div>
            <h3 id="edit-user-title" className="modal-title" style={{ margin: '4px 0 0 0' }}>
              Edit User Access & Permissions
            </h3>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          <div
            className="modal-body"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            {errorMessage && (
              <div
                style={{
                  background: 'var(--danger-bg, #fdf0f1)',
                  color: 'var(--danger, #c9192e)',
                  border: '1px solid rgba(201, 25, 46, 0.25)',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
                role="alert"
              >
                {errorMessage}
              </div>
            )}

            {/* User Info (Email read-only) */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px', background: 'var(--surface-sunken, #f1f5f9)', borderRadius: '8px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--navy, #0a2463)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  flexShrink: 0
                }}
              >
                {(user.name || user.email || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{user.name || 'Portal User'}</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-soft)', wordBreak: 'break-all' }}>{user.email}</div>
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--rule)' }}>
                {user.id}
              </div>
            </div>

            {/* Employee Full Name */}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="editUserName" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                id="editUserName"
                type="text"
                className="vob-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            {/* Access Role */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Access Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'user' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'user' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="editUserRole"
                      value="user"
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px' }}>Specialist</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Standard VOB queue
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'auth' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'auth' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="editUserRole"
                      value="auth"
                      checked={role === 'auth'}
                      onChange={() => setRole('auth')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px' }}>Auth Spec</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Pre-auth specialist
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'admin' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'admin' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="editUserRole"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px' }}>Administrator</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Full portal admin
                  </span>
                </label>
              </div>
            </div>

            {/* Client Access Assignments */}
            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontWeight: 600 }}>
                  Assigned Clients ({selectedClientIds.length} of {clients.length})
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllClients}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cobalt, #1d4ed8)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '2px 6px'
                  }}
                >
                  {isAllSelected ? 'Deselect All' : 'Select All Clients'}
                </button>
              </div>

              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--rule, #c4c4db)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  background: 'var(--surface, #fff)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '8px'
                }}
              >
                {clients.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)', padding: '12px 0' }}>
                    No clients configured in system.
                  </div>
                ) : (
                  clients.map(c => {
                    const isChecked = selectedClientIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleClient(c.id)}
                          disabled={submitting}
                        />
                        <span style={{ fontWeight: isChecked ? 600 : 400, color: 'var(--ink)' }}>
                          {c.name || c.id}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                Users will only see and process VOBs and tasks for their assigned clients.
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--rule, #c4c4db)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--surface)'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting}
              style={{ fontWeight: 600, minWidth: '110px' }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
