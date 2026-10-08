import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { usersApi } from '../../api/users';
import { MentionPopupDropdown } from './MentionPopupDropdown';
import { MessageNotificationPopup } from './MessageNotificationPopup';

const FALLBACK_USERS = [
  { id: 'team', name: 'All Team Members', tag: 'team', role: 'all', isTeam: true },
  { id: 'US24-04', name: 'Saurabh', tag: 'Saurabh', email: 'saurabh@us24solutions.com', role: 'admin' },
  { id: 'US24-08', name: 'Ankit Kumar', tag: 'AnkitKumar', email: 'ankit.k@us24solutions.com', role: 'auth' },
  { id: 'US24-07', name: 'Jitender S', tag: 'JitenderS', email: 'jitender.s@us24solutions.com', role: 'auth' },
  { id: 'US24-06', name: 'Manish V', tag: 'ManishV', email: 'manish.v@us24solutions.com', role: 'admin' },
  { id: 'US24-01', name: 'Avery Admin', tag: 'AveryAdmin', email: 'admin@us24.test', role: 'admin' },
  { id: 'US24-02', name: 'Sam Specialist', tag: 'SamSpecialist', email: 'user@us24.test', role: 'user' },
  { id: 'US24-05', name: 'Rohit K', tag: 'RohitK', email: 'rohit.k@us24solutions.com', role: 'user' }
];

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
    id: 'msg-direct-ankit',
    type: 'direct',
    sender: 'Saurabh',
    role: 'Administrator',
    title: 'Direct Note to @AnkitKumar',
    recipient: 'AnkitKumar',
    targetedUser: 'AnkitKumar',
    body: 'Please review priority eligibility cases for Namste clinic @AnkitKumar',
    timestamp: '25m ago',
    unread: true,
    mentions: ['@AnkitKumar'],
  },
  {
    id: 'msg-direct-sam',
    type: 'direct',
    sender: 'Manish V',
    role: 'Administrator',
    title: 'Direct Note to @SamSpecialist',
    recipient: 'SamSpecialist',
    targetedUser: 'SamSpecialist',
    body: 'Please verify Banner Desert authorization queue cases @SamSpecialist',
    timestamp: '35m ago',
    unread: true,
    mentions: ['@SamSpecialist'],
  },
  {
    id: 'msg-direct-jitender',
    type: 'direct',
    sender: 'Saurabh',
    role: 'Administrator',
    title: 'Direct Note to @JitenderS',
    recipient: 'JitenderS',
    targetedUser: 'JitenderS',
    body: 'Specialist queue priority dispatch update @JitenderS',
    timestamp: '45m ago',
    unread: true,
    mentions: ['@JitenderS'],
  },
  {
    id: 'msg-task-2',
    type: 'task',
    sender: 'System Allocation',
    role: 'Automated Dispatch',
    title: 'New Records Assigned',
    body: 'You have new patient eligibility verifications assigned to your queue today.',
    timestamp: '1h ago',
    unread: false,
  },
  {
    id: 'msg-team-sample',
    type: 'team',
    sender: 'Sam Specialist',
    role: 'Specialist',
    title: 'Team Announcement',
    recipient: 'All Team',
    body: 'Hey @team all morning Arizona authorizations are verified and updated!',
    timestamp: '2h ago',
    unread: false,
    mentions: ['@team'],
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

function renderMessageContent(text) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, index) => {
    if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
      const isTeam = part.toLowerCase() === '@team' || part.toLowerCase() === '@all';
      return (
        <span
          key={index}
          className={`msg-mention-inline-tag ${isTeam ? 'mention-team-tag' : 'mention-user-tag'}`}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}


/**
 * Determines whether a message should be visible to the current user.
 * - Team/Broadcast: visible to all.
 * - System/Audit: visible to all.
 * - Direct / @Mention: ONLY visible to the mentioned recipient AND the sender.
 */
function isMessageVisibleToUser(msg, currentUser) {
  if (!currentUser) return false;

  // 1. Team / Broadcast messages are visible to everyone
  const isTeam =
    msg.type === 'team' ||
    msg.recipient === 'All Team' ||
    msg.recipient === 'team' ||
    (Array.isArray(msg.mentions) &&
      msg.mentions.some((m) => {
        const lower = m.toLowerCase();
        return lower === '@team' || lower === '@all';
      }));
  if (isTeam) return true;

  // 2. System / Audit queue alerts are visible to all staff
  if (msg.type === 'system' || msg.type === 'audit' || msg.type === 'task') {
    return true;
  }

  const userCleanTag = (currentUser.name || currentUser.email || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const userNameLower = (currentUser.name || '').toLowerCase().trim();
  const userEmailLower = (currentUser.email || '').toLowerCase().trim();

  // 3. Sender always sees their own sent message
  const senderNameLower = (msg.sender || '').toLowerCase().trim();
  const senderEmailLower = (msg.senderEmail || '').toLowerCase().trim();
  if (
    msg.sender === 'Me' ||
    (senderNameLower && senderNameLower === userNameLower) ||
    (senderEmailLower && senderEmailLower === userEmailLower) ||
    msg.senderId === currentUser.id
  ) {
    return true;
  }

  // 4. Recipient matching (targeted user or recipient field)
  const recipientClean = (msg.recipient || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const targetedClean = (msg.targetedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  if (recipientClean && (recipientClean === userCleanTag || (msg.recipient || '').toLowerCase().trim() === userNameLower)) {
    return true;
  }

  if (targetedClean && targetedClean === userCleanTag) {
    return true;
  }

  // 5. Check mentions array (e.g. ['@AnkitKumar'])
  if (Array.isArray(msg.mentions) && msg.mentions.length > 0) {
    const isMentioned = msg.mentions.some((m) => {
      const clean = m.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return clean === userCleanTag || clean === recipientClean;
    });
    if (isMentioned) return true;
  }

  // 6. Check body text for @cleanTag
  if (msg.body) {
    const bodyLower = msg.body.toLowerCase();
    if (
      bodyLower.includes('@' + userCleanTag) ||
      (userNameLower && bodyLower.includes('@' + userNameLower.replace(/\s+/g, '')))
    ) {
      return true;
    }
  }

  // Hidden for everyone else - strictly private
  return false;
}

/**
 * Checks if a notification alert popup belongs to the currently logged-in user.
 * Alert will ONLY trigger if the currentUser was the one mentioned / targeted!
 */
function isNotificationForUser(notif, currentUser) {
  if (!notif || !currentUser) return false;

  // Delivery receipt for the sender
  if (notif.isSenderReceipt) {
    return true;
  }

  // Team broadcast alerts everyone
  const isTeam =
    notif.type === 'team' ||
    notif.recipient === 'All Team' ||
    (Array.isArray(notif.mentions) &&
      notif.mentions.some((m) => {
        const l = m.toLowerCase();
        return l === '@team' || l === '@all';
      }));
  if (isTeam) return true;

  const userCleanTag = (currentUser.name || currentUser.email || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const userNameLower = (currentUser.name || '').toLowerCase().trim();

  const recipientClean = (notif.recipient || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const targetedClean = (notif.targetedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  if (recipientClean === userCleanTag || (notif.recipient || '').toLowerCase().trim() === userNameLower) {
    return true;
  }
  if (targetedClean === userCleanTag) {
    return true;
  }

  if (Array.isArray(notif.mentions)) {
    const isMentioned = notif.mentions.some((m) => {
      const clean = m.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return clean === userCleanTag;
    });
    if (isMentioned) return true;
  }

  if (notif.body) {
    const bodyLower = notif.body.toLowerCase();
    if (bodyLower.includes('@' + userCleanTag)) {
      return true;
    }
  }

  return false;
}

export function MessageBox() {
  const { currentUser } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);

  // Notification popup triggers ONLY if targeted/mentioned user matches currentUser
  const triggerNotification = (notif) => {
    if (!notif) return;
    if (isNotificationForUser(notif, currentUser)) {
      setActiveNotification(notif);
    }
  };

  // Welcome / initial notification on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      const alreadyShown = sessionStorage.getItem('us24_msg_notif_welcomed');
      if (!alreadyShown) {
        sessionStorage.setItem('us24_msg_notif_welcomed', 'true');
        const tag = (currentUser?.name || 'AnkitKumar').replace(/[^a-zA-Z0-9]/g, '');
        triggerNotification({
          id: 'notif-welcome-priority',
          type: 'direct',
          sender: 'Saurabh',
          role: 'Administrator',
          title: 'Direct Note to @' + tag,
          recipient: currentUser?.name || 'You',
          targetedUser: tag,
          body: 'Please review priority eligibility cases for Namste clinic @' + tag,
          timestamp: 'Just now',
          unread: true,
          mentions: ['@' + tag]
        });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentUser?.name]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'mentions' | 'notes'
  const [noteText, setNoteText] = useState('');
  
  // Autocomplete state
  const [availableUsers, setAvailableUsers] = useState(FALLBACK_USERS);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionRange, setMentionRange] = useState({ start: 0, end: 0 });

  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  // Load registered users dynamically
  useEffect(() => {
    let mounted = true;
    usersApi.getUsers().then((data) => {
      if (!mounted || !Array.isArray(data) || data.length === 0) return;
      
      const mapped = data.map((u) => {
        const cleanTag = (u.name || u.email || 'user')
          .replace(/[^a-zA-Z0-9]/g, '');
        return {
          id: u.id,
          name: u.name,
          tag: cleanTag || u.id,
          email: u.email,
          role: u.role || 'user'
        };
      });

      setAvailableUsers([
        { id: 'team', name: 'All Team Members', tag: 'team', role: 'all', isTeam: true },
        ...mapped
      ]);
    }).catch(() => {
      // Keep FALLBACK_USERS
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Filter candidates matching @query
  const filteredCandidates = useMemo(() => {
    if (!showMentionPopup) return [];
    const q = mentionQuery.toLowerCase().trim();
    if (!q) return availableUsers;

    return availableUsers.filter((u) => {
      const matchName = (u.name || '').toLowerCase().includes(q);
      const matchTag = (u.tag || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchRole = (u.role || '').toLowerCase().includes(q);
      return matchName || matchTag || matchEmail || matchRole;
    });
  }, [showMentionPopup, mentionQuery, availableUsers]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionQuery, showMentionPopup]);

  const handleTestNotification = () => {
    const myTag = (currentUser?.name || 'AnkitKumar').replace(/[^a-zA-Z0-9]/g, '');
    const testNotif = {
      id: 'notif-test-' + Date.now(),
      type: 'direct',
      sender: 'Saurabh',
      role: 'Administrator',
      title: 'Direct Note to @' + myTag,
      recipient: currentUser?.name || 'Ankit Kumar',
      targetedUser: myTag,
      body: 'Urgent case #VOB-8921 requires verification sign-off @' + myTag,
      timestamp: 'Just now',
      unread: true,
      mentions: ['@' + myTag]
    };
    setMessages((prev) => [testNotif, ...prev]);
    triggerNotification(testNotif);
  };

  const handleOpenFromNotification = (notif) => {
    setIsOpen(true);
    if (notif.type === 'direct' || (notif.mentions && notif.mentions.length > 0)) {
      setActiveTab('mentions');
    } else if (notif.unread) {
      setActiveTab('unread');
    } else {
      setActiveTab('all');
    }
    if (notif.id) {
      markAsRead(notif.id);
    }
    setActiveNotification(null);
  };

  // Persisted messages
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('us24_message_box_items');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MESSAGES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('us24_message_box_items', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Robust Click Outside Handler (Safe against detached DOM elements during click/unmount)
  useEffect(() => {
    function handleClickOutside(event) {
      // 1. If target node was detached from DOM during the event cycle (e.g. unmounted item), it was clicked inside!
      if (!event.target || !document.contains(event.target)) {
        return;
      }

      // 2. Check composedPath() to see if the target was inside popover or trigger
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (
        (popoverRef.current && path.includes(popoverRef.current)) ||
        (triggerRef.current && path.includes(triggerRef.current))
      ) {
        return;
      }

      // 3. Check contains() on refs
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setShowMentionPopup(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (showMentionPopup) {
          setShowMentionPopup(false);
        } else {
          setIsOpen(false);
        }
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
  }, [isOpen, showMentionPopup]);

  // Filter messages visible ONLY to current user (mentioned recipient, author, or team broadcast)
  const visibleMessages = useMemo(() => {
    return messages.filter((m) => isMessageVisibleToUser(m, currentUser));
  }, [messages, currentUser]);

  const unreadCount = visibleMessages.filter((m) => m.unread).length;
  const mentionsCount = visibleMessages.filter(
    (m) => m.type === 'direct' || m.type === 'team' || (m.mentions && m.mentions.length > 0)
  ).length;
  const notesCount = visibleMessages.filter((m) => m.type === 'notes').length;

  const markAllAsRead = () => {
    setMessages((prev) => prev.map((m) => ({ ...m, unread: false })));
  };

  const markAsRead = (id) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  };

  const deleteMessage = (id, e) => {
    e.stopPropagation();
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  // Insert mention into input WITHOUT closing the entire message box
  const handleSelectMention = (candidate) => {
    const text = noteText;
    const start = mentionRange.start;
    const end = mentionRange.end;

    const before = text.slice(0, start);
    const after = text.slice(end);
    const insertTag = `@${candidate.tag} `;
    const newText = before + insertTag + after;

    setNoteText(newText);
    setShowMentionPopup(false);

    // Re-focus input and set cursor right after inserted tag
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = start + insertTag.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  // Keyboard navigation inside input
  const handleInputKeyDown = (e) => {
    if (showMentionPopup) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (filteredCandidates.length > 0 ? (prev + 1) % filteredCandidates.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (filteredCandidates.length > 0 ? (prev - 1 + filteredCandidates.length) % filteredCandidates.length : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCandidates.length > 0) {
          handleSelectMention(filteredCandidates[selectedIndex]);
        } else {
          setShowMentionPopup(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setShowMentionPopup(false);
        return;
      }
    }
  };

  // Robust @ detector
  const handleInputChange = (e) => {
    const val = e.target.value;
    setNoteText(val);

    const cursorPos = typeof e.target.selectionStart === 'number'
      ? e.target.selectionStart
      : val.length;
    const textBefore = val.slice(0, cursorPos);
    const atIndex = textBefore.lastIndexOf('@');

    if (atIndex !== -1) {
      const query = textBefore.slice(atIndex + 1);
      // Valid mention query: no whitespace between @ and cursor
      if (!/\s/.test(query)) {
        setShowMentionPopup(true);
        setMentionQuery(query);
        setMentionRange({ start: atIndex, end: cursorPos });
        return;
      }
    }

    setShowMentionPopup(false);
  };

  // Helper chips to quickly insert @
  const handleQuickMention = (tag) => {
    const prefix = noteText.endsWith(' ') || noteText.length === 0 ? '' : ' ';
    const newText = `${noteText}${prefix}@${tag} `;
    setNoteText(newText);
    setShowMentionPopup(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleOpenUserSearch = () => {
    const prefix = noteText.endsWith(' ') || noteText.length === 0 ? '' : ' ';
    const newText = `${noteText}${prefix}@`;
    setNoteText(newText);
    setShowMentionPopup(true);
    setMentionQuery('');
    setMentionRange({ start: newText.length - 1, end: newText.length });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSendNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const mentionMatches = noteText.match(/@([a-zA-Z0-9._-]+)/g) || [];
    const isTeamMention = mentionMatches.some(
      (m) => m.toLowerCase() === '@team' || m.toLowerCase() === '@all'
    );
    const firstUserMention = mentionMatches.find(
      (m) => m.toLowerCase() !== '@team' && m.toLowerCase() !== '@all'
    );

    const targetTag = firstUserMention ? firstUserMention.replace(/^@/, '') : null;
    const targetUserObj = targetTag
      ? availableUsers.find(
          (u) =>
            u.tag.toLowerCase() === targetTag.toLowerCase() ||
            (u.name || '').toLowerCase() === targetTag.toLowerCase()
        )
      : null;

    const messageType = isTeamMention ? 'team' : targetTag ? 'direct' : 'notes';
    const messageTitle = isTeamMention
      ? '📢 Team Broadcast'
      : targetUserObj
      ? `Direct to @${targetUserObj.name}`
      : targetTag
      ? `Direct to @${targetTag}`
      : 'Team Note';

    const newNote = {
      id: `msg-note-${Date.now()}`,
      type: messageType,
      sender: currentUser?.name || 'Me',
      senderEmail: currentUser?.email,
      senderId: currentUser?.id,
      role:
        currentUser?.role === 'admin'
          ? 'Administrator'
          : currentUser?.role === 'auth'
          ? 'Auth Specialist'
          : 'Specialist',
      title: messageTitle,
      recipient: isTeamMention ? 'All Team' : targetUserObj?.name || targetTag || null,
      targetedUser: targetTag,
      body: noteText.trim(),
      timestamp: 'Just now',
      unread: false,
      mentions: mentionMatches
    };

    setMessages((prev) => [newNote, ...prev]);
    setNoteText('');
    setShowMentionPopup(false);

    // Instant dispatch notification popup
    triggerNotification({
      id: 'notif-sent-' + Date.now(),
      type: messageType,
      sender: currentUser?.name || 'Me',
      role: 'Sent Message',
      title: isTeamMention
        ? '📢 Broadcast Dispatched to @team'
        : targetUserObj
        ? '🎯 Note Sent to @' + targetUserObj.name
        : '💬 Message Dispatched',
      recipient: isTeamMention ? 'All Team' : targetUserObj?.name || targetTag,
      body: noteText.trim(),
      timestamp: 'Just now',
      mentions: mentionMatches
    });

    // Simulated incoming reply notification popup after 2.5s
    setTimeout(() => {
      const responder = isTeamMention
        ? { name: 'Sam Specialist', role: 'Specialist' }
        : targetUserObj
        ? { name: targetUserObj.name, role: targetUserObj.role === 'admin' ? 'Administrator' : 'Specialist' }
        : { name: 'Saurabh', role: 'Administrator' };

      const myTag = (currentUser?.name || 'Specialist').replace(/[^a-zA-Z0-9]/g, '');
      const replyMsg = {
        id: 'msg-reply-' + Date.now(),
        type: isTeamMention ? 'team' : 'direct',
        sender: responder.name,
        role: responder.role,
        title: 'Reply from ' + responder.name,
        recipient: currentUser?.name || 'Me',
        targetedUser: myTag,
        body: 'Received your note @' + myTag + '! Reviewing and updating verification now.',
        timestamp: 'Just now',
        unread: true,
        mentions: ['@' + myTag]
      };

      setMessages((prev) => [replyMsg, ...prev]);
      triggerNotification(replyMsg);
    }, 2500);
  };

  const filteredMessages = visibleMessages.filter((m) => {
    if (activeTab === 'unread') return m.unread;
    if (activeTab === 'mentions') {
      return m.type === 'direct' || m.type === 'team' || (m.mentions && m.mentions.length > 0);
    }
    if (activeTab === 'notes') return m.type === 'notes';
    return true;
  });

  return (
    <div className="message-box-wrapper" style={{ position: 'relative' }}>
      {/* Real-time Message Notification Popup Toast */}
      <MessageNotificationPopup
        notification={activeNotification}
        onClose={() => setActiveNotification(null)}
        onView={handleOpenFromNotification}
      />

      {/* Trigger Button in Header */}
      <button
        id="btn-message-box-trigger"
        ref={triggerRef}
        type="button"
        className={`message-box-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Message Box & Communications"
        title="Message Box & Communications"
        aria-expanded={isOpen}
      >
        <span className="msg-icon-wrap" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadCount > 0 && <span className="msg-badge-dot" aria-hidden="true" />}
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
          onMouseDown={(e) => {
            // Prevent clicks inside popover from propagating
            e.stopPropagation();
          }}
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
                  className="msg-test-notif-btn"
                  onClick={handleTestNotification}
                  title="Trigger test notification popup"
                >
                  🔔 Test Alert
                </button>
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
                All ({visibleMessages.length})
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
                className={`msg-tab-item ${activeTab === 'mentions' ? 'active' : ''}`}
                onClick={() => setActiveTab('mentions')}
                title="Direct messages & @mentions"
              >
                @Mentions ({mentionsCount})
              </button>
              <button
                type="button"
                className={`msg-tab-item ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes ({notesCount})
              </button>
            </div>
          </div>

          {/* Messages List Body */}
          <div className="msg-popover-body">
            {filteredMessages.length === 0 ? (
              <div className="msg-empty-state">
                <div className="msg-empty-icon" aria-hidden="true">📭</div>
                <div className="msg-empty-text">No messages in this tab.</div>
                <span className="msg-empty-sub">
                  Type <strong>@</strong> below to mention a specialist or team member.
                </span>
              </div>
            ) : (
              <ul className="msg-items-list">
                {filteredMessages.map((msg) => (
                  <li
                    key={msg.id}
                    className={`msg-item ${msg.unread ? 'is-unread' : ''}`}
                    onClick={() => markAsRead(msg.id)}
                  >
                    <div className="msg-item-top">
                      <div className="msg-sender-info">
                        <span className={`msg-type-tag type-${msg.type}`}>
                          {msg.type === 'audit'
                            ? '📋 Audit'
                            : msg.type === 'task'
                            ? '👤 Queue'
                            : msg.type === 'direct'
                            ? '🎯 Direct'
                            : msg.type === 'team'
                            ? '📢 Broadcast'
                            : msg.type === 'notes'
                            ? '💬 Note'
                            : '🛡️ System'}
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

                    {/* Recipient banner (Private targeting) */}
                    {msg.recipient && (
                      <div className="msg-recipient-banner">
                        <span className="recipient-label">
                          {msg.type === 'team' ? '📢 Broadcast To:' : '🔒 Private To:'}
                        </span>
                        <span className="recipient-name">
                          {msg.type === 'team' ? '@team (All Team)' : `@${msg.recipient}`}
                        </span>
                        {msg.sender === (currentUser?.name || 'Me') && (
                          <span
                            className="msg-sent-indicator"
                            style={{
                              marginLeft: 'auto',
                              fontSize: '10px',
                              fontWeight: 600,
                              color: '#0648c0',
                              background: 'rgba(6, 72, 192, 0.08)',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            ✓ Sent by you
                          </span>
                        )}
                      </div>
                    )}

                    <div className="msg-item-title">{msg.title}</div>
                    <div className="msg-item-body">{renderMessageContent(msg.body)}</div>

                    {msg.unread && (
                      <span className="msg-unread-dot" title="Unread" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Mention Helper Pills */}
          <div className="msg-quick-mentions-bar">
            <span className="quick-mention-label">Quick Mention:</span>
            <button
              type="button"
              className="quick-mention-chip chip-team"
              onClick={() => handleQuickMention('team')}
              title="Broadcast to all team members"
            >
              📢 @team
            </button>
            <button
              type="button"
              className="quick-mention-chip chip-user"
              onClick={handleOpenUserSearch}
              title="Type @ to search and mention users"
            >
              👤 @user
            </button>
            <span className="quick-mention-hint">Type @ for auto-complete</span>
          </div>

          {/* Composer Area with guaranteed relative positioning */}
          <div className="msg-composer-outer-wrap">
            {/* Floating Autocomplete Dropdown Popup */}
            <MentionPopupDropdown
              visible={showMentionPopup}
              candidates={filteredCandidates}
              selectedIndex={selectedIndex}
              query={mentionQuery}
              onSelect={handleSelectMention}
            />

            <form className="msg-popover-composer" onSubmit={handleSendNote}>
              <input
                ref={inputRef}
                type="text"
                id="input-msg-quick-note"
                className="msg-composer-input"
                placeholder="Message team... Type @ to mention user"
                value={noteText}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                autoComplete="off"
              />
              <button
                type="submit"
                className="msg-composer-send-btn"
                disabled={!noteText.trim()}
                title="Send note with @mention"
              >
                Send ↗
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
