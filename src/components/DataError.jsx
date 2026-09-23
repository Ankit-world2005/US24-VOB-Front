import React from 'react';

/**
 * Inline failure state for a panel whose data could not be fetched.
 *
 * Views used to swallow fetch errors into console.error and leave their loading
 * flag set, which left the UI spinning forever on a failure the user could not
 * see. This renders the failure instead, with a way to try again.
 */
export function DataError({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="data-error" role="alert">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="data-error-text">{message}</span>
      {onRetry && (
        <button type="button" className="data-error-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
