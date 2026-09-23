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
      } catch {}
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
      } catch {}
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
      } catch {}
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
      } catch {}
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
      } catch {}
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

  async request({ path, method = 'GET', data = null, params = null, _retried = false }) {
    if (this.isMock) {
      // Direct mock server router
      return this.dispatchMock(path, method, data, params);
    }

    // Live HTTP fetch implementation routing through proxy or direct API
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) searchParams.append(k, v);
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
    const token = this.getToken();
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

    try {
      const res = await fetch(url, options);

      // An access token lives 15 minutes. Rather than making every caller handle
      // that, rotate once and replay the request.
      //
      // Only login, refresh and logout are excluded — for those a 401 IS the answer,
      // not a stale token. /auth/me is deliberately not excluded: it is an ordinary
      // authenticated read and the first thing to fail when a token ages out.
      const isCredentialRoute = ['login', 'refresh', 'logout'].some((r) => path.endsWith('/auth/' + r));
      if (res.status === 401 && !isCredentialRoute && !_retried && this.getToken()) {
        const renewed = await this.refreshSession();
        if (renewed) {
          return this.request({ path, method, data, params, _retried: true });
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

      return res.json();
    } catch (err) {
      // Never fall back for authentication. A 401/403 is a real answer from the
      // server, and quietly substituting a mock session would hide an expired
      // token or a revoked account behind a working-looking UI.
      const isAuthPath = path.includes('/auth/');
      const isAuthAnswer = err.status === 401 || err.status === 403 || err.status === 400;
      const willFallBack =
        import.meta.env.VITE_FALLBACK_MOCK === 'true' && !isAuthPath && !isAuthAnswer;

      if (willFallBack) {
        // A route the backend has not implemented yet is an expected condition in
        // this setup, not a fault, so it is announced once per route at info level.
        // console.warn would attach a stack trace to something already handled.
        const route = path.replace(/^\/api\/v1/, '').split('/').slice(0, 2).join('/');
        if (!reportedFallbacks.has(route)) {
          reportedFallbacks.add(route);
          console.info(
            `[API Client] ${path} unavailable (${err.status || 'no response'}) — serving mock data. Further ${route} calls stay quiet.`
          );
        }
        return this.dispatchMock(path, method, data, params);
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
      return mockServer.submitVob(id, data?.userEmail);
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
      return mockServer.commitUpload(id, data?.adminEmail);
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
