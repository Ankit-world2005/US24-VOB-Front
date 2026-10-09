import React, { useEffect, useRef, useState } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { vobsApi } from '../../api/vobs';
import { usePolling } from '../../hooks/usePolling';
import { useNow } from '../../hooks/useNow';
import { useTaskLogs } from '../../hooks/useTaskLogs';
import { LiveIndicator } from '../../components/LiveIndicator';
import { cardFor, cardsFor } from '../../data/dashboardCards';
import { timeAgo } from '../../utils/timeAgo';
import { formKeyFor } from '../../utils/vobAdapter';
import { CANONICAL_FIELDS } from '../../data/clients';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { TaskLogTimeline, summarizeLogEntry } from '../../components/vob/TaskLogTimeline';
import { DocumentGeneratorModal } from '../../components/vob/DocumentGeneratorModal';
import { RecordDetailModal } from '../../components/vob/RecordDetailModal';

const LIST_POLL_MS = 15000;
const TASK_POLL_MS = 10000;
// The API's largest page.
const LIST_LIMIT = 200;

/**
 * The page a dashboard KPI card opens: the VOBs that card counts, kept live by
 * polling, with the selected task's details alongside. Admins also see the
 * change history of the tasks on the page — each row's latest event and the
 * selected task's full log. The audit log is admin-only in the API and the
 * database (SEC-6), so specialists do not.
 */
export function CardDetailView() {
  const { currentUser, selectedClient, activeCard, openCardPage, setActiveTab, openVerification, openQueueWithVob } = useWorkspace();
  const isAdmin = currentUser.role === 'admin';
  const isAuditSpecialist = currentUser?.role === 'auth' || currentUser?.role === 'auth_specialist' || currentUser?.role === 'audit' || currentUser?.email === 'jitender.s@us24solutions.com' || currentUser?.email === 'ankit.k@us24solutions.com';
  const card = cardFor(currentUser.role, activeCard);
  const [summary, setSummary] = useState(null);

  // The counts on the switcher, from the same endpoint as the dashboard cards.
  usePolling(async (isCurrent) => {
    const data = await dashboardApi.getSummary(
      isAdmin ? { clientId: selectedClient } : { userEmail: currentUser.email }
    );
    if (isCurrent()) setSummary(data);
  }, LIST_POLL_MS, [isAdmin, selectedClient, currentUser.email]);

  return (
    <div className="card-detail-view">
      <nav className="card-detail-nav" aria-label="Dashboard cards">
        <button
          type="button"
          className="btn-action-link"
          onClick={() => setActiveTab(isAdmin ? 'dashboard' : 'my_dashboard')}
        >
          ← Back to dashboard
        </button>
        <div className="card-switcher">
          {cardsFor(currentUser.role).map(c => (
            <button
              key={c.id}
              type="button"
              className={`card-chip ${c.tone} ${c.id === card.id ? 'active' : ''}`}
              aria-current={c.id === card.id ? 'page' : undefined}
              onClick={() => openCardPage(c.id)}
            >
              <span className="card-chip-label">{c.label}</span>
              <span className="card-chip-count">{summary ? summary[c.summaryKey] : '…'}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Keyed so switching card or client starts from a clean list and selection. */}
      <CardRecords key={`${card.id}|${isAdmin ? selectedClient : ''}`} card={card} isAdmin={isAdmin} />
    </div>
  );
}

function CardRecords({ card, isAdmin }) {
  const { selectedClient } = useWorkspace();
  const [vobs, setVobs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const now = useNow(5000);

  const { lastUpdated, refreshing, refresh } = usePolling(async (isCurrent) => {
    try {
      const list = await vobsApi.getVobs({
        status: card.status,
        // A specialist's list is scoped to their own queue by the API.
        clientId: isAdmin ? selectedClient : undefined,
        limit: LIST_LIMIT
      });
      if (!isCurrent()) return;
      setVobs(list);
      setHasMore(Boolean(list.page?.has_more));
      setLoadError('');
    } catch (err) {
      if (isCurrent()) setLoadError(err?.message || 'Could not load this data.');
      throw err;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, LIST_POLL_MS, []);

  // Open the first task when nothing is selected yet.
  useEffect(() => {
    if (!selectedId && vobs.length > 0) setSelectedId(vobs[0].id);
  }, [vobs, selectedId]);

  // Every listed task's log, re-read as the list shows it changed (admins only).
  const { logs: taskLogs, freshIds: freshLogIds } = useTaskLogs(vobs, isAdmin);

  const selectedRow = vobs.find(v => v.id === selectedId) || null;
  // Admins swap Updated for Latest Activity and add Assigned To.
  const columns = 6 + (isAdmin ? 1 : 0) + (card.id === 'error' ? 1 : 0);

  return (
    <>
      <DataError message={loadError} onRetry={refresh} />

      <section className="panel-card card-detail-header">
        <div className="panel-header">
          <div>
            <h3>{card.label}</h3>
            <span className="panel-sub">
              {card.meta} · {loading ? '…' : `${vobs.length}${hasMore ? '+' : ''} records`}
            </span>
          </div>
          <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} now={now} />
        </div>
      </section>

      <div className="card-detail-grid">
        <section className="panel-card card-detail-list">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Client</th>
                  <th>Patient</th>
                  <th>Date of Service</th>
                  {isAdmin && <th>Assigned To</th>}
                  <th>Status</th>
                  {card.id === 'error' && <th>Failing Rules</th>}
                  {/* Admins see when, and what, in Latest Activity; specialists have no log. */}
                  {isAdmin ? <th>Latest Activity</th> : <th>Updated</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={columns} className="table-empty">Loading records…</td></tr>
                ) : loadError && vobs.length === 0 ? (
                  <tr><td colSpan={columns} className="table-empty">Could not load this data.</td></tr>
                ) : vobs.length === 0 ? (
                  <tr><td colSpan={columns} className="table-empty">No records here right now.</td></tr>
                ) : (
                  vobs.map(v => (
                    <tr
                      key={v.id}
                      className={`interactive-row ${v.id === selectedId ? 'row-selected' : ''}`}
                      tabIndex={0}
                      onClick={() => setSelectedId(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(v.id);
                        }
                      }}
                    >
                      <td className="mono" title={v.id}>{/^[A-Z]+-\d+$/.test(v.id) ? v.id : v.id.slice(0, 8)}</td>
                      <td><ClientBadge clientId={v.clientName || v.client} /></td>
                      <td className="bold">{v.patientName}</td>
                      <td>{v.dos || '—'}</td>
                      {isAdmin && <td>{v.assignedTo || 'Unassigned'}</td>}
                      <td><StatusBadge status={v.vobStatus} /></td>
                      {card.id === 'error' && <td className="mono failure-count">{v.failureCount}</td>}
                      {isAdmin ? (
                        <td className="latest-activity-cell">
                          {taskLogs[v.id]?.[0] ? (
                            <>
                              <span className={freshLogIds.has(taskLogs[v.id][0].id) ? 'log-entry-new' : ''}>
                                {summarizeLogEntry(taskLogs[v.id][0])}
                              </span>
                              <span
                                className="patient-sub-cell"
                                title={new Date(taskLogs[v.id][0].timestamp).toLocaleString()}
                              >
                                by {taskLogs[v.id][0].user} · {timeAgo(taskLogs[v.id][0].timestamp, now)}
                              </span>
                            </>
                          ) : (
                            <span className="patient-sub-cell">{taskLogs[v.id] ? 'No changes yet' : 'Loading…'}</span>
                          )}
                        </td>
                      ) : (
                        <td className="mono" title={v.updatedAt ? new Date(v.updatedAt).toLocaleString() : ''}>
                          {timeAgo(v.updatedAt, now)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <p className="card-detail-footnote">Showing the {LIST_LIMIT} most recent records.</p>
          )}
        </section>

        <aside className="panel-card card-detail-task">
          {selectedId ? (
            <TaskPanel
              key={selectedId}
              vobId={selectedId}
              row={selectedRow}
              card={card}
              isAdmin={isAdmin}
              now={now}
            />
          ) : (
            <div className="task-log-empty">
              {loading ? 'Loading…' : 'Select a record to see its details.'}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/**
 * One task, re-read every TASK_POLL_MS. `row` is its list row when it is still
 * on this card's list; it carries the assignee name and update time, which the
 * single-record response does not.
 */
function TaskPanel({ vobId, row, card, isAdmin, now }) {
  const { openVerification } = useWorkspace();
  const [vob, setVob] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logError, setLogError] = useState('');
  const [freshIds, setFreshIds] = useState(() => new Set());
  const [docOpen, setDocOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  // Log entry ids from the previous poll; null until the first one.
  const seenIds = useRef(null);
  // The last list row seen, so client and assignee stay shown after the record
  // leaves this card's list.
  const lastRow = useRef(row);
  if (row) lastRow.current = row;
  const info = row || lastRow.current;

  const { lastUpdated, refreshing, refresh } = usePolling(async (isCurrent) => {
    const [record, audit] = await Promise.allSettled([
      vobsApi.getVobById(vobId),
      isAdmin ? vobsApi.getAudit(vobId) : Promise.resolve(null)
    ]);
    if (!isCurrent()) return;

    if (record.status === 'fulfilled') {
      setVob(record.value);
      setLoadError('');
    } else {
      setLoadError(record.reason?.message || 'Could not load this record.');
    }

    if (isAdmin) {
      if (audit.status === 'fulfilled') {
        const entries = audit.value;
        if (seenIds.current) {
          setFreshIds(new Set(entries.filter(e => !seenIds.current.has(e.id)).map(e => e.id)));
        }
        seenIds.current = new Set(entries.map(e => e.id));
        setLogs(entries);
        setLogsLoaded(true);
        setLogError('');
      } else {
        setLogError(audit.reason?.message || 'Could not load this task’s log.');
      }
    }

    if (record.status === 'rejected') throw record.reason;
  }, TASK_POLL_MS, [vobId, isAdmin]);

  const status = vob?.vobStatus || info?.vobStatus;
  const leftCard = vob && card.id !== 'all' && !row;
  // `failures` is from the last submit; it only describes the record while it is in Error.
  const failures = vob?.vobStatus === 'Error' ? vob.failingRules || [] : [];

  return (
    <div className="task-panel">
      <div className="task-panel-head">
        <div>
          <div className="task-panel-eyebrow">
            <span className="mono">{vobId.slice(0, 8)}</span>
            {status && <StatusBadge status={status} />}
          </div>
          <h3 className="task-panel-title">{vob?.patientName || info?.patientName || 'Loading…'}</h3>
        </div>
        <LiveIndicator lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} now={now} />
      </div>

      <DataError message={loadError} onRetry={refresh} />

      {leftCard && (
        <div className="task-moved-note">
          This record has moved to <strong>{vob.vobStatus}</strong> and is no longer in {card.label}.
        </div>
      )}

      {vob && (
        <dl className="task-facts">
          <div><dt>Client</dt><dd>{info?.clientName || '—'}</dd></div>
          <div><dt>Date of Service</dt><dd>{vob.dos || '—'}</dd></div>
          <div><dt>Insurance</dt><dd>{vob.insurance || '—'}</dd></div>
          <div><dt>Plan</dt><dd>{vob.planTypeAndName || '—'}</dd></div>
          {isAdmin && <div><dt>Assigned To</dt><dd>{info?.assignedTo || '—'}</dd></div>}
          <div>
            <dt>Last Updated</dt>
            <dd title={row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : ''}>
              {row?.updatedAt ? timeAgo(row.updatedAt, now) : '—'}
            </dd>
          </div>
          {vob.authDetails?.authNumber && (
            <div><dt>Auth Number</dt><dd className="mono">{vob.authDetails.authNumber}</dd></div>
          )}
        </dl>
      )}

      {failures.length > 0 && (
        <div className="failing-reasons-cell">
          {failures.map((f, i) => {
            const key = formKeyFor(f.field) || f.field;
            const label = CANONICAL_FIELDS.find(c => c.key === key || c.key === f.field)?.label || f.field;
            return (
              <div key={i} className="failing-reason-tag">
                <strong>{label}:</strong> {f.message || f.rule}
              </div>
            );
          })}
        </div>
      )}

      {vob && (
        <div className="action-buttons-group task-actions">
          {!isAdmin && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => isAuditSpecialist ? openQueueWithVob(vobId) : openVerification(vobId)}
            >
              {isAuditSpecialist ? 'Audit Record →' : 'Open Form →'}
            </button>
          )}
          {vob.vobStatus === 'Approved' && (
            <button type="button" className="btn btn-sm btn-doc" onClick={() => setDocOpen(true)}>
              📄 Generate VOB Form (.docx)
            </button>
          )}
          {isAdmin && (
            <button type="button" className="btn btn-sm ghost" onClick={() => setInspectOpen(true)}>
              View All Fields
            </button>
          )}
        </div>
      )}

      <div className="task-log-section">
        <div className="task-log-heading">
          <h4>Task Log</h4>
          {isAdmin && <span className="panel-sub">{logs.length} events · updates every {TASK_POLL_MS / 1000}s</span>}
        </div>
        {isAdmin ? (
          <>
            {logError && <div className="task-log-empty">{logError}</div>}
            {!logError && logsLoaded && <TaskLogTimeline entries={logs} freshIds={freshIds} now={now} />}
            {!logError && !logsLoaded && <div className="task-log-empty">Loading log…</div>}
          </>
        ) : (
          <div className="task-log-empty">Change history is visible to administrators (SEC-6).</div>
        )}
      </div>

      {vob && (
        <DocumentGeneratorModal vob={vob} isOpen={docOpen} onClose={() => setDocOpen(false)} />
      )}
      {isAdmin && (
        <RecordDetailModal vobId={vobId} isOpen={inspectOpen} onClose={() => setInspectOpen(false)} />
      )}
    </div>
  );
}
