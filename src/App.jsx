import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { resetTokenFromLink } from './utils/passwordReset';

export function App() {
  const {
    session,
    rememberedEmail,
    loading,
    error,
    setError,
    clearError,
    login,
    logout,
    isLocked,
    secondsRemaining
  } = useAuth();

  // A reset link opens the reset screen even in a tab that is signed in.
  const [resetToken, setResetToken] = useState(resetTokenFromLink);

  const leaveReset = (passwordChanged) => {
    setResetToken(null);
    // The server signs the account out everywhere once the password changes.
    if (passwordChanged && session) logout();
  };

  if (session && !resetToken) {
    return (
      <HomePage
        session={session}
        onLogout={logout}
      />
    );
  }

  return (
    <LoginPage
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
