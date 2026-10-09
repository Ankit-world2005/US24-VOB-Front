import React, { useState, useEffect, useRef } from 'react';
import { FormAlert } from './FormAlert';

export function TwoFactorOtpForm({
  mfaChallenge,
  onVerify,
  onResend,
  onBack,
  loading,
  error,
  onClearError
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(45);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [remainingTime, setRemainingTime] = useState(mfaChallenge?.expires_in || 180);

  const inputRefs = useRef([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Expiry countdown timer (3 min default)
  useEffect(() => {
    if (remainingTime <= 0) return;
    const interval = setInterval(() => {
      setRemainingTime((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingTime]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDigitChange = (index, value) => {
    onClearError();
    setResendNotice('');

    // Handle single character digit input
    const cleanChar = value.replace(/[^0-9]/g, '');
    if (!cleanChar) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const next = [...digits];
    next[index] = cleanChar.slice(-1); // Take latest typed digit
    setDigits(next);

    // Auto-advance to next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // If 6th digit entered, auto submit if all 6 digits present
      const fullCode = next.join('');
      if (fullCode.length === 6) {
        onVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move back and delete previous
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    onClearError();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setDigits(next);

    const targetFocus = Math.min(pasted.length, 5);
    inputRefs.current[targetFocus]?.focus();

    if (pasted.length === 6) {
      onVerify(pasted);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) {
      return;
    }
    onVerify(code);
  };

  const handleResendClick = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendNotice('');
    try {
      await onResend();
      setResendCooldown(45);
      setRemainingTime(180);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setResendNotice('A new verification code has been dispatched.');
    } catch (err) {
      // error handled by parent
    } finally {
      setResending(false);
    }
  };

  const isComplete = digits.every((d) => d !== '');
  const isExpired = remainingTime <= 0;

  return (
    <section id="twoFactorView" className="two-factor-view">
      <div className="two-factor-header" style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0.05))',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            color: '#f97316',
            marginBottom: '12px'
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h2 style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--ink, #0f172a)', margin: '0 0 6px' }}>
          Two-Factor Authentication
        </h2>
        <p className="sub" style={{ fontSize: '0.88rem', color: 'var(--ink-soft, #64748b)', margin: 0 }}>
          Enter the 6-digit verification code sent to:
        </p>
        <div style={{ marginTop: '6px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.86rem',
              fontWeight: 600,
              color: 'var(--ink, #0f172a)',
              background: 'var(--canvas-subtle, rgba(0,0,0,0.04))',
              padding: '3px 10px',
              borderRadius: '20px',
              border: '1px solid var(--rule, rgba(0,0,0,0.08))'
            }}
          >
            📧 {mfaChallenge?.destination || 'your company email'}
          </span>
        </div>
      </div>

      <FormAlert>{error}</FormAlert>
      {resendNotice && !error && <FormAlert tone="success">{resendNotice}</FormAlert>}
      {isExpired && !error && (
        <FormAlert tone="warning">
          Verification code has expired. Please request a new code below.
        </FormAlert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* 6-Digit Segmented Box Inputs */}
        <div
          className="otp-input-container"
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            margin: '20px 0 16px'
          }}
          onPaste={handlePaste}
        >
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              disabled={loading || isExpired}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e.target)}
              className="otp-digit-input"
              style={{
                width: '44px',
                height: '52px',
                textAlign: 'center',
                fontSize: '1.4rem',
                fontWeight: 600,
                fontFamily: 'var(--mono, monospace)',
                borderRadius: '8px',
                border: error
                  ? '2px solid #ef4444'
                  : digit
                  ? '2px solid #f97316'
                  : '1.5px solid var(--rule, #cbd5e1)',
                background: 'var(--surface, #ffffff)',
                color: 'var(--ink, #0f172a)',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
              }}
            />
          ))}
        </div>

        {/* Expiry Countdown */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.82rem',
            color: remainingTime < 60 ? '#ef4444' : 'var(--ink-soft, #64748b)',
            marginBottom: '20px'
          }}
        >
          <span>⏳ Code expires in: </span>
          <strong style={{ fontFamily: 'var(--mono, monospace)' }}>{formatTime(remainingTime)}</strong>
        </div>

        {/* Verify & Enter Portal Button */}
        <button
          type="submit"
          className="btn-primary"
          disabled={!isComplete || loading || isExpired}
          style={{
            width: '100%',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontWeight: 600
          }}
        >
          {loading ? (
            <>
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              <span>Verifying code…</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Verify & Access Portal</span>
            </>
          )}
        </button>

        {/* Resend and Navigation Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft, #64748b)' }}>
            Didn't receive the code?{' '}
            {resendCooldown > 0 ? (
              <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendClick}
                disabled={resending}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f97316',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {resending ? 'Sending…' : 'Resend Code'}
              </button>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-soft, #64748b)',
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px'
              }}
            >
              <span>← Back to Sign in</span>
            </button>
          </div>
        </div>

        {/* HIPAA Compliance Note */}
        <div
          style={{
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid var(--rule, rgba(0,0,0,0.06))',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: 'var(--ink-faint, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span>HIPAA BAA Multi-Factor Authentication active</span>
        </div>
      </form>
    </section>
  );
}

export default TwoFactorOtpForm;
