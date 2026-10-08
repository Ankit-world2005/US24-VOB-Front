import React, { useEffect, useState, useRef } from 'react';

/**
 * Plays a subtle, non-intrusive Web Audio chime for new message notification.
 */
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone pleasant notification chime
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Audio may be blocked before first user gesture - silently ignore
  }
}

/**
 * Floating notification popup toast for incoming/sent messages & @mentions.
 * Displays at top-right of the screen with action buttons and auto-dismiss countdown.
 */
export function MessageNotificationPopup({
  notification,
  onClose,
  onView,
  duration = 6000
}) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(duration);
  const timerRef = useRef(null);

  // Play audio chime and setup auto-dismiss
  useEffect(() => {
    if (!notification) return;

    playChime();
    remainingTimeRef.current = duration;
    setProgress(100);

    const interval = setInterval(() => {
      if (!isPaused) {
        remainingTimeRef.current -= 50;
        const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          clearInterval(interval);
          onClose();
        }
      }
    }, 50);

    timerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [notification?.id, duration, isPaused, onClose]);

  if (!notification) return null;

  const isTeam = notification.type === 'team' || notification.recipient === 'All Team';
  const isDirect = notification.type === 'direct' || (notification.mentions && notification.mentions.length > 0);

  const initials = notification.sender
    ? notification.sender
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <aside
      className="msg-notification-popup-toast"
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => onView && onView(notification)}
    >
      {/* Top Banner Row */}
      <div className="msg-notif-header">
        <div className="msg-notif-badge-wrap">
          <span className="msg-notif-pulse-dot" aria-hidden="true" />
          <span className="msg-notif-category">
            {isTeam ? '📢 Team Broadcast' : isDirect ? '🎯 @Mention Alert' : '💬 New Message'}
          </span>
        </div>
        <div className="msg-notif-header-right">
          <span className="msg-notif-time">{notification.timestamp || 'Just now'}</span>
          <button
            type="button"
            className="msg-notif-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Dismiss notification"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="msg-notif-body">
        <div className="msg-notif-avatar-col">
          <div className={`msg-notif-avatar ${isTeam ? 'avatar-team' : 'avatar-user'}`}>
            {isTeam ? '📢' : initials}
          </div>
        </div>

        <div className="msg-notif-content-col">
          <div className="msg-notif-sender-row">
            <span className="msg-notif-sender-name">{notification.sender || 'System'}</span>
            {notification.role && (
              <span className="msg-notif-role-pill">{notification.role}</span>
            )}
          </div>

          <div className="msg-notif-title">{notification.title}</div>
          <p className="msg-notif-text">{notification.body}</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="msg-notif-footer">
        <span className="msg-notif-hint">Click to open message</span>
        <button
          type="button"
          className="msg-notif-view-btn"
          onClick={(e) => {
            e.stopPropagation();
            onView && onView(notification);
          }}
        >
          View in Message Box ↗
        </button>
      </div>

      {/* Animated Countdown Progress Bar */}
      <div className="msg-notif-progress-track">
        <div
          className="msg-notif-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
    </aside>
  );
}

export default MessageNotificationPopup;
