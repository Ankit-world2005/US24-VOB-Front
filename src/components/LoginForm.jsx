import React, { useState, useEffect, useRef } from 'react';

export function LoginForm({
  rememberedEmail,
  loading,
  error,
  onError,
  onClearError,
  onSubmit,
  isLocked
}) {
  const [email, setEmail] = useState(rememberedEmail || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: false, password: false });

  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Sync remembered email if it changes
  useEffect(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRemember(true);
    }
  }, [rememberedEmail]);

  const handlePasswordKey = (e) => {
    if (e.getModifierState) {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    onClearError();
    setFieldErrors({ email: false, password: false });

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFieldErrors(prev => ({ ...prev, email: true }));
      onError('Please enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }

    if (!password) {
      setFieldErrors(prev => ({ ...prev, password: true }));
      onError('Please enter your password.');
      passwordInputRef.current?.focus();
      return;
    }

    const success = await onSubmit({
      email: trimmedEmail,
      password,
      remember
    });

    if (!success) {
      setPassword('');
      setFieldErrors(prev => ({ ...prev, password: true }));
      passwordInputRef.current?.focus();
    }
  };

  const handleForgot = () => {
    onError('Please contact your administrator (saurabh@us24solutions.com) to reset your password.');
  };

  return (
    <section id="loginView">
      <h2>Sign in</h2>
      <p className="sub">Enter your company email and password.</p>

      {error && (
        <div className="alert show" role="alert">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0, marginTop: '1px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Outlook ID</label>
          <div className="input-wrap">
            <svg
              className="lead"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-10 6L2 7" />
            </svg>
            <input
              ref={emailInputRef}
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@us24solutions.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: false }));
              }}
              className={fieldErrors.email ? 'invalid' : ''}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-wrap">
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
            <input
              ref={passwordInputRef}
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: false }));
              }}
              onKeyDown={handlePasswordKey}
              onKeyUp={handlePasswordKey}
              className={fieldErrors.password ? 'invalid' : ''}
              required
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPassword(prev => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
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
          <div className={`caps ${capsLock ? 'show' : ''}`} id="caps">
            ⚠ Caps Lock is on
          </div>
        </div>

        <div className="row">
          <label className="check">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember me
          </label>
          <button type="button" className="link" onClick={handleForgot}>
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          className={`btn ${loading ? 'loading' : ''}`}
          id="submitBtn"
          disabled={loading || isLocked}
        >
          {loading ? (
            <>
              <span className="spinner" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <svg
                className="arrow"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </>
          )}
        </button>
      </form>
    </section>
  );
}
