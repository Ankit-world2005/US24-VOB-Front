import { sha256 as jsSha256 } from 'js-sha256';

/**
 * Computes the SHA-256 hex digest of a string reliably in any environment.
 * @param {string} text - The input string to hash.
 * @returns {Promise<string>} Hex representation of the SHA-256 hash.
 */
export async function sha256(text) {
  // Try native Web Crypto if available in secure contexts
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  // Pure JavaScript SHA-256 fallback (works on any IP, HTTP, or secure context)
  return jsSha256(text);
}
