export const STORAGE_KEY = 'us24_client_requests';
export const CLIENT_REQUESTS_SYNC_EVENT = 'us24_client_requests_sync';

export const DEFAULT_SPECIALISTS = [
  { name: 'Rohit K', email: 'rohit.k@us24solutions.com', role: 'user' },
  { name: 'Sam Specialist', email: 'user@us24.test', role: 'user' },
  { name: 'Specialist User', email: 'specialist@us24solutions.com', role: 'user' },
  { name: 'Jitender S', email: 'jitender.s@us24solutions.com', role: 'auth' },
  { name: 'Ankit Kumar', email: 'ankit.k@us24solutions.com', role: 'auth' },
  { name: 'Saurabh Sharma', email: 'saurabh@us24solutions.com', role: 'admin' },
  { name: 'Manish V', email: 'manish.v@us24solutions.com', role: 'admin' }
];

export const INITIAL_REQUESTS = [
  {
    id: 'CR-1001',
    mode: 'Teams',
    client: 'arra',
    insName: 'UnitedHealthcare (UHC)',
    insPhone: '1-800-842-8178',
    planType: 'Choice Plus PPO',
    remark: 'Urgent authorization verification requested via clinical Teams channel',
    assignTo: 'rohit.k@us24solutions.com',
    assignedBy: 'Admin (Saurabh Sharma)',
    total: 5,
    completed: 4,
    notCompleted: 1,
    status: 'In Progress',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    logs: [
      {
        id: 'log-1001-1',
        type: 'created',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        author: 'Admin (Saurabh Sharma)',
        action: 'Request Created & Assigned',
        from: null,
        to: 'Assigned to rohit.k@us24solutions.com',
        note: 'Urgent authorization verification requested via clinical Teams channel for Arra clinic.'
      },
      {
        id: 'log-1001-2',
        type: 'status_change',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
        author: 'Rohit K (Specialist)',
        action: 'Status Changed to In Progress',
        from: 'Not completed',
        to: 'In Progress',
        note: 'Verified 4 of 5 patient policies with UHC provider portal. 1 remaining patient requires live rep call.'
      },
      {
        id: 'log-1001-3',
        type: 'remark',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        author: 'Rohit K (Specialist)',
        action: 'Verification Remark Added',
        note: 'Spoke with UHC Rep Michael (Ref #UH-90821). Authorization approved for 12 physical therapy visits. Copay $35.'
      }
    ]
  },
  {
    id: 'CR-1002',
    mode: 'Email',
    client: 'west_az',
    insName: 'Blue Cross Blue Shield (BCBS)',
    insPhone: '1-800-241-0803',
    planType: 'BlueCare HMO',
    remark: 'Client escalation email regarding secondary coverage breakdown',
    assignTo: 'specialist@us24solutions.com',
    assignedBy: 'Audit Specialist (Jitender S)',
    total: 3,
    completed: 3,
    notCompleted: 0,
    status: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    logs: [
      {
        id: 'log-1002-1',
        type: 'created',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        author: 'Audit Specialist (Jitender S)',
        action: 'Request Created & Assigned',
        from: null,
        to: 'Assigned to specialist@us24solutions.com',
        note: 'Client escalation email regarding secondary coverage breakdown for West AZ clinic.'
      },
      {
        id: 'log-1002-2',
        type: 'remark',
        timestamp: new Date(Date.now() - 3600000 * 9).toISOString(),
        author: 'Specialist User',
        action: 'Verification Remark Added',
        note: 'Called BCBS provider services. Secondary coordination of benefits verified with Medicare primary.'
      },
      {
        id: 'log-1002-3',
        type: 'status_change',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        author: 'Specialist User',
        action: 'Status Marked Completed',
        from: 'In Progress',
        to: 'Completed',
        note: 'All 3 units verified and breakdown documented. Client email response drafted.'
      }
    ]
  },
  {
    id: 'CR-1003',
    mode: 'Sheet',
    client: 'sugarland',
    insName: 'Aetna Healthcare',
    insPhone: '1-800-872-3862',
    planType: 'Managed Choice POS',
    remark: 'Batched sheet request with 8 patient policies to verify today',
    assignTo: 'rohit.k@us24solutions.com',
    assignedBy: 'Admin (Saurabh Sharma)',
    total: 8,
    completed: 2,
    notCompleted: 6,
    status: 'Not completed',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    logs: [
      {
        id: 'log-1003-1',
        type: 'created',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        author: 'Admin (Saurabh Sharma)',
        action: 'Request Created & Assigned',
        from: null,
        to: 'Assigned to rohit.k@us24solutions.com',
        note: 'Batched spreadsheet intake request with 8 patient policies to verify today for Sugarland.'
      },
      {
        id: 'log-1003-2',
        type: 'status_change',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        author: 'Rohit K (Specialist)',
        action: 'Progress Verified',
        from: '0 / 8 units',
        to: '2 / 8 units',
        note: 'Processed 2 policies on Aetna Availity portal. Waiting on employer group plan verification for the remaining 6.'
      }
    ]
  },
  {
    id: 'CR-1004',
    mode: 'Teams',
    client: 'harikrishna_2',
    insName: 'Cigna Health',
    insPhone: '1-800-882-4462',
    planType: 'Open Access Plus',
    remark: 'Need in-network copay and deductible confirmation before 3 PM EST',
    assignTo: 'audit@us24solutions.com',
    assignedBy: 'Admin (Saurabh Sharma)',
    total: 4,
    completed: 4,
    notCompleted: 0,
    status: 'Completed',
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    logs: [
      {
        id: 'log-1004-1',
        type: 'created',
        timestamp: new Date(Date.now() - 3600000 * 36).toISOString(),
        author: 'Admin (Saurabh Sharma)',
        action: 'Request Created & Assigned',
        from: null,
        to: 'Assigned to audit@us24solutions.com',
        note: 'Need in-network copay and deductible confirmation before 3 PM EST for Harikrishna 2.'
      },
      {
        id: 'log-1004-2',
        type: 'status_change',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        author: 'Audit Specialist',
        action: 'Status Marked Completed',
        from: 'In Progress',
        to: 'Completed',
        note: 'All 4 member policies verified and copay tables saved to patient chart.'
      }
    ]
  },
  {
    id: 'CR-1005',
    mode: 'Email',
    client: 'namste',
    insName: 'Humana Medicare Advantage',
    insPhone: '1-800-457-4708',
    planType: 'Humana Gold Plus HMO',
    remark: 'Specialist referral requirement and prior authorization TAT check',
    assignTo: 'specialist@us24solutions.com',
    assignedBy: 'Audit Specialist (Jitender S)',
    total: 6,
    completed: 1,
    notCompleted: 5,
    status: 'In Progress',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    logs: [
      {
        id: 'log-1005-1',
        type: 'created',
        timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
        author: 'Audit Specialist (Jitender S)',
        action: 'Request Created & Assigned',
        from: null,
        to: 'Assigned to specialist@us24solutions.com',
        note: 'Specialist referral requirement and prior authorization TAT check for Namste clinic.'
      },
      {
        id: 'log-1005-2',
        type: 'status_change',
        timestamp: new Date(Date.now() - 3600000 * 40).toISOString(),
        author: 'Specialist User',
        action: 'Progress Verified',
        from: '0 / 6 units',
        to: '1 / 6 units',
        note: '1 of 6 units verified on Humana Vantage. Prior auth required for billing codes 97110 and 97140.'
      }
    ]
  }
];

/**
 * Checks whether a client request is assigned to a specific user.
 * Matches by exact email, exact name, username before '@', or test alias.
 */
export function isAssignedToUser(req, user) {
  if (!req || !user) return false;
  const target = (req.assignTo || '').trim().toLowerCase();
  if (!target) return false;

  const email = (user.email || '').trim().toLowerCase();
  const name = (user.name || '').trim().toLowerCase();
  const username = (user.username || (email ? email.split('@')[0] : '')).trim().toLowerCase();

  // 1. Direct exact matches
  if (email && target === email) return true;
  if (name && target === name) return true;
  if (username && target === username) return true;

  // 2. Prefix matching before '@'
  const targetPrefix = target.includes('@') ? target.split('@')[0] : target;
  const userPrefix = email.includes('@') ? email.split('@')[0] : email;

  if (targetPrefix && userPrefix && targetPrefix === userPrefix) return true;
  if (username && targetPrefix === username) return true;

  // 3. Test / demo specialist aliases
  if (
    (userPrefix === 'user' || userPrefix === 'specialist' || name.toLowerCase().includes('specialist')) &&
    (targetPrefix === 'user' || targetPrefix === 'specialist' || target.includes('specialist'))
  ) {
    return true;
  }

  // 4. Substring token match for names
  if (name) {
    const cleanName = name.replace(/[^a-z0-9]/g, '');
    const cleanTarget = target.replace(/[^a-z0-9]/g, '');
    if (cleanName && cleanTarget && (cleanTarget.includes(cleanName) || cleanName.includes(cleanTarget))) {
      return true;
    }
  }

  if (userPrefix && (target.includes(userPrefix) || userPrefix.includes(targetPrefix))) {
    return true;
  }

  return false;
}

/**
 * Ensures a request object has the logs timeline array initialized.
 */
export function ensureLogs(req) {
  if (Array.isArray(req.logs) && req.logs.length > 0) return req.logs;

  const initial = [
    {
      id: `log-${req.id}-init`,
      type: 'created',
      timestamp: req.createdAt || new Date(Date.now() - 3600000 * 24).toISOString(),
      author: req.assignedBy || 'Admin / Audit Specialist',
      action: 'Request Created & Assigned',
      note: `Received intake via ${req.mode} for client ${(req.client || '').toUpperCase()}. Assigned to ${req.assignTo?.split('@')[0] || 'Specialist'}. Insurance: ${req.insName} (${req.planType || 'Standard Plan'}).`
    }
  ];

  if (req.remark) {
    initial.push({
      id: `log-${req.id}-rem`,
      type: 'remark',
      timestamp: req.updatedAt || req.createdAt || new Date(Date.now() - 3600000 * 12).toISOString(),
      author: req.lastUpdatedBy || (req.status === 'Completed' ? (req.assignTo?.split('@')[0] || 'Specialist') : (req.assignedBy || 'Admin')),
      action: 'Verification Remark Added',
      note: req.remark
    });
  }

  if (req.status === 'Completed') {
    initial.push({
      id: `log-${req.id}-done`,
      type: 'status_change',
      timestamp: req.updatedAt || new Date().toISOString(),
      author: req.lastUpdatedBy || req.assignTo?.split('@')[0] || 'Specialist',
      action: 'Status Marked Completed',
      from: 'Not completed',
      to: 'Completed',
      note: `All ${req.total || 1} units verified and finished.`
    });
  }

  return initial;
}

/**
 * Persist client requests to localStorage and dispatch custom event for live multi-tab & cross-window sync.
 */
export function persistAndSyncClientRequests(requests) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CLIENT_REQUESTS_SYNC_EVENT, { detail: requests }));
    }
  } catch (err) {
    console.warn('Failed to persist client requests', err);
  }
}
