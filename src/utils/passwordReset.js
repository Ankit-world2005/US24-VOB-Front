// Must match the backend's password policy; the backend has the final say.
export const MIN_PASSWORD_LENGTH = 15;

const RESET_PATH = '/reset-password';

function readTokenFromLink() {
  if (typeof window === 'undefined') return null;
  const { pathname, hash } = window.location;
  if (pathname.replace(/\/+$/, '') !== RESET_PATH) return null;
  const token = new URLSearchParams(hash.slice(1)).get('token');
  // Take the token out of the address bar and the history right away.
  window.history.replaceState(null, '', '/');
  return token || null;
}

/**
 * The token from the emailed link (/reset-password#token=…), or null.
 *
 * Read once at module load, not in a useState initializer: StrictMode runs
 * initializers twice in development, and the second run would find the URL
 * already cleaned. The token sits after the # so it never reaches a server log.
 */
export const resetTokenFromLink = readTokenFromLink();

/** Why the emailed link cannot be used, or null when the failure is something else. */
export function linkProblem(err) {
  if (err?.status !== 400 && err?.status !== 410) return null;
  return err?.data?.error?.code === 'expired_token'
    ? 'This reset link has expired.'
    : 'This reset link is invalid or has already been used.';
}

/** Words for a reset call that failed for any other reason. */
export function resetErrorMessage(err) {
  if (err?.status === 429) {
    return 'Too many reset requests. Please wait a few minutes and try again.';
  }
  // A 404 with no error code means the backend does not have the reset routes.
  if ((err?.status === 404 || err?.status === 405) && !err?.data?.error?.code) {
    return 'Password reset is not available yet. Please contact your administrator (saurabh@us24solutions.com).';
  }
  // fetch() rejects with a TypeError when there is no response, and with an
  // AbortError when the client's timeout fires.
  if (err instanceof TypeError || err?.name === 'AbortError' || err?.unreachable) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (err?.generic || typeof err?.message !== 'string' || !err.message) {
    return 'Something went wrong. Please try again.';
  }
  return err.message;
}
