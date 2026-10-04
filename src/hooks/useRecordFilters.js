import { useMemo, useState } from 'react';

// The API's largest page. Queues load this many so the filters, which run in
// the browser, normally see the whole queue.
export const QUEUE_LIMIT = 200;

const BASE = { q: '', client: 'all', dosFrom: '', dosTo: '' };
const NO_EXTRA = {};

/** A record's client as its badge shows it. */
export const clientOf = (v) => v.clientName || v.client || '';

/** Everything a search can match: IDs, patient, client, payer, member and auth numbers. */
function searchTextOf(v) {
  return [
    v.id,
    v.patientName,
    clientOf(v),
    v.insurance,
    v.idCard || v.fields?.id_card,
    v.appointmentType,
    v.authDetails?.authNumber,
    v.assignedTo,
    v.dos,
    v.dob
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Search, client and date-of-service filters over a loaded queue, applied in the
 * browser so results update as the user types. Every word searched for must
 * appear somewhere, in any order, so "steve pratt" finds "Pratt, Steve".
 *
 * `extra` adds a view's own filters, as { key: { initial, match(row, value) } }.
 * Define it outside the component so it keeps its identity between renders.
 */
export function useRecordFilters(rows, extra = NO_EXTRA) {
  const initial = useMemo(() => ({
    ...BASE,
    ...Object.fromEntries(Object.entries(extra).map(([key, f]) => [key, f.initial]))
  }), [extra]);
  const [filters, setFilters] = useState(initial);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const clear = () => setFilters(initial);

  // The clients in this queue. A picked client stays listed after its last
  // record leaves, so the select never shows a filter that is not there.
  const clientOptions = useMemo(() => {
    const names = new Set(rows.map(clientOf).filter(Boolean));
    if (filters.client !== 'all') names.add(filters.client);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rows, filters.client]);

  const filtered = useMemo(() => {
    const terms = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(v => {
      if (filters.client !== 'all' && clientOf(v) !== filters.client) return false;
      const dos = (v.dos || '').slice(0, 10);
      if (filters.dosFrom && (!dos || dos < filters.dosFrom)) return false;
      if (filters.dosTo && (!dos || dos > filters.dosTo)) return false;
      if (terms.length > 0) {
        const text = searchTextOf(v);
        if (!terms.every(t => text.includes(t))) return false;
      }
      return Object.entries(extra).every(
        ([key, f]) => filters[key] === f.initial || f.match(v, filters[key])
      );
    });
  }, [rows, filters, extra]);

  const active = Object.keys(initial).some(key => String(filters[key]).trim() !== String(initial[key]));

  return { filters, setFilter, clear, filtered, clientOptions, active };
}
