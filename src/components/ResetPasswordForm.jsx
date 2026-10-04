import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../api/auth';
import { FormAlert } from './FormAlert';
import { MIN_PASSWORD_LENGTH, linkProblem, resetErrorMessage } from '../utils/passwordReset';

function LockIcon() {
  return (
    <svg
      className="lead"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BackLink({ onClick }) {
  return (
    <p className="form-back">
      <button type="button" className="link" onClick={onClick}>
        Back to sign in
      </button>
    </p>
  );
}

/**
 * Opened from the emailed link. Checks the token first, so an expired or used
 * link says so before the user types a new password.
 */
export function ResetPasswordForm({ token, onDone, onRequestNew, onBack }) {
  // 'checking' → 'ready', or 'invalid' (bad link) / 'unavailable' (could not check)
  const [status, setStatus] = useState('checking');
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ password: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const passwordInputRef = useRef(null);
  const confirmInputRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    setStatus('checking');

    authApi
      .verifyResetToken(token)
      .then((res) => {
        if (ignore) return;
        setEmail(res?.email || '');
        setStatus('ready');
      })
      .catch((err) => {
        if (ignore) return;
        const badLink = linkProblem(err);
        setProblem(badLink || resetErrorMessage(err));
        setStatus(badLink ? 'invalid' : 'unavailable');
      });

    return () => {
      ignore = true;
    };
  }, [token, attempt]);

  useEffect(() => {
    if (status === 'ready') passwordInputRef.current?.focus();
  }, [status]);

  const handlePasswordKey = (e) => {
    if (e.getModifierState) {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({ password: false, confirm: false });

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldErrors({ password: true, confirm: false });
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      passwordInputRef.current?.focus();
      return;
    }

    if (confirm !== password) {
      setFieldErrors({ password: false, confirm: true });
      setError('The two passwords do not match.');
      confirmInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      onDone(email);
    } catch (err) {
      setSaving(false);

      const badLink = linkProblem(err);
      if (badLink) {
        setProblem(badLink);
        setStatus('invalid');
        return;
      }

      if (err?.status === 422) {
        setFieldErrors({ password: true, confirm: false });
        setError(err.data?.error?.message || 'Choose a longer, less common password.');
        passwordInputRef.current?.focus();
        return;
      }

      setError(resetErrorMessage(err));
    }
  };

  if (status === 'checking') {
    return (
      <section id="resetView">
        <h2>Create a new password</h2>
        <p className="sub reset-checking">
          <span className="spinner dark" />
          Checking your reset link…
        </p>
      </section>
    );
  }

  if (status === 'invalid') {
    return (
      <section id="resetView">
        <h2>Link can’t be used</h2>
        <FormAlert>{problem}</FormAlert>
        <p className="sub">Reset links work once and expire 30 minutes after they are sent.</p>
        <button type="button" className="btn" onClick={() => onRequestNew(email)}>
          Request a new link
        </button>
        <BackLink onClick={onBack} />
      </section>
    );
  }

  if (status === 'unavailable') {
    return (
      <section id="resetView">
        <h2>Create a new password</h2>
        <FormAlert>{problem}</FormAlert>
        <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
        <BackLink onClick={onBack} />
      </section>
    );
  }

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;

  return (
    <section id="resetView">
      <h2>Create a new password</h2>
      <p className="sub">
        {email ? (
          <>
            Choose a new password for <strong>{email}</strong>.
          </>
        ) : (
          'Choose a new password for your account.'
        )}
      </p>

      <FormAlert>{error}</FormAlert>

      <form onSubmit={handleSubmit} noValidate>
        {/* Tells password managers which account the new password belongs to. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <div className="input-wrap">
            <LockIcon />
            <input
              ref={passwordInputRef}
              id="newPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: false }));
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              className={fieldErrors.password ? 'invalid' : ''}
              aria-describedby="passwordHint"
              required
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
              title={showPassword ? 'Hide passwords' : 'Show passwords'}
            >
              {showPassword ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <div id="passwordHint" className={`hint ${longEnough ? 'met' : ''}`}>
            {longEnough ? '✓' : '•'} At least {MIN_PASSWORD_LENGTH} characters
          </div>
          <div className={`caps ${capsLock ? 'show' : ''}`}>⚠ Caps Lock is on</div>
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <div className="input-wrap">
            <LockIcon />
            <input
              ref={confirmInputRef}
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldErrors.confirm) setFieldErrors(prev => ({ ...prev, confirm: false }));
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              className={fieldErrors.confirm ? 'invalid' : ''}
              required
            />
          </div>
        </div>

        <button type="submit" className={`btn ${saving ? 'loading' : ''}`} disabled={saving}>
          {saving ? (
            <>
              <span className="spinner" />
              <span>Saving…</span>
            </>
          ) : (
            <span>Save password</span>
          )}
        </button>
      </form>

      <BackLink onClick={onBack} />
    </section>
  );
}
