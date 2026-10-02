// Base API client configuration
// When using Vite dev proxy, API_BASE_URL defaults to '' (relative root) so requests route through proxy
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL !== undefined)
    ? import.meta.env.VITE_API_BASE_URL
    : (typeof window !== 'undefined' ? '' : 'http://localhost:8000');
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

// Why the last refresh was refused, for the sign-in page to explain.
let refreshRefusal = null;

// A read the server could not serve for a moment — busy (503), or a gateway
// error — is tried again after these waits, or after the server's Retry-After.
// Only reads: a 503 to a write may follow a write that happened, so writes are
// never replayed.
const READ_RETRY_DELAYS_MS = [600, 1800];
const MAX_RETRY_WAIT_MS = 5000;

/** A failure worth one more try: the server was busy, or the network dropped. */
function isTransient(err) {
  // fetch() rejects with a TypeError when the request never got a response.
  return [502, 503, 504].includes(err?.status) || err instanceof TypeError;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The account this tab signed in as (saved by useAuth), or null. */
function signedInUserId() {
  try {
    return JSON.parse(window.sessionStorage.getItem('us24-session') || 'null')?.id || null;
  } catch {
    return null;
  }
}

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

        // The refresh cookie belongs to the browser, not to this tab: it holds
        // whoever signed in last. If that is another account, taking its token
        // would carry on as them under this tab's name and role — an admin
        // screen sending a specialist's requests.
        const expected = signedInUserId();
        if (expected && session.user?.id && session.user.id !== expected) {
          refreshRefusal = 'account_changed';
          return null;
        }

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
   * Sends a request to the backend API, trying a read again when the server
   * could not serve it for a moment (see READ_RETRY_DELAYS_MS).
   */
  async request(opts) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.send(opts);
      } catch (err) {
        const delay = READ_RETRY_DELAYS_MS[attempt];
        if ((opts.method || 'GET') !== 'GET' || delay === undefined || !isTransient(err)) throw err;
        await sleep(Math.min(err.retryAfterMs || delay, MAX_RETRY_WAIT_MS));
      }
    }
  },

  /**
   * Sends one HTTP request directly to the backend API.
   *
   * `timeout` aborts the request after that many ms (default 20 s). `null` sets
   * no limit, for a call the backend bounds itself (vobsApi.extract).
   */
  async send({ path, method = 'GET', data = null, params = null, headers = null, timeout = 20000, _retried = false }) {
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
        'Accept': 'application/json',
        ...(headers || {})
      },
      credentials: 'include' // Sends cookies automatically
    };

    // Attach Bearer token if available and not overridden by custom headers
    if (!options.headers['Authorization'] && !options.headers['authorization'] && token) {
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

    let timeoutId = null;
    if (timeout > 0) {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);
      options.signal = controller.signal;
    }

    try {
      const res = await fetch(url, options);
      clearTimeout(timeoutId);

      // Rotate expired token and replay request if 401 received
      const isCredentialRoute = ['login', 'refresh', 'logout'].some((r) => path.endsWith('/auth/' + r) || path.endsWith('/' + r));
      if (res.status === 401 && !isCredentialRoute && !_retried) {
        const renewed = await this.refreshSession();
        if (renewed) {
          return this.request({ path, method, data, params, headers, timeout, _retried: true });
        }
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason: refreshRefusal } })
          );
        }
        refreshRefusal = null;
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
        const retryAfter = Number(res.headers.get('retry-after'));
        if (retryAfter > 0) err.retryAfterMs = retryAfter * 1000;
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
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
