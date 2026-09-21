import React from 'react';

export function WelcomeView({ session, onLogout }) {
  if (!session) return null;

  const initials = session.name
    ? session.name
        .split(' ')
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const roleBadgeText = session.role === 'admin' ? '★ Administrator' : '● Employee';
  const accessLevelText =
    session.role === 'admin' ? 'Admin (full access)' : 'User (standard access)';
  const signedInTime = session.at ? new Date(session.at).toLocaleString() : 'Just now';

  return (
    <section className="welcome" id="welcomeView">
      <div className="who">
        <div className="avatar" id="avatar">
          {initials}
        </div>
        <div>
          <h2 id="welcomeName">Hello, {session.name}</h2>
          <span className={`role ${session.role}`} id="roleBadge">
            {roleBadgeText}
          </span>
        </div>
      </div>

      <div className="meta">
        <div>
          <span>Account</span>
          <span id="metaEmail">{session.email}</span>
        </div>
        <div>
          <span>Access level</span>
          <span id="metaRole">{accessLevelText}</span>
        </div>
        <div>
          <span>Signed in</span>
          <span id="metaTime">{signedInTime}</span>
        </div>
      </div>

      <button type="button" className="btn ghost" id="logoutBtn" onClick={onLogout}>
        Sign out
      </button>
    </section>
  );
}
