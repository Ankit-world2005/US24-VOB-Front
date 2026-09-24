import { mockServer } from './mock/mockServer';

// Base API client configuration
// When using Vite dev proxy, API_BASE_URL defaults to '' (relative root) so requests route through proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const TOKEN_KEY = 'us24-token';
const REFRESH_KEY = 'us24-refresh';

/** Broadcast when the session is gone for good, so the app can return to sign-in. */
export const SESSION_EXPIRED_EVENT = 'us24:session-expired';

let memoryToken = null;
let memoryRefresh = null;

// One refresh at a time. Several views fetch on mount, so an expired token
// produces a burst of 401s. The refresh token rotates on use, so concurrent
// refreshes race: the first wins and the rest get a 401 for presenting a token
// that has already been spent, which would sign the user out for no reason.
let refreshInFlight = null;

// Routes already reported as unavailable, so a route the backend has not built yet
// is announced once rather than on every render. StrictMode double-invokes each
// effect in development and several views fetch the same route.
const reportedFallbacks = new Set();

export const apiClient = {
  isMock: USE_MOCK,
  baseUrl: API_BASE_URL,

  getToken() {
    if (memoryToken) return memoryToken;
    if (typeof window !== 'undefined') {
      try {
        return window.sessionStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(TOKEN_KEY) || null;
      } catch { }
    }
    return null;
  },

  setToken(token, remember = false) {
    memoryToken = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.sessionStorage.setItem(TOKEN_KEY, token);
          if (remember) {
            window.localStorage.setItem(TOKEN_KEY, token);
          }
        } else {
          this.clearToken();
        }
      } catch { }
    }
  },

  clearToken() {
    memoryToken = null;
    memoryRefresh = null;
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
        window.sessionStorage.removeItem(REFRESH_KEY);
        window.localStorage.removeItem(REFRESH_KEY);
      } catch { }
    }
  },

  /**
   * In production the refresh token is an HttpOnly cookie and never reaches this
   * code. Development also returns it in the login body, because a SameSite=Lax
   * cookie is not sent cross-site — see the note in the API's auth router.
   */
  getRefreshToken() {
    if (memoryRefresh) return memoryRefresh;
    if (typeof window !== 'undefined') {
      try {
        return window.sessionStorage.getItem(REFRESH_KEY) || window.localStorage.getItem(REFRESH_KEY) || null;
      } catch { }
    }
    return null;
  },

  setRefreshToken(token, remember = false) {
    memoryRefresh = token || null;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          window.sessionStorage.setItem(REFRESH_KEY, token);
          if (remember) window.localStorage.setItem(REFRESH_KEY, token);
        } else {
          window.sessionStorage.removeItem(REFRESH_KEY);
          window.localStorage.removeItem(REFRESH_KEY);
        }
      } catch { }
    }
  },

  /**
   * Rotates the access token using the refresh token, at most once concurrently.
   * Resolves to the new access token, or null when the session cannot be renewed.
   */
  async refreshSession() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      try {
        const stored = this.getRefreshToken();
        const res = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          // The cookie carries it in production; the body is the development path.
          credentials: 'include',
          body: JSON.stringify(stored ? { refresh_token: stored } : {}),
        });
        if (!res.ok) return null;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;

        const session = await res.json();
        if (!session?.access_token) return null;

        const remember =
          typeof window !== 'undefined' && Boolean(window.localStorage.getItem(TOKEN_KEY));
        this.setToken(session.access_token, remember);
        if (session.refresh_token) this.setRefreshToken(session.refresh_token, remember);
        return session.access_token;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  },

  /**
   * Whether requests go to the mock server. A demo sign-in (made while the backend
   * was unreachable) holds a token the real API rejects, so that session stays on
   * mock data.
   */
  usesMock() {
    return this.isMock || /^(local_dev_token_|mock_jwt_token_)/.test(this.getToken() || '');
  },

  /**
   * `mockParams` reach only the mock server. The real backend scopes lists to the
   * caller's token and rejects query params it does not know (400).
   */
  async request({ path, method = 'GET', data = null, params = null, mockParams = null, _retried = false }) {
    const token = this.getToken();
    if (this.usesMock()) {
      return this.dispatchMock(path, method, data, { ...params, ...mockParams });
    }

    // Live HTTP fetch implementation routing through proxy or direct API
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          if (Array.isArray(v)) {
            v.forEach(val => searchParams.append(k, val));
          } else {
            searchParams.append(k, v);
          }
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include' // Sends cookies automatically
    };

    // Attach Bearer token if available
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        options.body = data;
        delete options.headers['Content-Type']; // Let browser set multipart boundary
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const controller = new AbortController();
    // Generous enough for a serverless cold start on the deployed backend.
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    options.signal = controller.signal;

    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);

      // An access token lives 15 minutes. Rather than making every caller handle
      // that, rotate once and replay the request.
      //
      // Only login, refresh and logout are excluded — for those a 401 IS the answer,
      // not a stale token. /auth/me is deliberately not excluded: it is an ordinary
      // authenticated read and the first thing to fail when a token ages out.
      //
      // A request that went out with no access token at all is renewed too: the
      // refresh cookie may still hold a session, and if it does not, the app must
      // return to sign-in rather than keep failing with "Sign in to continue."
      const isCredentialRoute = ['login', 'refresh', 'logout'].some((r) => path.endsWith('/auth/' + r) || path.endsWith('/' + r));
      if (res.status === 401 && !isCredentialRoute && !_retried) {
        const renewed = await this.refreshSession();
        if (renewed) {
          return this.request({ path, method, data, params, mockParams, _retried: true });
        }
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
        }
      }

      if (!res.ok) {
        // Read the body once as text: an empty body is itself a signal (see below).
        const rawBody = await res.text().catch(() => '');
        let errorBody = {};
        if (rawBody) {
          try {
            errorBody = JSON.parse(rawBody);
          } catch {
            errorBody = {};
          }
        }

        // The Vite dev proxy replies with an empty text/plain 500 when it cannot reach
        // the backend at all. Without this check that is indistinguishable from a real
        // server-side fault, and surfaces to the user as "API Error: 500".
        const unreachable = !rawBody.trim() && [500, 502, 503, 504].includes(res.status);

        // Distinguish a message the server actually sent from one we invented, so callers
        // can substitute their own user-facing wording instead of echoing 'API Error: 401'.
        const serverMessage = errorBody.error?.message || errorBody.message || errorBody.detail || '';
        const message = serverMessage ||
          (unreachable
            ? `Cannot reach the backend API at ${this.baseUrl || 'the dev proxy target'}. Check that the server is running and that BACKEND_URL in .env points at it.`
            : `API Error: ${res.status} ${res.statusText} (${method} ${path})`);

        const err = new Error(message);
        err.status = res.status;
        err.data = errorBody;
        err.unreachable = unreachable;
        err.generic = !serverMessage;
        throw err;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `Expected JSON response but received ${contentType || 'non-JSON'}. ` +
          (text.includes('<!DOCTYPE') ? 'Received HTML page instead of API response. Check that your backend proxy/URL is reachable.' : text.slice(0, 100))
        );
      }

      return res.json();
    } catch (err) {
      // Never fall back for auth credential submission routes (login, logout, refresh).
      const isAuthCredential = ['login', 'logout', 'refresh'].some((r) => path.endsWith('/auth/' + r) || path.endsWith('/' + r));
      const isAuthAnswer = err.status === 401 || err.status === 403 || err.status === 400;
      const isNotFound = err.status === 404;
      const willFallBack =
        !isAuthCredential &&
        (!isAuthAnswer || path.includes('/me')) &&
        (import.meta.env.VITE_FALLBACK_MOCK === 'true' || isNotFound || err.unreachable);

      if (willFallBack) {
        const route = path.replace(/^\/api\/v1/, '').split('/').slice(0, 2).join('/');
        if (!reportedFallbacks.has(route)) {
          reportedFallbacks.add(route);
          console.info(
            `[API Client] ${path} unavailable (${err.status || 'no response'}) — serving mock data. Further ${route} calls stay quiet.`
          );
        }
        return this.dispatchMock(path, method, data, { ...params, ...mockParams });
      }

      // Nothing will handle this one, so it is a real failure worth the stack trace.
      console.warn(`[API Client] ${method} ${url} failed:`, err.message);
      throw err;
    }
  },

  dispatchMock(path, method, data, params) {
    // Requests carry the backend's /api/v1 prefix. The routes below are matched
    // against bare paths, so strip it once here rather than in every branch. This
    // also keeps the path.split('/')[2] id lookups below pointing at the id.
    path = path.replace(/^\/api\/v1/, '');

    if (path === '/api/v1/auth/login' || path === '/auth/login') {
      return Promise.resolve({
        access_token: 'mock_jwt_token_' + Date.now(),
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 'mock_user_1',
          email: data?.email || 'user@us24.test',
          name: data?.email === 'user@us24.test' ? 'Sam Specialist' : 'User Specialist',
          role: data?.email?.toLowerCase().includes('admin') ? 'admin' : 'user'
        }
      });
    }
    if (path === '/healthz') return mockServer.getHealthz();
    if (path === '/readyz') return mockServer.getReadyz();
    if (path === '/me' || path === '/auth/me') return mockServer.getMe(params?.email);
    if (path === '/auth/logout' || path === '/api/v1/auth/logout') return mockServer.logout();
    if (path === '/dashboard/summary') return mockServer.getDashboardSummary(params || {});
    if (path === '/vobs' && method === 'GET') return mockServer.getVobs(params || {});
    if (path.startsWith('/vobs/') && path.endsWith('/audit')) {
      const id = path.split('/')[2];
      return mockServer.getVobAuditLogs(id);
    }
    if (path.startsWith('/vobs/') && path.includes('/extraction/')) {
      const parts = path.split('/');
      return mockServer.getExtractionResult(parts[2], parts[4]);
    }
    if (path.startsWith('/vobs/') && path.endsWith('/transcript')) {
      const id = path.split('/')[2];
      return mockServer.postTranscript(id, data?.transcript);
    }
    if (path.startsWith('/vobs/') && path.endsWith('/submit')) {
      const id = path.split('/')[2];
      return mockServer.submitVob(id, data?.userEmail, data?.version);
    }
    if (path.startsWith('/vobs/') && path.endsWith('/auth') && method === 'POST') {
      const id = path.split('/')[2];
      return mockServer.authVob(id, data);
    }
    if (path.startsWith('/vobs/') && method === 'GET') {
      const id = path.split('/')[2];
      return mockServer.getVobById(id);
    }
    if (path.startsWith('/vobs/') && method === 'PATCH') {
      const id = path.split('/')[2];
      return mockServer.patchVob(id, data?.edits, data?.version, data?.userEmail);
    }
    if (path === '/audit' && method === 'GET') return mockServer.getAllAuditLogs();
    if (path === '/uploads' && method === 'POST') return mockServer.uploadFile(data, params?.client);
    if (path.startsWith('/uploads/') && path.endsWith('/preview')) {
      const id = path.split('/')[2];
      return mockServer.getUploadPreview(id);
    }
    if (path.startsWith('/uploads/') && path.endsWith('/commit')) {
      const id = path.split('/')[2];
      return mockServer.commitUpload(id, data, params?.adminEmail);
    }
    if (path === '/assignments' && method === 'POST') return mockServer.assignVobs(data, params?.adminEmail);
    if (path === '/users' && method === 'GET') return mockServer.getUsers();
    if (path === '/users' && method === 'POST') return mockServer.createUser(data);
    if (path.startsWith('/users/') && method === 'PATCH') {
      const id = path.split('/')[2];
      return mockServer.patchUser(id, data);
    }
    if (path.startsWith('/clients/') && path.endsWith('/format')) {
      const id = path.split('/')[2];
      return mockServer.getClientFormat(id);
    }
    if (path === '/exports' && method === 'POST') return mockServer.exportVobs(data?.client, data?.format);

    console.warn(`Mock endpoint not implemented for ${method} ${path}`);
    return Promise.resolve({ success: true });
  }
};
