// Base API client configuration
// When using Vite dev proxy, API_BASE_URL defaults to '' (relative root) so requests route through proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const TOKEN_KEY = 'us24-token';
const REFRESH_KEY = 'us24-refresh';

/** Broadcast when the session is gone for good, so the app can return to sign-in. */
export const SESSION_EXPIRED_EVENT = 'us24:session-expired';

let memoryToken = null;
let memoryRefresh = null;

// One refresh at a time. Several views fetch on mount, so an expired token
// produces a burst of 401s. The refresh token rotates on use, so concurrent
// refreshes race: the first wins and the rest get a 401 for presenting a token
// that has already been spent.
let refreshInFlight = null;

export const apiClient = {
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
   * code. Development also returns it in the login body.
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
   * Sends HTTP request directly to the backend API.
   */
  async request({ path, method = 'GET', data = null, params = null, _retried = false }) {
    const token = this.getToken();

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
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    options.signal = controller.signal;

    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);

      // Rotate expired token and replay request if 401 received
      const isCredentialRoute = ['login', 'refresh', 'logout'].some((r) => path.endsWith('/auth/' + r) || path.endsWith('/' + r));
      if (res.status === 401 && !isCredentialRoute && !_retried) {
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
        const rawBody = await res.text().catch(() => '');
        let errorBody = {};
        if (rawBody) {
          try {
            errorBody = JSON.parse(rawBody);
          } catch {
            errorBody = {};
          }
        }

        const unreachable = !rawBody.trim() && [500, 502, 503, 504].includes(res.status);
        const serverMessage = errorBody.error?.message || errorBody.message || errorBody.detail || '';
        const message = serverMessage ||
          (unreachable
            ? `Cannot reach backend API at ${this.baseUrl || 'http://localhost:8000'}. Ensure the backend server is running.`
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
      console.warn(`[API Client] ${method} ${url} failed:`, err.message);
      throw err;
    }
  }
};
