import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { useWorkspace } from '../../context/WorkspaceContext';

/**
 * Generates a HIPAA-compliant temporary password (>= 15 chars, mixed case, numbers, symbol)
 */
function generateSecurePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];
  
  const allChars = upper + lower + digits + symbols;
  while (pwd.length < 16) {
    pwd.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }
  
  // Shuffle characters
  return pwd.sort(() => Math.random() - 0.5).join('');
}

export function AddSpecialistModal({ isOpen, onClose, onSuccess, clients = [] }) {
  const { showToast } = useWorkspace();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user'); // 'user' = Specialist, 'auth' = Auth Specialist, 'admin' = Administrator
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requireReset, setRequireReset] = useState(true);
  const [copied, setCopied] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setRole('user');
      setSelectedClientIds([]);
      setTempPassword(generateSecurePassword());
      setShowPassword(false);
      setRequireReset(true);
      setErrorMessage('');
      setCopied(false);
    }
  }, [isOpen]);

  // Handle escape key
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

  if (!isOpen) return null;

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard?.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast('Could not copy to clipboard', 'warning');
    });
  };

  const handleRegeneratePassword = () => {
    setTempPassword(generateSecurePassword());
    setCopied(false);
  };

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
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter the employee full name.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid company email address.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: cleanName,
        email: cleanEmail,
        role,
        initialPassword: tempPassword,
        requirePasswordChange: requireReset,
        status: 'active',
        ...(selectedClientIds.length > 0 ? { clientIds: selectedClientIds } : {})
      };

      await usersApi.createUser(payload);

      const roleDisplay = role === 'admin' ? 'Administrator' : (role === 'auth' ? 'Auth Specialist' : 'Specialist');
      showToast(`User ${cleanName} (${roleDisplay}) added successfully!`, 'success');
      
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to create user:', err);
      const serverMsg = err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to add specialist. Please try again.';
      setErrorMessage(serverMsg);
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
          maxHeight: 'min(92vh, 740px)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-specialist-title"
      >
        {/* Header (pinned) */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="modal-eyebrow">User Administration · FR-2</div>
            <h3 id="add-specialist-title" className="modal-title" style={{ margin: '4px 0 0 0' }}>
              Add Portal User / Specialist
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

        {/* Form with scrollable body */}
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
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                role="alert"
              >
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Full Name */}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="specialistNameInput" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Full Name *
              </label>
              <input
                id="specialistNameInput"
                type="text"
                className="vob-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                placeholder="e.g. Priya Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
                autoFocus
              />
            </div>

            {/* Company Outlook Email */}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="specialistEmailInput" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Company Email (Outlook ID) *
              </label>
              <input
                id="specialistEmailInput"
                type="email"
                className="vob-input"
                style={{ width: '100%', padding: '9px 12px', fontSize: '14px' }}
                placeholder="e.g. priya.p@us24solutions.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                Will be used for portal authentication and system task attribution.
              </span>
            </div>

            {/* Access Role */}
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Access Level / Role *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'user' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'user' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface, #fdfafa)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="userRole"
                      value="user"
                      checked={role === 'user'}
                      onChange={() => setRole('user')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Specialist</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Queue tasks & forms
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'auth' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'auth' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface, #fdfafa)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="userRole"
                      value="auth"
                      checked={role === 'auth'}
                      onChange={() => setRole('auth')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Auth Spec</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Pre-authorization queue
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    border: `1.5px solid ${role === 'admin' ? 'var(--navy, #0a2463)' : 'var(--rule, #c4c4db)'}`,
                    borderRadius: '8px',
                    background: role === 'admin' ? 'rgba(10, 36, 99, 0.06)' : 'var(--surface, #fdfafa)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="radio"
                      name="userRole"
                      value="admin"
                      checked={role === 'admin'}
                      onChange={() => setRole('admin')}
                      disabled={submitting}
                    />
                    <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Administrator</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    Full system access
                  </span>
                </label>
              </div>
            </div>

            {/* Optional Assigned Clients */}
            {clients.length > 0 && (
              <div className="field" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontWeight: 600 }}>
                    Assigned Clients ({selectedClientIds.length === 0 && role === 'admin' ? 'All Clients (Admin Default)' : `${selectedClientIds.length} of ${clients.length}`})
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
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid var(--rule, #c4c4db)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    background: 'var(--surface, #fff)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '6px'
                  }}
                >
                  {clients.map(c => {
                    const isChecked = selectedClientIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          background: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          cursor: 'pointer',
                          fontSize: '12.5px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleClient(c.id)}
                          disabled={submitting}
                        />
                        <span style={{ color: 'var(--ink)', fontWeight: isChecked ? 600 : 400 }}>
                          {c.name || c.id}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Initial Password Section */}
            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="tempPasswordGen" style={{ fontWeight: 600, display: 'block' }}>
                  Generated Temporary Password *
                </label>
                <button
                  type="button"
                  onClick={handleRegeneratePassword}
                  disabled={submitting}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cobalt, #1d4ed8)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ↻ Regenerate
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="tempPasswordGen"
                    type={showPassword ? 'text' : 'password'}
                    className="vob-input"
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      fontFamily: 'var(--mono)',
                      fontSize: '13.5px',
                      letterSpacing: showPassword ? '0.05em' : 'normal'
                    }}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink-soft)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPassword}
                  style={{
                    padding: '0 14px',
                    height: '38px',
                    background: copied ? 'var(--mint-soft, #e3e9f6)' : 'var(--surface-sunken, #f1f5f9)',
                    border: '1px solid var(--rule, #c4c4db)',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>

              <span style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: '4px', display: 'block' }}>
                Secure temporary credentials for first login.
              </span>
            </div>
          </div>

          {/* Footer (pinned) */}
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--rule, #c4c4db)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexShrink: 0,
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
              style={{ fontWeight: 600, minWidth: '130px' }}
            >
              {submitting ? 'Creating...' : '+ Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
