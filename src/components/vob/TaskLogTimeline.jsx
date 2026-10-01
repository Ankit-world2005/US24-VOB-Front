import React from 'react';
import { CANONICAL_FIELDS } from '../../data/clients';
import { formKeyFor, STATUS_MAP_TO_UI } from '../../utils/vobAdapter';
import { timeAgo } from '../../utils/timeAgo';

/**
 * A VOB's change history (GET /vobs/:id/audit, admin only) as a timeline.
 *
 * Field changes are written per column by the `vob_audit` trigger, so `field`
 * is a database column name. Columns whose raw values mean nothing to a reader
 * (ids, the per-client JSON) or are long PHI (the call transcript) are shown as
 * a labelled change without their values.
 */

// Columns with no form label, or whose form label reads oddly out of context.
const COLUMN_LABELS = {
  status: 'Status',
  coverage_order: 'Coverage order',
  copay_coins: 'Copay / coinsurance',
  auth_request_tat: 'Auth request TAT',
  vob_completion_date: 'VOB completion date',
  dialed_time: 'Dialed time',
  assignee_id: 'Assignee',
  previous_assignee_id: 'Previous assignee',
  reassigned_to_id: 'Reassigned to',
  reassigned_by_id: 'Reassigned by',
  reassigned_at: 'Reassigned at',
  reassignment_reason: 'Reassignment reason',
  auth_number: 'Auth number',
  auth_valid_from: 'Auth valid from',
  auth_valid_to: 'Auth valid to',
  extra: 'Client-specific fields',
  transcript: 'Call transcript',
  transcript_channel: 'Transcript channel'
};

/** Changes logged without their old and new values. */
const VALUELESS = new Set([
  'assignee_id', 'previous_assignee_id', 'reassigned_to_id', 'reassigned_by_id',
  'client_id', 'patient_id', 'format_id', 'upload_batch_id', 'extra', 'transcript'
]);

const MAX_VALUE = 80;

function humanize(s) {
  const text = String(s || '').replace(/[_.]+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : 'Event';
}

function fieldLabel(column) {
  if (COLUMN_LABELS[column]) return COLUMN_LABELS[column];
  const key = formKeyFor(column) || column;
  return CANONICAL_FIELDS.find(f => f.key === key || f.key === column)?.label || humanize(column);
}

function showValue(column, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (column === 'status') return STATUS_MAP_TO_UI[value] || value;
  if (value === 'true') return 'YES';
  if (value === 'false') return 'NO';
  const s = String(value);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
}

/** The entry as a title and, for a field change, its old and new values. */
function describe(entry) {
  const detail = entry.detail || {};
  if (detail.event === 'created') {
    return {
      title: 'Record created',
      to: detail.status ? showValue('status', detail.status) : null
    };
  }
  if (entry.field) {
    const label = fieldLabel(entry.field);
    if (VALUELESS.has(entry.field)) return { title: `${label} changed` };
    return {
      title: entry.field === 'status' ? 'Status changed' : `${label} updated`,
      from: showValue(entry.field, entry.oldValue),
      to: showValue(entry.field, entry.newValue)
    };
  }
  return { title: humanize(entry.action), note: entry.notes };
}

export function TaskLogTimeline({ entries, freshIds, now }) {
  if (entries.length === 0) {
    return <div className="task-log-empty">No changes recorded for this task yet.</div>;
  }

  return (
    <ol className="task-log">
      {entries.map(entry => {
        const { title, from, to, note } = describe(entry);
        const isStatus = entry.field === 'status' || entry.detail?.event === 'created';
        return (
          <li
            key={entry.id}
            className={`task-log-entry${isStatus ? ' is-status' : ''}${freshIds.has(entry.id) ? ' log-entry-new' : ''}`}
          >
            <span className="task-log-dot" aria-hidden="true" />
            <div className="task-log-body">
              <div className="task-log-title">{title}</div>
              {(from !== undefined || to) && (
                <div className="task-log-change">
                  {from !== undefined && <span className="cell-old">{from}</span>}
                  {from !== undefined && <span className="task-log-arrow" aria-label="changed to">→</span>}
                  {to && <span className="cell-new">{to}</span>}
                </div>
              )}
              {note && <div className="task-log-note">{note}</div>}
              <div className="task-log-meta">
                <span>{entry.user}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={entry.timestamp} title={new Date(entry.timestamp).toLocaleString()}>
                  {timeAgo(entry.timestamp, now)}
                </time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
