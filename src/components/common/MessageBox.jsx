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
    id: 'msg-team-sample',
    type: 'team',
    sender: 'Saurabh',
    role: 'Administrator',
    title: '📢 Team Announcement',
    recipient: 'All Team',
    body: 'Welcome team! Encrypted HIPAA-compliant communication channel is active.',
    timestamp: 'Today',
    unread: false,
    mentions: ['@team'],
    deletedFor: []
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
 * Extract canonical identifying strings for a user (email, name, id, cleaned tokens)
 */
function getUserIdentifiers(user) {
  if (!user) return [];
  const keys = new Set();
  if (user.id) keys.add(String(user.id).toLowerCase().trim());
  if (user.email) {
    const email = user.email.toLowerCase().trim();
    keys.add(email);
    keys.add(email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''));
  }
  if (user.name) {
    const name = user.name.toLowerCase().trim();
    keys.add(name);
    keys.add(name.replace(/[^a-zA-Z0-9]/g, ''));
  }
  if (user.username) {
    keys.add(user.username.toLowerCase().trim());
  }
  return Array.from(keys).filter(Boolean);
}

/**
 * Check if a message has been deleted by/for the current user ("Delete for me").
 * When User A deletes a message, it is hidden for User A ONLY.
 * The other user (User B) continues to see the message in their message box!
 */
function isMessageDeletedByUser(msg, currentUser) {
  if (!msg || !currentUser) return false;

  const userKeys = getUserIdentifiers(currentUser);
  if (userKeys.length === 0) return false;

  // 1. Check if msg.deletedFor contains any of this user's identifiers
  if (Array.isArray(msg.deletedFor) && msg.deletedFor.length > 0) {
    const hasDeleted = msg.deletedFor.some((delKey) => {
      const cleanDel = String(delKey).toLowerCase().trim();
      return userKeys.includes(cleanDel);
    });
    if (hasDeleted) return true;
  }

  // 2. Check local user-specific deleted set in localStorage for instant local persistence
  try {
    const primaryKey = (currentUser.email || currentUser.name || 'user')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const stored = localStorage.getItem(`us24_deleted_msgs_${primaryKey}`);
    if (stored) {
      const list = JSON.parse(stored);
      if (Array.isArray(list) && list.includes(msg.id)) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

/**
 * Strict recipient check:
 * Returns true IF AND ONLY IF currentUser is the intended recipient of msg.
 * The SENDER is NEVER considered a recipient.
 */
function isRecipientOfMessage(msg, currentUser) {
  if (!msg || !currentUser) return false;

  const currentName = (currentUser.name || '').toLowerCase().trim();
  const currentEmail = (currentUser.email || '').toLowerCase().trim();
  const senderName = (msg.sender || '').toLowerCase().trim();
  const senderEmail = (msg.senderEmail || '').toLowerCase().trim();

  // RULE 1: SENDER IS NEVER THE RECIPIENT
  if (
    senderName === 'me' ||
    (currentName && senderName === currentName) ||
    (currentEmail && senderEmail === currentEmail) ||
    (currentUser.id && msg.senderId && msg.senderId === currentUser.id)
  ) {
    return false;
  }

  // RULE 2: Team / Broadcast messages (@team or @all) are received by team members
  const isTeam =
    msg.type === 'team' ||
    msg.recipient === 'All Team' ||
    msg.recipient === 'team' ||
    (Array.isArray(msg.mentions) &&
      msg.mentions.some((m) => {
        const l = m.toLowerCase();
        return l === '@team' || l === '@all';
      }));
  if (isTeam) {
    return true;
  }

  const cleanUserTag = (currentUser.name || currentUser.email || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const userTagFromEmail = (currentUser.email || '')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  if (!cleanUserTag && !userTagFromEmail && !currentName) {
    return false;
  }

  const recipientClean = (msg.recipient || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const targetedClean = (msg.targetedUser || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  // RULE 3: Direct matching on recipient or targetedUser
  if (
    recipientClean &&
    (recipientClean === cleanUserTag ||
      recipientClean === userTagFromEmail ||
      (msg.recipient || '').toLowerCase().trim() === currentName)
  ) {
    return true;
  }
  if (
    targetedClean &&
    (targetedClean === cleanUserTag || targetedClean === userTagFromEmail)
  ) {
    return true;
  }

  // RULE 4: Mentions array (e.g. ['@AnkitKumar'])
  if (Array.isArray(msg.mentions) && msg.mentions.length > 0) {
    const isMentioned = msg.mentions.some((m) => {
      const clean = m.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return clean === cleanUserTag || clean === userTagFromEmail;
    });
    if (isMentioned) return true;
  }

  // RULE 5: Inline text @tag match (requires minimum 3 characters)
  if (msg.body && cleanUserTag.length >= 3) {
    const bodyLower = msg.body.toLowerCase();
    if (
      bodyLower.includes('@' + cleanUserTag) ||
      (userTagFromEmail.length >= 3 && bodyLower.includes('@' + userTagFromEmail)) ||
      (currentName.length >= 3 && bodyLower.includes('@' + currentName.replace(/\s+/g, '')))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Message list visibility check:
 * A direct message is ONLY visible to:
 * 1) The person to whom it was sent (recipient)
 * 2) The person who sent it (author/sender)
 * No one else can see it.
 *
 * CRITICAL RULE: If currentUser deleted this message ("Delete for me"),
 * it is hidden from currentUser ONLY.
 * The message remains completely untouched in the other user's message box!
 */
function isMessageVisibleToUser(msg, currentUser) {
  if (!msg || !currentUser) return false;

  // RULE 0: If current user deleted this message, hide it from their box!
  if (isMessageDeletedByUser(msg, currentUser)) {
    return false;
  }

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

  const currentName = (currentUser.name || '').toLowerCase().trim();
  const currentEmail = (currentUser.email || '').toLowerCase().trim();
  const senderName = (msg.sender || '').toLowerCase().trim();
  const senderEmail = (msg.senderEmail || '').toLowerCase().trim();

  // 2. Sender sees their own sent message (unless deleted by sender)
  if (
    (currentName && senderName === currentName) ||
    (currentEmail && senderEmail === currentEmail) ||
    (currentUser.id && msg.senderId && msg.senderId === currentUser.id)
  ) {
    return true;
  }

  // 3. Recipient sees the message (unless deleted by recipient)
  if (isRecipientOfMessage(msg, currentUser)) {
    return true;
  }

  // Strictly hidden for all other users
  return false;
}

export function MessageBox() {
  const { currentUser } = useWorkspace();
  // Unique instance ID for this browser tab to prevent any self-notifications
  const tabId = useMemo(() => 'tab-' + Math.random().toString(36).slice(2, 9), []);
  const [isOpen, setIsOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);

  // Notification popup triggers ONLY if currentUser is the RECIPIENT (never sender)
  const triggerNotification = (notif) => {
    if (!notif) return;
    if (isRecipientOfMessage(notif, currentUser)) {
      setActiveNotification(notif);
    }
  };

  // Listen for real-time messages across browser tabs/windows
  useEffect(() => {
    let bc;
    try {
      bc = new BroadcastChannel('us24_messages_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'MESSAGE_SENT' && event.data.message) {
          const incoming = event.data.message;

          // HARD GUARD 1: If message was sent from this exact tab -> NEVER notify
          if (incoming.originTabId && incoming.originTabId === tabId) {
            return;
          }

          // HARD GUARD 2: If message was sent by currentUser -> NEVER notify sender
          const myName = (currentUser?.name || '').toLowerCase().trim();
          const myEmail = (currentUser?.email || '').toLowerCase().trim();
          const sName = (incoming.sender || '').toLowerCase().trim();
          const sEmail = (incoming.senderEmail || '').toLowerCase().trim();

          if (
            sName === 'me' ||
            (myName && sName === myName) ||
            (myEmail && sEmail === myEmail) ||
            (currentUser?.id && incoming.senderId === currentUser.id)
          ) {
            return;
          }

          // HARD GUARD 3: Alert ONLY if currentUser is strictly the RECIPIENT
          if (isRecipientOfMessage(incoming, currentUser)) {
            setMessages((prev) => [incoming, ...prev.filter((m) => m.id !== incoming.id)]);
            setActiveNotification(incoming);
          }
        }
      };
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'us24_message_box_items_v4' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setMessages(parsed);
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser]);
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
    // Simulates an incoming note sent TO currentUser from Saurabh
    const testNotif = {
      id: 'notif-test-' + Date.now(),
      type: 'direct',
      sender: 'Saurabh',
      senderEmail: 'saurabh@us24solutions.com',
      role: 'Administrator',
      title: 'Direct Note to @' + myTag,
      recipient: currentUser?.name || 'Ankit Kumar',
      targetedUser: myTag,
      body: 'Urgent priority case verification requested @' + myTag,
      timestamp: 'Just now',
      unread: true,
      mentions: ['@' + myTag],
      deletedFor: []
    };
    setMessages((prev) => [testNotif, ...prev]);
    // Triggers notification popup specifically for currentUser because they are the recipient!
    setActiveNotification(testNotif);
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
      const saved = localStorage.getItem('us24_message_box_items_v4');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MESSAGES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('us24_message_box_items_v4', JSON.stringify(messages));
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
  // Always compute fresh per-render based on active currentUser to guarantee privacy
  const visibleMessages = messages.filter((m) => isMessageVisibleToUser(m, currentUser));

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

  // Independent "Delete for me" deletion:
  // When User A deletes a message, it is hidden from User A's message box ONLY.
  // The other user (User B) continues to see the message in their message box!
  const deleteMessage = (id, e) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }

    const userKeys = getUserIdentifiers(currentUser);
    const primaryKey = (currentUser?.email || currentUser?.name || 'user')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    // 1. Store in user-specific localStorage for instant "Delete for me" persistence
    try {
      const storageKey = `us24_deleted_msgs_${primaryKey}`;
      const saved = localStorage.getItem(storageKey);
      const list = saved ? JSON.parse(saved) : [];
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem(storageKey, JSON.stringify(list));
      }
    } catch (err) {}

    // 2. Update message in shared state with deletedFor array
    // This marks it deleted for this specific user, while leaving it untouched for the other user!
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const prevDeleted = Array.isArray(m.deletedFor) ? m.deletedFor : [];
          const updatedDeleted = Array.from(new Set([...prevDeleted, ...userKeys]));
          return {
            ...m,
            deletedFor: updatedDeleted
          };
        }
        return m;
      })
    );
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
      ? 'Direct to @' + targetUserObj.name
      : targetTag
      ? 'Direct to @' + targetTag
      : 'Team Note';

    const newNote = {
      id: 'msg-note-' + Date.now(),
      originTabId: tabId, // Tag message with sender tab ID
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
      unread: true, // Recipient will see it as unread
      mentions: mentionMatches,
      deletedFor: []
    };

    // Add to state and save
    setMessages((prev) => [newNote, ...prev]);
    setNoteText('');
    setShowMentionPopup(false);

    // Broadcast in real-time to other tabs/windows
    // The recipient tab will receive this and show the notification popup!
    try {
      const bc = new BroadcastChannel('us24_messages_channel');
      bc.postMessage({ type: 'MESSAGE_SENT', message: newNote });
      setTimeout(() => bc.close(), 100);
    } catch (err) {}

    // SENDER DOES NOT GET THE NOTIFICATION POPUP (Only the recipient does!)
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
                {filteredMessages.filter((msg) => isMessageVisibleToUser(msg, currentUser)).map((msg) => (
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
                          title="Delete for me"
                          onClick={(e) => deleteMessage(msg.id, e)}
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Recipient banner (Private targeting) */}
                    {msg.recipient && (
                      <div className="msg-recipient-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '4px', background: msg.type === 'team' ? 'rgba(249, 115, 22, 0.08)' : 'rgba(6, 72, 192, 0.06)', margin: '4px 0 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="recipient-label" style={{ fontWeight: 600, fontSize: '11px', color: msg.type === 'team' ? '#c2410c' : '#0648c0' }}>
                            {msg.type === 'team' ? '📢 Team Broadcast:' : '🔒 Private To:'}
                          </span>
                          <span className="recipient-name" style={{ fontWeight: 700, fontSize: '11.5px', color: msg.type === 'team' ? '#ea580c' : '#0284c7' }}>
                            {msg.type === 'team' ? '@team (All Team)' : `@${msg.recipient}`}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {msg.type === 'team' ? 'Visible to Team' : 'Only recipient & sender can view'}
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
