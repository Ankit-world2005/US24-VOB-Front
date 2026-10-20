import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { ReassignModal } from '../../components/vob/ReassignModal';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { QueueFilterBar } from '../../components/vob/QueueFilterBar';
import { useRecordFilters, QUEUE_LIMIT } from '../../hooks/useRecordFilters';

// The Auth Queue's own filter: whether the payer's auth number is in yet.
const AUTH_FILTERS = {
  auth: {
    initial: 'all',
    match: (v, value) => (value === 'received') === Boolean(v.authDetails?.authNumber)
  }
};

export function AuthQueueView() {
  const { currentUser, openVerification } = useWorkspace();
  const [authVobs, setAuthVobs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reassignVob, setReassignVob] = useState(null);
  const { filtered, ...filterBar } = useRecordFilters(authVobs, AUTH_FILTERS);

  const loadAuthQueue = () => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Auth Queue',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email,
      limit: QUEUE_LIMIT
    }).then(list => {
      setAuthVobs(list);
      setHasMore(Boolean(list.page?.has_more));
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  };

  useEffect(() => {
    loadAuthQueue();
  }, [currentUser.email, reloadKey]);

  return (
    <div className="auth-queue-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Prior Authorization Queue (U6, FR-10)</h3>
            <span className="panel-sub">VOB records with an incomplete authorization section. Open the form, fill in the authorization fields and submit to move them to Saved Records.</span>
          </div>
          <div className="auth-pill-count">
            {authVobs.length} Records Pending Auth
          </div>
        </div>

        <QueueFilterBar
          {...filterBar}
          shown={filtered.length}
          total={authVobs.length}
          placeholder="Search patient, record ID, insurance or auth number…"
        >
          <select
            className="select-input"
            aria-label="Auth number"
            value={filterBar.filters.auth}
            onChange={(e) => filterBar.setFilter('auth', e.target.value)}
          >
            <option value="all">Any auth status</option>
            <option value="awaiting">Awaiting auth number</option>
            <option value="received">Auth number received</option>
          </select>
        </QueueFilterBar>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Service Type</th>
                <th>Insurance / Payer</th>
                <th>TAT Requirement</th>
                <th>Auth Number / Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="table-empty">Loading Auth Queue…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="table-empty">Could not load this data.</td></tr>
              ) : authVobs.length === 0 ? (
                <tr><td colSpan="8" className="table-empty">No pending prior authorizations in your queue. Great job!</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty">
                    No records match your search and filters.{' '}
                    <button type="button" className="btn-action-link" onClick={filterBar.clear}>Clear filters</button>
                  </td>
                </tr>
              ) : (
                filtered.map(v => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.clientName || v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>
                      <div>{v.appointmentType || 'Physical Therapy'}</div>
                      {v.dos && <div className="patient-sub-cell">DOS: {v.dos}</div>}
                    </td>
                    <td>{v.insurance}</td>
                    <td>
                      <span className="tat-chip">{v.authRequestTat || '3-5 business days'}</span>
                    </td>
                    <td>
                      {v.authDetails?.authNumber ? (
                        <span className="mono bold green">{v.authDetails.authNumber}</span>
                      ) : (
                        <span className="badge-pending-auth">⏳ Awaiting Payer Number</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: 'transparent', border: '1px solid var(--rule, #cbd5e1)', color: 'var(--text, #1e293b)' }}
                          onClick={() => setReassignVob(v)}
                        >
                          Reassign
                        </button>
                        <button
                          type="button"
                          className="btn-action-link"
                          onClick={() => openVerification(v.id)}
                        >
                          View Form
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && (
          <p className="card-detail-footnote">Showing the {QUEUE_LIMIT} most recent records; search and filters cover these.</p>
        )}
      </div>

      {/* Reassign Modal */}
      <ReassignModal
        vob={reassignVob}
        isOpen={Boolean(reassignVob)}
        onClose={() => setReassignVob(null)}
        onSuccess={() => {
          setReassignVob(null);
          loadAuthQueue();
        }}
      />
    </div>
  );
}
