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

export function AddSpecialistModal({ isOpen, onClose, onSuccess }) {
  const { showToast } = useWorkspace();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user'); // 'user' = Specialist, 'auth' = Auth Specialist, 'admin' = Administrator
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
        status: 'active'
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

  return (
    <div
      className="modal-overlay"
      style={{ overflowY: 'auto', padding: '24px 16px' }}
      onClick={() => !submitting && onClose()}
    >
      <div
        className="modal-container"
        style={{
          maxWidth: '540px',
          maxHeight: 'min(90vh, 680px)',
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
              Add Specialist / User
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
                <span style={{ fontSize: '16px' }}>⚠️</span>
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
                    background: role === 'user' ? 'var(--mint-soft, #e3e9f6)' : 'var(--surface, #fdfafa)',
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
                    background: role === 'auth' ? 'var(--mint-soft, #e3e9f6)' : 'var(--surface, #fdfafa)',
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
                    <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Auth Specialist</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
                    QA & Auth queue
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
                    background: role === 'admin' ? 'var(--mint-soft, #e3e9f6)' : 'var(--surface, #fdfafa)',
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
                    Full portal admin
                  </span>
                </label>
              </div>
            </div>

            {/* Temporary Credentials */}
            <div
              style={{
                background: 'var(--surface-2, #f7f7f5)',
                border: '1px solid var(--rule-soft, #e4e4e9)',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
                  Initial Temporary Password
                </span>
                <button
                  type="button"
                  onClick={handleRegeneratePassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cobalt, #0648c0)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                  disabled={submitting}
                >
                  ↻ Regenerate
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="vob-input mono"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', fontSize: '13px', letterSpacing: showPassword ? 'normal' : '0.15em' }}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn ghost"
                  style={{ height: '36px', padding: '0 10px', fontSize: '12px', width: 'auto' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="btn"
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '12px',
                    width: 'auto',
                    background: copied ? 'var(--success, #166534)' : 'var(--navy, #0a2463)',
                    borderColor: copied ? 'var(--success, #166534)' : 'var(--navy, #0a2463)'
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--ink)', cursor: 'pointer', marginTop: '2px' }}>
                <input
                  type="checkbox"
                  checked={requireReset}
                  onChange={(e) => setRequireReset(e.target.checked)}
                  disabled={submitting}
                  style={{ width: '15px', height: '15px' }}
                />
                Require password change upon first sign-in (HIPAA Recommended)
              </label>
            </div>
          </div>

          {/* Footer (pinned) */}
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--rule-soft, #e4e4e9)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexShrink: 0
            }}
          >
            <button
              type="button"
              className="btn ghost"
              onClick={onClose}
              disabled={submitting}
              style={{ width: 'auto', padding: '0 20px', height: '42px', fontSize: '14px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting || !name.trim() || !email.trim()}
              style={{ width: 'auto', padding: '0 24px', height: '42px', fontSize: '14px' }}
            >
              {submitting ? 'Adding Specialist...' : '+ Add Specialist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
