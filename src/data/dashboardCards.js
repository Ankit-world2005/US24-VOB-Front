/**
 * The KPI cards on the specialist and admin dashboards. Each card opens its own
 * page (CardDetailView) listing the VOBs it counts, so the dashboards and that
 * page read labels and filters from this one table.
 *
 * `status` is what vobsApi.getVobs() filters on; `summaryKey` is the count from
 * GET /dashboard/summary. A specialist's list and summary are already scoped to
 * their own queue by the API (ownOnly), so the filters are the same for both roles.
 */
const CARDS = {
  all: {
    id: 'all',
    status: 'all',
    summaryKey: 'total',
    tone: '',
    user: { label: 'Assigned to Me', meta: 'Across your assigned clients' },
    admin: { label: 'Total Volume', meta: 'All client requests' }
  },
  pending: {
    id: 'pending',
    status: ['Assigned', 'In Progress'],
    summaryKey: 'pending',
    tone: 'kpi-pending',
    user: { label: 'Pending Verifications', meta: 'Assigned or In Progress' },
    admin: { label: 'Pending Verification', meta: 'Assigned & In Progress' }
  },
  auth_queue: {
    id: 'auth_queue',
    status: 'Auth Queue',
    summaryKey: 'authQueue',
    tone: 'kpi-auth',
    user: { label: 'My Auth Queue', meta: 'Awaiting prior auth numbers' },
    admin: { label: 'Auth Queue', meta: 'Awaiting prior auth determination' }
  },
  error: {
    id: 'error',
    status: 'Error',
    summaryKey: 'error',
    tone: 'kpi-error',
    user: { label: 'Validation Errors', meta: 'Failing rules to correct' },
    admin: { label: 'Validation Error', meta: 'Requires specialist correction' }
  },
  approved: {
    id: 'approved',
    status: 'Approved',
    summaryKey: 'approved',
    tone: 'kpi-approved',
    // The summary counts every approved VOB, not just today's.
    user: { label: 'Saved (Approved)', meta: 'Validated & complete' },
    admin: { label: 'Saved Records (Approved)', meta: 'Validated & complete' }
  }
};

const ORDER = {
  user: ['all', 'pending', 'auth_queue', 'error', 'approved'],
  admin: ['all', 'pending', 'auth_queue', 'approved', 'error']
};

/** The dashboard cards for a role, in display order, with that role's wording. */
export function cardsFor(role) {
  const key = role === 'admin' ? 'admin' : 'user';
  return ORDER[key].map(id => ({ ...CARDS[id], ...CARDS[id][key] }));
}

/** One card for a role, or the first card when the id is unknown. */
export function cardFor(role, id) {
  const cards = cardsFor(role);
  return cards.find(c => c.id === id) || cards[0];
}
