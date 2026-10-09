import React, { useState, Suspense, lazy, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { resetTokenFromLink } from './utils/passwordReset';

// Lazy load HomePage: drastically slashes initial bundle size for login screen visitors
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));

// Background prefetch function to load HomePage during browser idle time
function prefetchHomePage() {
  if (typeof window !== 'undefined') {
    import('./pages/HomePage').catch(() => {});
  }
}

export function App() {
  const {
    session,
    rememberedEmail,
    loading,
    error,
    setError,
    clearError,
    login,
    mfaChallenge,
    setMfaChallenge,
    verify2Fa,
    resend2Fa,
    logout,
    isLocked,
    secondsRemaining
  } = useAuth();

  // Non-intrusively prefetch HomePage in background while user types credentials
  useEffect(() => {
    if (!session) {
      if ('requestIdleCallback' in window) {
        const id = window.requestIdleCallback(prefetchHomePage, { timeout: 2000 });
        return () => window.cancelIdleCallback(id);
      } else {
        const timer = setTimeout(prefetchHomePage, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [session]);

  // A reset link opens the reset screen even in a tab that is signed in.
  const [resetToken, setResetToken] = useState(resetTokenFromLink);

  const leaveReset = (passwordChanged) => {
    setResetToken(null);
    // The server signs the account out everywhere once the password changes.
    if (passwordChanged && session) logout();
  };

  if (session && !resetToken) {
    return (
      <Suspense fallback={
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--canvas, #f8fafc)',
          color: 'var(--ink, #0f172a)',
          gap: '16px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(249, 115, 22, 0.2)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.02em', color: '#64748b' }}>
            Loading US24 Workspace…
          </span>
        </div>
      }>
        <HomePage
          session={session}
          onLogout={logout}
        />
      </Suspense>
    );
  }

  return (
    <LoginPage
      mfaChallenge={mfaChallenge}
      onVerify2Fa={verify2Fa}
      onResend2Fa={resend2Fa}
      onCancel2Fa={() => setMfaChallenge(null)}
      rememberedEmail={rememberedEmail}
      loading={loading}
      error={
        isLocked
          ? `Too many failed attempts. Try again in ${secondsRemaining} seconds.`
          : error
      }
      setError={setError}
      clearError={clearError}
      login={login}
      isLocked={isLocked}
      secondsRemaining={secondsRemaining}
      resetToken={resetToken}
      onLeaveReset={leaveReset}
    />
  );
}

export default App;
