import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { CLIENTS } from '../data/clients';
import { ThemeToggle } from '../components/ThemeToggle';

export function PortalHeader({ isDark, toggleTheme }) {
  const {
    currentUser,
    activeRole,
    switchRole,
    selectedClient,
    setSelectedClient,
    onLogout
  } = useWorkspace();

  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const isAdmin = activeRole === 'admin';

  return (
    <header className="portal-header">
      <div className="portal-header-inner">
        {/* Left: Branding & Tagline */}
        <div className="header-brand-group">
          <a className="logo" href="#">
            <span className="logo-mark">
              <span>U<span className="orange">S</span>24</span>
            </span>
            <span className="wordmark">
              <span className="wordmark-name">
                U<span className="orange">S</span>24 SOLUTIONS
              </span>
              <span className="tagline">Innovative Technology Driven</span>
            </span>
          </a>
          <span className="portal-badge hide-sm">VOB Portal</span>
        </div>

        {/* Center: Client Filter (for Admin) and Demo Role Switcher */}
        <div className="header-controls">
          {isAdmin ? (
            <div className="client-select-wrap">
              <label htmlFor="clientSelect">Client:</label>
              <select
                id="clientSelect"
                className="header-select"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="all">All Clients (8)</option>
                {CLIENTS.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="client-pill hide-sm">
              <span className="pill-dot" />
              <span>Assigned Queues (Arra, West AZ, Namste)</span>
            </div>
          )}

          {/* Role Switcher Demo Widget */}
          <div className="role-switcher-toggle" title="Switch workspace view to test Admin or Specialist">
            <span className="role-switch-label hide-sm">View as:</span>
            <button
              type="button"
              className={`role-btn ${isAdmin ? 'active' : ''}`}
              onClick={() => switchRole('admin')}
            >
              ★ Admin
            </button>
            <button
              type="button"
              className={`role-btn ${!isAdmin ? 'active' : ''}`}
              onClick={() => switchRole('user')}
            >
              ● Specialist
            </button>
          </div>
        </div>

        {/* Right: HIPAA status badge, User info, Theme & Logout */}
        <div className="header-right-group">
          <span className="hipaa-badge hide-md" title="HIPAA Security Rule & BAA Active">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            HIPAA BAA
          </span>

          <div className="user-profile-pill">
            <span className="user-avatar">{initials}</span>
            <div className="user-info hide-sm">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-sub">{isAdmin ? 'Administrator' : 'Specialist'}</span>
            </div>
          </div>

          <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

          <button
            type="button"
            className="btn-header-logout"
            onClick={onLogout}
            title="Sign out of employee portal"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
