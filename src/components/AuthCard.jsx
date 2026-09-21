import React from 'react';

export function AuthCard({ children }) {
  return (
    <div className="card">
      <div className="card-head">
        <span>
          <span className="ms-logo">
            <i style={{ background: '#f25022' }} />
            <i style={{ background: '#7fba00' }} />
            <i style={{ background: '#00a4ef' }} />
            <i style={{ background: '#ffb900' }} />
          </span>
          Outlook account
        </span>
        <span className="secure">Secure</span>
      </div>

      <div className="card-body">
        {children}
      </div>

      <div className="card-foot">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Authorized US24 employees only. Activity may be monitored.
      </div>
    </div>
  );
}
