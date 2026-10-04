import React from 'react';

/**
 * The search box and filters above a queue table. Takes what useRecordFilters
 * returns; a view's own filters go in as children.
 */
export function QueueFilterBar({
  filters,
  setFilter,
  clear,
  active,
  clientOptions,
  shown,
  total,
  placeholder = 'Search patient, record ID, insurance or member ID…',
  children
}) {
  return (
    <div className="filter-toolbar queue-filters" role="search">
      <div className="search-field">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder={placeholder}
          aria-label="Search records"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />
      </div>

      <div className="filter-selects">
        <select
          className="select-input"
          aria-label="Client"
          value={filters.client}
          onChange={(e) => setFilter('client', e.target.value)}
        >
          <option value="all">All clients</option>
          {clientOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {children}

        <label className="date-filter">
          DOS from
          <input
            type="date"
            className="select-input"
            value={filters.dosFrom}
            max={filters.dosTo || undefined}
            onChange={(e) => setFilter('dosFrom', e.target.value)}
          />
        </label>
        <label className="date-filter">
          to
          <input
            type="date"
            className="select-input"
            value={filters.dosTo}
            min={filters.dosFrom || undefined}
            onChange={(e) => setFilter('dosTo', e.target.value)}
          />
        </label>

        {active && (
          <>
            <span className="filter-count" aria-live="polite">Showing {shown} of {total}</span>
            <button type="button" className="btn-action-link" onClick={clear}>
              Clear filters
            </button>
          </>
        )}
      </div>
    </div>
  );
}
