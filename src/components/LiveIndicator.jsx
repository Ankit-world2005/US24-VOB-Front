import React from 'react';
import { timeAgo } from '../utils/timeAgo';

/** "Live · updated 12s ago" and a refresh button, for a page kept live by usePolling. */
export function LiveIndicator({ lastUpdated, refreshing, onRefresh, now }) {
  return (
    <div className="live-indicator">
      <span className="live-dot" aria-hidden="true" />
      <span>
        Live · {lastUpdated ? `updated ${timeAgo(lastUpdated, now)}` : 'connecting…'}
      </span>
      <button type="button" className="btn btn-sm ghost" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : '↻ Refresh'}
      </button>
    </div>
  );
}
