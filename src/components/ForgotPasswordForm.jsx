import React, { useState, useRef } from 'react';
import { authApi } from '../api/auth';
import { FormAlert } from './FormAlert';
import { resetErrorMessage } from '../utils/passwordReset';

export function ForgotPasswordForm({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const emailInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInvalid(false);

    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInvalid(true);
      setError('Please enter a valid email address.');
      emailInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await authApi.requestPasswordReset({ email: trimmedEmail });
      setSentTo(trimmedEmail);
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // The server answers the same way for every email, so this cannot say
  // whether an account exists either.
  if (sentTo) {
    return (
      <section id="forgotView">
        <h2>Check your email</h2>
        <p className="sub">
          If an account exists for <strong>{sentTo}</strong>, we sent it a link to reset your
          password. The link works once and expires in 30 minutes.
        </p>

        <button type="button" className="btn" onClick={() => onBack(sentTo)}>
          Back to sign in
        </button>

        <p className="form-back">
          No email? Check your junk folder, or{' '}
          <button type="button" className="link" onClick={() => setSentTo('')}>
            send another link
          </button>
          .
        </p>
      </section>
    );
  }

  return (
    <section id="forgotView">
      <h2>Reset password</h2>
      <p className="sub">
        Enter your company email and we will send you a link to reset your VOB portal password.
      </p>

      <FormAlert>{error}</FormAlert>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="resetEmail">Company email</label>
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
              id="resetEmail"
              type="email"
              autoComplete="username"
              placeholder="name@us24solutions.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (invalid) setInvalid(false);
              }}
              className={invalid ? 'invalid' : ''}
              autoFocus
              required
            />
          </div>
        </div>

        <button type="submit" className={`btn ${loading ? 'loading' : ''}`} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" />
              <span>Sending…</span>
            </>
          ) : (
            <span>Send reset link</span>
          )}
        </button>
      </form>

      <p className="form-back">
        <button type="button" className="link" onClick={() => onBack(email.trim())}>
          Back to sign in
        </button>
      </p>
    </section>
  );
}
