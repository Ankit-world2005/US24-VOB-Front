import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import { apiClient, SESSION_EXPIRED_EVENT } from '../api/client';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60 * 1000;
const SESSION_KEY = 'us24-session';
const LOCK_KEY = 'us24-lock';
const EMAIL_KEY = 'us24-email';

const storage = {
  get(s, k) {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  set(s, k, v) {
    try {
      s.setItem(k, v);
    } catch {}
  },
  del(s, k) {
    try {
      s.removeItem(k);
    } catch {}
  }
};

export function useAuth() {
  const [session, setSession] = useState(() => {
    if (typeof window === 'undefined') return null;
    const raw = storage.get(window.sessionStorage, SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // The token saved here is the one from sign-in. apiClient stores each
        // renewed token itself, so restoring this one over it would send an
        // expired token on every reload (a burst of 401s, then another renewal).
        if (parsed?.token && !apiClient.getToken()) {
          apiClient.setToken(parsed.token);
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [rememberedEmail, setRememberedEmail] = useState(() => {
    if (typeof window === 'undefined') return '';
    return storage.get(window.localStorage, EMAIL_KEY) || '';
  });

  const [lockState, setLockState] = useState(() => {
    if (typeof window === 'undefined') return { attempts: 0, until: 0 };
    const raw = storage.get(window.sessionStorage, LOCK_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return { attempts: 0, until: 0 };
  });

  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [error, setError] = useState('');

  // Update lockout countdown ticker
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      if (lockState.until > now) {
        setSecondsRemaining(Math.ceil((lockState.until - now) / 1000));
      } else {
        setSecondsRemaining(0);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockState.until]);

  const saveLock = (newLock) => {
    setLockState(newLock);
    if (typeof window !== 'undefined') {
      storage.set(window.sessionStorage, LOCK_KEY, JSON.stringify(newLock));
    }
  };

  const login = useCallback(async ({ email, password, remember }) => {
    setError('');

    const cleanEmail = email.trim();
    const now = Date.now();

    if (lockState.until > now) {
      const secs = Math.ceil((lockState.until - now) / 1000);
      setError(`Too many failed attempts. Try again in ${secs} seconds.`);
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setError('Please enter your password.');
      return false;
    }

    setLoading(true);
    try {
      // Authenticate against the live backend API (/api/v1/auth/login)
      let authResponse;
      try {
        authResponse = await authApi.login({ email: cleanEmail, password });
      } catch (apiErr) {
        if (apiErr.status === 401 || apiErr.status === 400 || apiErr.status === 403) {
          const nextAttempts = lockState.attempts + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            const lockedUntil = Date.now() + LOCK_MS;
            saveLock({ attempts: 0, until: lockedUntil });
            setError('Too many failed attempts. Sign-in is locked for 60 seconds.');
          } else {
            saveLock({ ...lockState, attempts: nextAttempts });
            const left = MAX_ATTEMPTS - nextAttempts;
            const friendly = `Incorrect email or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`;
            const useServerWording = apiErr.status !== 401 && !apiErr.generic && apiErr.message;
            setError(useServerWording ? apiErr.message : friendly);
          }
          setLoading(false);
          return false;
        }
        throw apiErr;
      }

      // 2FA Challenge check
      if (authResponse?.requires_2fa === true) {
        setMfaChallenge(authResponse);
        setLoading(false);
        return { requires2fa: true, mfaChallenge: authResponse };
      }

      const receivedToken = authResponse?.access_token || authResponse?.token;
      if (receivedToken) {
        apiClient.setToken(receivedToken, remember);
        if (authResponse.refresh_token) {
          apiClient.setRefreshToken(authResponse.refresh_token, remember);
        }
        saveLock({ attempts: 0, until: 0 });

        if (typeof window !== 'undefined') {
          if (remember) {
            storage.set(window.localStorage, EMAIL_KEY, cleanEmail);
            setRememberedEmail(cleanEmail);
          } else {
            storage.del(window.localStorage, EMAIL_KEY);
            setRememberedEmail('');
          }
        }

        const newSession = {
          id: authResponse.user?.id,
          email: authResponse.user?.email || cleanEmail,
          name: authResponse.user?.name || cleanEmail.split('@')[0],
          role: authResponse.user?.role || 'user',
          token: receivedToken,
          at: Date.now()
        };

        if (typeof window !== 'undefined') {
          storage.set(window.sessionStorage, SESSION_KEY, JSON.stringify(newSession));
        }

        setSession(newSession);
        setLoading(false);
        return true;
      }

      throw new Error('Authentication did not return a valid session token.');
    } catch (err) {
      console.error('Authentication error:', err);
      setError(err?.message || 'An error occurred during authentication. Please try again.');
      setLoading(false);
      return false;
    }
  }, [lockState]);

  const verify2Fa = useCallback(
    async ({ mfaToken, otp, remember, fallbackEmail }) => {
      setError('');
      setLoading(true);
      try {
        const authResponse = await authApi.verify2Fa({ mfaToken, otp });
        const token = authResponse?.access_token || authResponse?.token;
        if (token) {
          apiClient.setToken(token, remember);
          if (authResponse.refresh_token) {
            apiClient.setRefreshToken(authResponse.refresh_token, remember);
          }
          saveLock({ attempts: 0, until: 0 });

          const email = authResponse.user?.email || fallbackEmail || rememberedEmail;
          if (typeof window !== 'undefined') {
            if (remember && email) {
              storage.set(window.localStorage, EMAIL_KEY, email);
              setRememberedEmail(email);
            }
          }

          const newSession = {
            id: authResponse.user?.id,
            email: authResponse.user?.email || email,
            name: authResponse.user?.name || email?.split('@')[0],
            role: authResponse.user?.role || 'user',
            token,
            at: Date.now()
          };

          if (typeof window !== 'undefined') {
            storage.set(window.sessionStorage, SESSION_KEY, JSON.stringify(newSession));
          }

          setSession(newSession);
          setMfaChallenge(null);
          setLoading(false);
          return true;
        }
        throw new Error('Verification did not return a valid session token.');
      } catch (err) {
        console.error('2FA Verification error:', err);
        const msg =
          err?.data?.error?.message ||
          err?.message ||
          'Invalid verification code. Please try again.';
        setError(msg);
        setLoading(false);
        throw err;
      }
    },
    [rememberedEmail]
  );

  const resend2Fa = useCallback(async ({ mfaToken }) => {
    setError('');
    try {
      const res = await authApi.resend2Fa({ mfaToken });
      if (res?.dev_otp || res?.devOtp) {
        setMfaChallenge((prev) => ({ ...prev, dev_otp: res.dev_otp || res.devOtp }));
      }
      return res;
    } catch (err) {
      const msg =
        err?.data?.error?.message || err?.message || 'Failed to resend code. Please try again.';
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    try {
      authApi.logout().catch(() => {});
    } catch {}
    apiClient.clearToken();
    if (typeof window !== 'undefined') {
      storage.del(window.sessionStorage, SESSION_KEY);
    }
    setSession(null);
    setError('');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onExpired = (event) => {
      const hadSession = Boolean(storage.get(window.sessionStorage, SESSION_KEY));
      apiClient.clearToken();
      storage.del(window.sessionStorage, SESSION_KEY);
      setSession(null);
      if (!hadSession) return;
      setError(
        event?.detail?.reason === 'account_changed'
          ? 'Another account signed in on this browser, so this tab was signed out. ' +
              'Use one account per browser, or a private window for a second account.'
          : 'Your session has expired. Please sign in again.'
      );
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  return {
    session,
    rememberedEmail,
    loading,
    error,
    setError,
    clearError,
    login,
    logout,
    mfaChallenge,
    setMfaChallenge,
    verify2Fa,
    resend2Fa,
    isLocked: secondsRemaining > 0,
    secondsRemaining
  };
}
