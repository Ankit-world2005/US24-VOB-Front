import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `fetcher` now and every `intervalMs` after, so a page stays live.
 *
 * - Restarts (and fetches at once) whenever `deps` change.
 * - Skips ticks while the browser tab is hidden and fetches on return.
 * - Never starts a fetch while one is still running.
 * - `fetcher` receives `isCurrent()`: false once the deps changed or the
 *   component unmounted, so a slow response cannot overwrite newer state.
 *
 * The caller owns its data, loading and error state; this only schedules.
 */
export function usePolling(fetcher, intervalMs, deps = []) {
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  // The generation whose fetch is running, or null. Per generation, so a stale
  // fetch finishing late cannot clear the flag of the current one.
  const inFlight = useRef(null);
  const generation = useRef(0);

  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const gen = generation.current;
    if (inFlight.current === gen) return;
    const isCurrent = () => gen === generation.current;
    inFlight.current = gen;
    setRefreshing(true);
    try {
      await fetcherRef.current(isCurrent);
      if (isCurrent()) setLastUpdated(new Date());
    } catch (err) {
      // The fetcher reports its own errors; a failed tick just waits for the next.
      console.error('[usePolling]', err);
    } finally {
      if (inFlight.current === gen) inFlight.current = null;
      if (isCurrent()) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setLastUpdated(null);
    run();

    const timer = setInterval(() => {
      if (!document.hidden) run();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      generation.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { lastUpdated, refreshing, refresh: run };
}
