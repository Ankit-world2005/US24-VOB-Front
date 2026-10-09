import { apiClient } from './client';

export const authApi = {
  // POST /api/v1/auth/login
  login({ email, password }) {
    return apiClient.request({
      path: '/api/v1/auth/login',
      method: 'POST',
      data: { email, password }
    });
  },

  // POST /api/v1/auth/2fa/verify
  // Validates the 6-digit OTP code against issued mfa_token
  verify2Fa({ mfaToken, otp }) {
    return apiClient.request({
      path: '/api/v1/auth/2fa/verify',
      method: 'POST',
      data: { mfa_token: mfaToken, otp }
    });
  },

  // POST /api/v1/auth/2fa/resend
  // Requests a fresh OTP code for an active mfa session
  resend2Fa({ mfaToken }) {
    return apiClient.request({
      path: '/api/v1/auth/2fa/resend',
      method: 'POST',
      data: { mfa_token: mfaToken }
    });
  },

  // GET /api/v1/auth/me
  //
  // Takes no argument on purpose: the server resolves the caller from the bearer
  // token. Passing an email here would suggest you can ask about another user.
  getMe() {
    return apiClient.request({
      path: '/api/v1/auth/me'
    });
  },

  // POST /api/v1/auth/logout
  logout() {
    return apiClient.request({
      path: '/api/v1/auth/logout',
      method: 'POST'
    });
  },

  // POST /api/v1/auth/refresh
  refresh() {
    return apiClient.request({
      path: '/api/v1/auth/refresh',
      method: 'POST'
    });
  },

  // POST /api/v1/auth/password/forgot
  //
  // Answers the same way whether or not the email has an account, so a success
  // here does not mean an email was sent.
  requestPasswordReset({ email }) {
    return apiClient.request({
      path: '/api/v1/auth/password/forgot',
      method: 'POST',
      data: { email }
    });
  },

  // POST /api/v1/auth/password/verify
  //
  // Checks the emailed token before asking for a new password. Resolves to
  // { email } for the account it belongs to.
  verifyResetToken(token) {
    return apiClient.request({
      path: '/api/v1/auth/password/verify',
      method: 'POST',
      data: { token }
    });
  },

  // POST /api/v1/auth/password/reset
  resetPassword({ token, newPassword }) {
    return apiClient.request({
      path: '/api/v1/auth/password/reset',
      method: 'POST',
      data: { token, new_password: newPassword }
    });
  }
};
