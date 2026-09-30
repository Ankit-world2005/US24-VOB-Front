import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { ReassignModal } from '../../components/vob/ReassignModal';
import { StatusBadge } from '../../components/vob/StatusBadge';

export function AuthQueueView() {
  const { currentUser, openVerification } = useWorkspace();
  const [authVobs, setAuthVobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reassignVob, setReassignVob] = useState(null);

  const loadAuthQueue = () => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Auth Queue',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email
    }).then(list => {
      setAuthVobs(list);
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

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Date of Service</th>
                <th>Insurance Carrier</th>
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
              ) : (
                authVobs.map(v => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">{v.appointmentType}</div>
                    </td>
                    <td>{v.dos}</td>
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
