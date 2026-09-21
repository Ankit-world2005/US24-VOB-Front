import React from 'react';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { AuthCard } from '../components/AuthCard';
import { LoginForm } from '../components/LoginForm';
import { Footer } from '../components/Footer';

export function LoginPage({
  isDark,
  toggleTheme,
  rememberedEmail,
  loading,
  error,
  setError,
  clearError,
  login,
  isLocked,
  secondsRemaining
}) {
  return (
    <div className="page login-page">
      <Navbar isDark={isDark} onToggleTheme={toggleTheme} />

      <main className="main">
        <Hero />

        <AuthCard>
          <LoginForm
            rememberedEmail={rememberedEmail}
            loading={loading}
            error={
              isLocked
                ? `Too many failed attempts. Try again in ${secondsRemaining} seconds.`
                : error
            }
            onError={setError}
            onClearError={clearError}
            onSubmit={login}
            isLocked={isLocked}
          />
        </AuthCard>
      </main>

      <Footer />
    </div>
  );
}

export default LoginPage;
