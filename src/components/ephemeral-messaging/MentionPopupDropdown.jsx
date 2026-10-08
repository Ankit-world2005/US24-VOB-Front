import React from 'react';

/**
 * Autocomplete popup dropdown for @mention.
 * Appears when user types "@" in the message box composer.
 */
export function MentionPopupDropdown({
  visible,
  candidates = [],
  selectedIndex = 0,
  query = '',
  onSelect
}) {
  if (!visible) return null;

  return (
    <div
      className="msg-mention-autocomplete-popup"
      role="listbox"
      aria-label="Mention candidates"
      tabIndex={-1}
      onMouseDown={(e) => {
        // Prevent clicking inside popup from triggering outside-click handlers
        e.stopPropagation();
      }}
    >
      <div className="msg-mention-popup-header">
        <span className="msg-mention-popup-title">Suggested People & Teams</span>
        <span className="msg-mention-popup-hint">↑↓ navigate · Enter select · Esc close</span>
      </div>

      {candidates.length === 0 ? (
        <div className="msg-mention-empty-hint">
          No matches found for &quot;@{query}&quot;
        </div>
      ) : (
        <ul className="msg-mention-candidates-list">
          {candidates.map((user, idx) => {
            const isSelected = idx === selectedIndex;
            const isTeam = user.isTeam || user.role === 'all';
            const roleDisplay = isTeam
              ? 'Team Broadcast'
              : user.role === 'admin'
              ? 'Administrator'
              : user.role === 'auth'
              ? 'Auth Specialist'
              : 'Specialist';

            const icon = isTeam
              ? '📢'
              : user.role === 'admin'
              ? '🛡️'
              : user.role === 'auth'
              ? '📋'
              : '👤';

            return (
              <li
                key={user.id || user.tag}
                className={`msg-mention-candidate-item ${isSelected ? 'is-selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Crucial: prevent click from bubbling to document mousedown
                  onSelect(user);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                role="option"
                aria-selected={isSelected}
              >
                <span className="msg-mention-avatar">{icon}</span>
                <div className="msg-mention-details">
                  <div className="msg-mention-top-line">
                    <span className="msg-mention-name">{user.name}</span>
                    <span className="msg-mention-tag">@{user.tag}</span>
                    {isTeam ? (
                      <span className="msg-mention-team-badge">Broadcast</span>
                    ) : (
                      <span className={`msg-mention-role-pill role-${user.role || 'user'}`}>
                        {roleDisplay}
                      </span>
                    )}
                  </div>
                  {user.email && (
                    <span className="msg-mention-email">{user.email}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
