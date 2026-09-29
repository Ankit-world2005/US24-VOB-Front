import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { CANONICAL_FIELDS } from '../../data/clients';
import { ReassignModal } from '../../components/vob/ReassignModal';

export function ErrorQueueView() {
  const { currentUser, openVerification } = useWorkspace();
  const [errorVobs, setErrorVobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reassignVob, setReassignVob] = useState(null);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getVobs({
      status: 'Error',
      userEmail: currentUser.role === 'admin' ? undefined : currentUser.email
    }).then(list => {
      setErrorVobs(list);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [currentUser.email, reloadKey]);

  return (
    <div className="error-queue-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Validation Error Queue (U4, U5, FR-9)</h3>
            <span className="panel-sub">VOB records rejected by client-specific validation rules. Correct the failing fields on the original record and resubmit.</span>
          </div>
          <div className="error-pill-count">
            {errorVobs.length} Records Need Correction
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
                <th>Insurance</th>
                <th>Failing Validation Rule(s)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="table-empty">Loading Error Queue...</td></tr>
              ) : loadError ? (
                <tr><td colSpan="7" className="table-empty">Could not load this data.</td></tr>
              ) : errorVobs.length === 0 ? (
                <tr><td colSpan="7" className="table-empty">Clean slate! Zero validation errors in your queue.</td></tr>
              ) : (
                errorVobs.map(v => (
                  <tr key={v.id} className="row-has-error">
                    <td className="mono bold red">{v.id}</td>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>{v.dos}</td>
                    <td>{v.insurance}</td>
                    <td>
                      <div className="failing-reasons-cell">
                        {v.failingRules && v.failingRules.length > 0 ? (
                          v.failingRules.map((r, i) => (
                            <div key={i} className="failing-reason-tag">
                              <strong>{CANONICAL_FIELDS.find(f => f.key === r.field)?.label || r.field}:</strong> {r.message}
                            </div>
                          ))
                        ) : (
                          <div className="failing-reason-tag">Required client fields incomplete</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger-action"
                          onClick={() => openVerification(v.id)}
                        >
                          Correct & Resubmit &rarr;
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{ background: 'transparent', border: '1px solid var(--rule, #cbd5e1)', color: 'var(--text, #1e293b)' }}
                          onClick={() => setReassignVob(v)}
                        >
                          Reassign
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

      <ReassignModal
        vob={reassignVob}
        isOpen={Boolean(reassignVob)}
        onClose={() => setReassignVob(null)}
        onSuccess={() => setReloadKey(k => k + 1)}
      />
    </div>
  );
}
