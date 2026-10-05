import { useEffect, useRef, useState } from 'react';
import { AUDIT_BATCH_LIMIT, vobsApi } from '../api/vobs';

// Audit requests in flight at once, so a page of many tasks does not burst the API.
const CONCURRENCY = 4;

/**
 * The change history of every VOB in `vobs` (GET /vobs/audit, admin only),
 * kept current as the list is re-polled.
 *
 * Histories are read AUDIT_BATCH_LIMIT to a request, so a card of 200 tasks is
 * 4 requests, not 200. A VOB's history is re-read only when its `updatedAt` from
 * the list differs from the one it was last read at. Every write bumps
 * `updated_at` with its audit rows, so a list poll asks only for the tasks that
 * changed. A failed read is retried on the next list poll.
 *
 * Returns `logs` (id → entries, newest first) and `freshIds`: entries that
 * arrived on a re-read, for the timeline to highlight.
 */
export function useTaskLogs(vobs, enabled) {
  const [logs, setLogs] = useState({});
  const [freshIds, setFreshIds] = useState(() => new Set());
  // id → the updatedAt its entries were read at.
  const readAt = useRef({});
  const inFlight = useRef(new Set());
  const seenEntryIds = useRef(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const queue = vobs
      .filter(v => !inFlight.current.has(v.id) && readAt.current[v.id] !== (v.updatedAt || ''))
      .map(v => ({ id: v.id, updatedAt: v.updatedAt || '' }));
    if (queue.length === 0) return;
    queue.forEach(t => inFlight.current.add(t.id));

    const batches = [];
    for (let i = 0; i < queue.length; i += AUDIT_BATCH_LIMIT) {
      batches.push(queue.slice(i, i + AUDIT_BATCH_LIMIT));
    }

    // Not cancelled when `vobs` changes: the next poll's list is a new array
    // with the same tasks, and a read already under way is still wanted.
    const worker = async () => {
      while (batches.length > 0 && mounted.current) {
        const batch = batches.shift();
        try {
          const byId = await vobsApi.getAudits(batch.map(t => t.id));
          if (!mounted.current) return;

          const read = {};
          const fresh = [];
          for (const task of batch) {
            const entries = byId[task.id];
            // Left out means not visible to this admin: asked again on the next poll,
            // as a failed read is.
            if (!entries) continue;
            // A task's first read is its history, not news; later reads highlight what is new.
            if (task.id in readAt.current) {
              fresh.push(...entries.filter(e => !seenEntryIds.current.has(e.id)).map(e => e.id));
            }
            entries.forEach(e => seenEntryIds.current.add(e.id));
            readAt.current[task.id] = task.updatedAt;
            read[task.id] = entries;
          }

          setLogs(prev => ({ ...prev, ...read }));
          if (fresh.length > 0) setFreshIds(new Set(fresh));
        } catch (err) {
          console.error(`[useTaskLogs] Could not read the logs of ${batch.length} task(s):`, err?.message || err);
        } finally {
          batch.forEach(t => inFlight.current.delete(t.id));
        }
      }
    };
    for (let i = 0; i < Math.min(CONCURRENCY, batches.length); i += 1) worker();
  }, [vobs, enabled]);

  return { logs, freshIds };
}
