import React from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';

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

  if (session) {
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
    />
  );
}

export default App;
