import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { DocumentGeneratorModal } from '../../components/vob/DocumentGeneratorModal';
import { QueueFilterBar } from '../../components/vob/QueueFilterBar';
import { useRecordFilters, QUEUE_LIMIT } from '../../hooks/useRecordFilters';

export function SavedRecordsView() {
  const { currentUser, openVerification } = useWorkspace();
  const [approvedVobs, setApprovedVobs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [docVob, setDocVob] = useState(null);
  const { filtered, ...filterBar } = useRecordFilters(approvedVobs);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Approved',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email,
      limit: QUEUE_LIMIT
    }).then(list => {
      setApprovedVobs(list);
      setHasMore(Boolean(list.page?.has_more));
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser.email, reloadKey]);

  return (
    <div className="saved-records-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Saved Records — Approved Verifications (FR-11, FR-15)</h3>
            <span className="panel-sub">Validated benefit determinations ready for billing and pre-service clinical scheduling</span>
          </div>
          <div className="saved-pill-count">
            {approvedVobs.length} Completed Records
          </div>
        </div>

        <QueueFilterBar {...filterBar} shown={filtered.length} total={approvedVobs.length} />

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Date of Service</th>
                <th>Insurance Carrier</th>
                <th>Cost Share / Copay</th>
                <th>Completion Date</th>
                <th>Documentation Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="table-empty">Loading Approved Records…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="table-empty">Could not load this data.</td></tr>
              ) : approvedVobs.length === 0 ? (
                <tr><td colSpan="8" className="table-empty">No approved records completed yet.</td></tr>
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
                      <div className="patient-sub-cell">ID: {v.idCard}</div>
                    </td>
                    <td>{v.dos}</td>
                    <td>{v.insurance}</td>
                    <td><span className="copay-highlight">{v.copayCoinsurance}</span></td>
                    <td className="mono">{v.vobCompletionDate || '2026-09-21'}</td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="btn btn-sm btn-doc"
                          onClick={() => setDocVob(v)}
                          title="Generate Pre-Authorization & Benefits Determination document"
                        >
                          📄 Generate VOB Form (.docx)
                        </button>
                        <button
                          type="button"
                          className="btn-action-link"
                          onClick={() => openVerification(v.id)}
                          title="Edit saved record"
                        >
                          Edit / Open</button>
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

      <DocumentGeneratorModal
        vob={docVob}
        isOpen={Boolean(docVob)}
        onClose={() => setDocVob(null)}
      />
    </div>
  );
}


