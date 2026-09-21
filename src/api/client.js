import { mockServer } from './mock/mockServer';

// Base API client configuration
// When using Vite dev proxy, API_BASE_URL defaults to '' (relative root) so requests route through proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const TOKEN_KEY = 'us24-token';

let memoryToken = null;

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
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      } catch {}
    }
  },

  async request({ path, method = 'GET', data = null, params = null }) {
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
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message = errorBody.error?.message || errorBody.message || errorBody.detail || `API Error: ${res.status} ${res.statusText}`;
        const err = new Error(message);
        err.status = res.status;
        err.data = errorBody;
        throw err;
      }

      return res.json();
    } catch (err) {
      console.warn(`[API Client] ${method} ${url} failed:`, err.message);
      // Optional fallback to mock data if backend connection fails and fallback is enabled
      if (import.meta.env.VITE_FALLBACK_MOCK === 'true') {
        console.info(`[API Client] Falling back to mock data for ${path}`);
        return this.dispatchMock(path, method, data, params);
      }
      throw err;
    }
  },

  dispatchMock(path, method, data, params) {
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
    if (path === '/me' || path === '/api/v1/auth/me') return mockServer.getMe(params?.email);
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
