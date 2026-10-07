import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { useWorkspace } from '../../context/WorkspaceContext';

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
  return pwd.sort(() => Math.random() - 0.5).join('');
}

export function ResetPasswordModal({ isOpen, onClose, user, onSuccess }) {
  const { showToast } = useWorkspace();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setPassword(generateSecurePassword());
      setShowPassword(false);
      setCopied(false);
      setErrorMessage('');
    }
  }, [isOpen, user]);

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

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard?.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Temporary password copied to clipboard', 'info');
    }).catch(() => {
      showToast('Could not copy to clipboard', 'warning');
    });
  };

  const handleRegenerate = () => {
    setPassword(generateSecurePassword());
    setCopied(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await usersApi.patchUser(user.id, { password });
      showToast(`Password for ${user.name || user.email} updated successfully!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to reset password:', err);
      const msg = err?.data?.error?.message || err?.data?.message || err?.message || 'Failed to update password.';
      setErrorMessage(msg);
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
          maxWidth: '480px',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Credential Reset · SEC-7</div>
            <h3 id="reset-password-title" className="modal-title" style={{ margin: '4px 0 0 0' }}>
              Reset Temporary Password
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
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-soft)' }}>
              Set a temporary password for <strong>{user.name || user.email}</strong> (<code style={{ fontSize: '12px' }}>{user.email}</code>).
            </p>

            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="tempPasswordInput" style={{ fontWeight: 600 }}>
                  Temporary Password
                </label>
                <button
                  type="button"
                  onClick={handleRegenerate}
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

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="tempPasswordInput"
                    type={showPassword ? 'text' : 'password'}
                    className="vob-input"
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      fontFamily: 'var(--mono)',
                      fontSize: '13.5px',
                      letterSpacing: showPassword ? '0.05em' : 'normal'
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  onClick={handleCopy}
                  style={{
                    padding: '0 14px',
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
                Copy and share this password securely with the user.
              </span>
            </div>
          </div>

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
              style={{ fontWeight: 600 }}
            >
              {submitting ? 'Updating...' : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
