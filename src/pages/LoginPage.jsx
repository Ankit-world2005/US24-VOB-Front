import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';
import { ResetPasswordForm } from '../components/ResetPasswordForm';
import { TwoFactorOtpForm } from '../components/TwoFactorOtpForm';
import { Footer } from '../components/Footer';

export function LoginPage({
  rememberedEmail,
  loading,
  error,
  setError,
  clearError,
  login,
  mfaChallenge,
  onVerify2Fa,
  onResend2Fa,
  onCancel2Fa,
  isLocked,
  secondsRemaining,
  resetToken,
  onLeaveReset
}) {
  // 'login', '2fa', 'forgot' (ask for a reset email), or 'reset' (opened from that email)
  const [mode, setMode] = useState(resetToken ? 'reset' : mfaChallenge ? '2fa' : 'login');
  const [draftEmail, setDraftEmail] = useState('');
  const [rememberPreference, setRememberPreference] = useState(Boolean(rememberedEmail));
  const [notice, setNotice] = useState('');
  const [localMfaChallenge, setLocalMfaChallenge] = useState(null);

  const activeMfaChallenge = mfaChallenge || localMfaChallenge;

  // Switch to '2fa' mode whenever mfaChallenge arrives from props or state
  useEffect(() => {
    if (mfaChallenge) {
      setMode('2fa');
      clearError();
    }
  }, [mfaChallenge]);

  const openForgot = (email) => {
    clearError();
    setNotice('');
    setDraftEmail(email);
    setMode('forgot');
  };

  const backToSignIn = (email = '', message = '') => {
    clearError();
    setNotice(message);
    if (email) setDraftEmail(email);
    setLocalMfaChallenge(null);
    setMode('login');
    if (onCancel2Fa) onCancel2Fa();
    if (onLeaveReset) onLeaveReset(Boolean(message));
  };

  const handleLoginSubmit = async ({ email, password, remember }) => {
    setDraftEmail(email);
    setRememberPreference(remember);
    const result = await login({ email, password, remember });
    if (result?.requires2fa) {
      if (result.mfaChallenge) {
        setLocalMfaChallenge(result.mfaChallenge);
      }
      setMode('2fa');
      clearError();
    }
  };

  const handleVerifyOtp = async (otpCode) => {
    clearError();
    try {
      if (onVerify2Fa) {
        await onVerify2Fa({
          mfaToken: activeMfaChallenge?.mfa_token,
          otp: otpCode,
          remember: rememberPreference,
          fallbackEmail: draftEmail
        });
      }
    } catch {
      // Error is caught and surfaced via setError in useAuth
    }
  };

  const handleResendOtp = async () => {
    clearError();
    try {
      if (onResend2Fa) {
        const res = await onResend2Fa({
          mfaToken: activeMfaChallenge?.mfa_token
        });
        if (res?.dev_otp || res?.devOtp) {
          setLocalMfaChallenge(prev => ({ ...prev, dev_otp: res.dev_otp || res.devOtp }));
        }
        return res;
      }
    } catch {
      // Error is caught and surfaced via setError in useAuth
    }
  };

  return (
    <div className="page login-page">
      <Navbar />

      <main className="main">
        <Hero />

        <AuthCard>
          {mode === '2fa' && (
            <TwoFactorOtpForm
              mfaChallenge={activeMfaChallenge || { destination: draftEmail }}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={() => backToSignIn(draftEmail)}
              loading={loading}
              error={error}
              onClearError={clearError}
            />
          )}

          {mode === 'forgot' && (
            <ForgotPasswordForm initialEmail={draftEmail} onBack={(email) => backToSignIn(email)} />
          )}

          {mode === 'reset' && (
            <ResetPasswordForm
              token={resetToken}
              onDone={(email) =>
                backToSignIn(email, 'Password updated. Sign in with your new password.')
              }
              onRequestNew={openForgot}
              onBack={() => backToSignIn()}
            />
          )}

          {mode === 'login' && (
            <LoginForm
              rememberedEmail={rememberedEmail}
              initialEmail={draftEmail}
              loading={loading}
              error={
                isLocked
                  ? `Too many failed attempts. Try again in ${secondsRemaining} seconds.`
                  : error
              }
              notice={notice}
              onError={setError}
              onClearError={() => {
                setNotice('');
                clearError();
              }}
              onSubmit={handleLoginSubmit}
              onForgot={openForgot}
              isLocked={isLocked}
            />
          )}
        </AuthCard>
      </main>

      <Footer />
    </div>
  );
}

export default LoginPage;
