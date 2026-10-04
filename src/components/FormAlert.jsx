import React from 'react';

/** The message box at the top of the sign-in card's forms. Renders nothing when empty. */
export function FormAlert({ tone = 'error', children }) {
  if (!children) return null;
  const success = tone === 'success';

  return (
    <div className={`alert show${success ? ' success' : ''}`} role={success ? 'status' : 'alert'}>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ flexShrink: 0, marginTop: '1px' }}
      >
        <circle cx="12" cy="12" r="10" />
        {success ? (
          <path d="m8 12.5 2.5 2.5L16 9.5" />
        ) : (
          <>
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        )}
      </svg>
      <span>{children}</span>
    </div>
  );
}
