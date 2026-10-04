import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';
import { ResetPasswordForm } from '../components/ResetPasswordForm';
import { Footer } from '../components/Footer';

export function LoginPage({
  rememberedEmail,
  loading,
  error,
  setError,
  clearError,
  login,
  isLocked,
  secondsRemaining,
  resetToken,
  onLeaveReset
}) {
  // 'login', 'forgot' (ask for a reset email), or 'reset' (opened from that email)
  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [draftEmail, setDraftEmail] = useState('');
  const [notice, setNotice] = useState('');

  const openForgot = (email) => {
    clearError();
    setNotice('');
    setDraftEmail(email);
    setMode('forgot');
  };

  const backToSignIn = (email = '', message = '') => {
    clearError();
    setNotice(message);
    setDraftEmail(email);
    setMode('login');
    onLeaveReset(Boolean(message));
  };

  return (
    <div className="page login-page">
      <Navbar />

      <main className="main">
        <Hero />

        <AuthCard>
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
              onSubmit={login}
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
