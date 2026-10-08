import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

const DEFAULT_MESSAGES = [
  {
    id: 'msg-audit-1',
    type: 'audit',
    sender: 'Audit Specialist',
    role: 'Quality Assurance',
    title: 'Audit Queue Verified',
    body: 'VOB record for Parker Rehabilitation passed QA audit and was handed back to specialist queue.',
    timestamp: '15m ago',
    unread: true,
  },
  {
    id: 'msg-task-2',
    type: 'task',
    sender: 'System Allocation',
    role: 'Automated Dispatch',
    title: 'New Records Assigned',
    body: 'You have new patient eligibility verifications assigned to your queue today.',
    timestamp: '1h ago',
    unread: true,
  },
  {
    id: 'msg-auth-3',
    type: 'auth',
    sender: 'Auth Specialist Team',
    role: 'Authorizations',
    title: 'Prior Auth Completed',
    body: 'Insurance authorization approved for physical therapy evaluation coverage.',
    timestamp: '3h ago',
    unread: false,
  },
  {
    id: 'msg-sys-4',
    type: 'system',
    sender: 'HIPAA Security Bot',
    role: 'Compliance',
    title: 'BAA Security Verification',
    body: 'Encrypted communication channel active under HIPAA Business Associate Agreement.',
    timestamp: 'Today',
    unread: false,
  }
];

export function MessageBox() {
  const { currentUser } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'notes'
  const [noteText, setNoteText] = useState('');
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  // Load persisted messages or default seed
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('us24_message_box_items');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MESSAGES;
  });

  // Save to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem('us24_message_box_items', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = messages.filter(m => m.unread).length;

  const markAllAsRead = () => {
    setMessages(prev => prev.map(m => ({ ...m, unread: false })));
  };

  const markAsRead = (id) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, unread: false } : m)));
  };

  const deleteMessage = (id, e) => {
    e.stopPropagation();
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleSendNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const newNote = {
      id: `msg-note-${Date.now()}`,
      type: 'notes',
      sender: currentUser?.name || 'Me',
      role: currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'auth' ? 'Auth Specialist' : 'Specialist',
      title: 'Team Note',
      body: noteText.trim(),
      timestamp: 'Just now',
      unread: false,
    };

    setMessages(prev => [newNote, ...prev]);
    setNoteText('');
  };

  const filteredMessages = messages.filter(m => {
    if (activeTab === 'unread') return m.unread;
    if (activeTab === 'notes') return m.type === 'notes';
    return true;
  });

  return (
    <div className="message-box-wrapper" style={{ position: 'relative' }}>
      {/* Trigger Button between HIPAA BAA and User Avatar */}
      <button
        id="btn-message-box-trigger"
        ref={triggerRef}
        type="button"
        className={`message-box-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Message Box & Notifications"
        title="Message Box & Communications"
        aria-expanded={isOpen}
      >
        <span className="msg-icon-wrap" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadCount > 0 && (
            <span className="msg-badge-dot" aria-hidden="true" />
          )}
        </span>
        <span className="msg-trigger-label hide-sm">Messages</span>
        {unreadCount > 0 && (
          <span className="msg-count-pill" title={`${unreadCount} unread messages`}>
            {unreadCount}
          </span>
        )}
      </button>

      {/* Message Box Popover */}
      {isOpen && (
        <div
          id="popover-message-box"
          ref={popoverRef}
          className="message-box-popover"
          role="dialog"
          aria-label="Message Box Panel"
        >
          {/* Header */}
          <div className="msg-popover-header">
            <div className="msg-header-title-row">
              <div className="msg-title-wrap">
                <span className="msg-header-icon" aria-hidden="true">💬</span>
                <span className="msg-header-title">Message Box</span>
                {unreadCount > 0 && (
                  <span className="badge badge-warning" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="msg-header-actions">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="msg-action-btn"
                    onClick={markAllAsRead}
                    title="Mark all as read"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  className="msg-close-btn"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close message box"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="msg-tabs-bar">
              <button
                type="button"
                className={`msg-tab-item ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All ({messages.length})
              </button>
              <button
                type="button"
                className={`msg-tab-item ${activeTab === 'unread' ? 'active' : ''}`}
                onClick={() => setActiveTab('unread')}
              >
                Unread ({unreadCount})
              </button>
              <button
                type="button"
                className={`msg-tab-item ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes ({messages.filter(m => m.type === 'notes').length})
              </button>
            </div>
          </div>

          {/* Messages List Body */}
          <div className="msg-popover-body">
            {filteredMessages.length === 0 ? (
              <div className="msg-empty-state">
                <div className="msg-empty-icon" aria-hidden="true">📭</div>
                <div className="msg-empty-text">No messages in this tab.</div>
                <span className="msg-empty-sub">System updates and specialist notes will appear here.</span>
              </div>
            ) : (
              <ul className="msg-items-list">
                {filteredMessages.map(msg => (
                  <li
                    key={msg.id}
                    className={`msg-item ${msg.unread ? 'is-unread' : ''}`}
                    onClick={() => markAsRead(msg.id)}
                  >
                    <div className="msg-item-top">
                      <div className="msg-sender-info">
                        <span className={`msg-type-tag type-${msg.type}`}>
                          {msg.type === 'audit' ? '📋 Audit' : msg.type === 'task' ? '👤 Queue' : msg.type === 'notes' ? '💬 Note' : '🛡️ System'}
                        </span>
                        <span className="msg-sender-name">{msg.sender}</span>
                      </div>
                      <div className="msg-item-meta">
                        <span className="msg-time">{msg.timestamp}</span>
                        <button
                          type="button"
                          className="msg-delete-btn"
                          title="Dismiss message"
                          onClick={(e) => deleteMessage(msg.id, e)}
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <div className="msg-item-title">{msg.title}</div>
                    <div className="msg-item-body">{msg.body}</div>

                    {msg.unread && (
                      <span className="msg-unread-dot" title="Unread" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Note Composer at Bottom */}
          <form className="msg-popover-composer" onSubmit={handleSendNote}>
            <input
              type="text"
              id="input-msg-quick-note"
              className="msg-composer-input"
              placeholder="Post a quick note or remark…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button
              type="submit"
              className="msg-composer-send-btn"
              disabled={!noteText.trim()}
              title="Post note"
            >
              Post ↗
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
