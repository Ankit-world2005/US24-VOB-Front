import { useEffect, useState } from 'react';

/** The current time, re-read every `ms`, so "5s ago" labels keep counting. */
export function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}
