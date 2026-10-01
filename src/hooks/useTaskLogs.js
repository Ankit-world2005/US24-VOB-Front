import { useEffect, useRef, useState } from 'react';
import { vobsApi } from '../api/vobs';

// Audit reads in flight at once, so a page of many tasks does not burst the API.
const CONCURRENCY = 4;

/**
 * The change history of every VOB in `vobs` (GET /vobs/:id/audit, admin only),
 * kept current as the list is re-polled.
 *
 * A VOB's history is re-read only when its `updatedAt` from the list differs
 * from the one it was last read at. Every write bumps `updated_at` with its
 * audit rows, so a list poll costs one audit call per task that changed, not
 * one per task. A failed read is retried on the next list poll.
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

    // Not cancelled when `vobs` changes: the next poll's list is a new array
    // with the same tasks, and a read already under way is still wanted.
    const worker = async () => {
      while (queue.length > 0 && mounted.current) {
        const task = queue.shift();
        try {
          const entries = await vobsApi.getAudit(task.id);
          if (!mounted.current) return;

          // A task's first read is its history, not news; later reads highlight what is new.
          const isReread = task.id in readAt.current;
          const fresh = isReread ? entries.filter(e => !seenEntryIds.current.has(e.id)).map(e => e.id) : [];
          entries.forEach(e => seenEntryIds.current.add(e.id));
          readAt.current[task.id] = task.updatedAt;

          setLogs(prev => ({ ...prev, [task.id]: entries }));
          if (fresh.length > 0) setFreshIds(new Set(fresh));
        } catch (err) {
          console.error(`[useTaskLogs] Could not read the log of ${task.id}:`, err?.message || err);
        } finally {
          inFlight.current.delete(task.id);
        }
      }
    };
    for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i += 1) worker();
  }, [vobs, enabled]);

  return { logs, freshIds };
}
