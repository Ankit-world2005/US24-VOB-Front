import { useState, useEffect, useCallback } from 'react';
import { USERS } from '../data/users';
import { sha256 } from '../utils/crypto';
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
        if (parsed?.token) {
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

    // Trimmed but NOT lowercased. The API preserves address case on purpose and
    // holds accounts that differ only in the case of their local part, so folding
    // the case here makes one of them impossible to sign in to.
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
      // 1. First attempt login against the live backend API (/api/v1/auth/login)
      let authResponse = null;
      let usedLiveBackend = false;

      try {
        authResponse = await authApi.login({ email: cleanEmail, password });
        usedLiveBackend = true;
      } catch (apiErr) {
        // Demo accounts (Admin@123, User@123, …) only when there is no backend to
        // ask. Its token is not a JWT: once a backend answered — even to refuse —
        // a demo sign-in would make every API call fail with "Sign in to continue."
        const backendAnswered = Boolean(apiErr.status) && !apiErr.unreachable && apiErr.status !== 404;
        const localKey = cleanEmail.toLowerCase();
        const hash = backendAnswered ? null : await sha256(`us24|${localKey}|${password}`);
        const localUser = USERS[localKey];
        if (localUser && hash && localUser.hashes.includes(hash)) {
          authResponse = {
            access_token: 'local_dev_token_' + Date.now(),
            user: {
              id: 'local_' + localUser.name.toLowerCase().replace(/\s+/g, '_'),
              email: cleanEmail,
              name: localUser.name,
              role: localUser.role
            }
          };
        } else if (apiErr.status === 401 || apiErr.status === 400 || apiErr.status === 403) {
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
        } else {
          throw apiErr;
        }
      }

      if (authResponse?.access_token) {
        apiClient.setToken(authResponse.access_token, remember);
        // Present in development only; production keeps it in an HttpOnly cookie.
        apiClient.setRefreshToken(authResponse.refresh_token, remember);
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
          token: authResponse.access_token,
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

  // The client rotates an expired access token by itself. It only raises this
  // when the refresh is refused too, which means the session is genuinely over —
  // idle timeout, absolute cap, or an admin revoking access mid-session (SEC-7).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onExpired = () => {
      // A signed-out request can raise this too; only a real session has expired.
      const hadSession = Boolean(storage.get(window.sessionStorage, SESSION_KEY));
      apiClient.clearToken();
      storage.del(window.sessionStorage, SESSION_KEY);
      setSession(null);
      if (hadSession) setError('Your session has expired. Please sign in again.');
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
    isLocked: secondsRemaining > 0,
    secondsRemaining
  };
}
