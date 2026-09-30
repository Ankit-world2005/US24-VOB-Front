import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { ReassignModal } from '../../components/vob/ReassignModal';
import { StatusBadge } from '../../components/vob/StatusBadge';

export function AuthQueueView() {
  const { currentUser, showToast, openVerification } = useWorkspace();
  const [authVobs, setAuthVobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [reassignVob, setReassignVob] = useState(null);
  const [editingAuthId, setEditingAuthId] = useState(null);
  const [authInputs, setAuthInputs] = useState({ authNumber: '', authStartDate: '', authEndDate: '', notes: '' });

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

  const toDateInputVal = (d) => {
    if (!d) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const mmdd = String(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mmdd) return `${mmdd[3]}-${mmdd[1].padStart(2, '0')}-${mmdd[2].padStart(2, '0')}`;
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    return '';
  };

  const handleOpenAuthModal = (vob) => {
    setEditingAuthId(vob.id);
    setAuthInputs({
      authNumber: vob.authDetails?.authNumber || '',
      authStartDate: toDateInputVal(vob.authDetails?.authStartDate || vob.dos),
      authEndDate: toDateInputVal(vob.authDetails?.authEndDate),
      notes: vob.authDetails?.notes || ''
    });
  };

  const handleSaveAndApprove = async () => {
    const trimmedAuth = authInputs.authNumber.trim();
    if (!trimmedAuth) {
      showToast("Please enter the authorization number received from the payer", "error");
      return;
    }

    try {
      const vob = authVobs.find(v => v.id === editingAuthId);
      await vobsApi.authVob(editingAuthId, {
        version: vob?.version || 1,
        auth_number: trimmedAuth,
        auth_valid_from: authInputs.authStartDate || undefined,
        auth_valid_to: authInputs.authEndDate || undefined
      });

      showToast(`Auth #${trimmedAuth} verified! Record moved to Saved Records.`, "success");
      setEditingAuthId(null);
      loadAuthQueue();
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Error updating authorization", "error");
    }
  };

  return (
    <div className="auth-queue-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Prior Authorization Queue (U6, FR-10)</h3>
            <span className="panel-sub">VOB records with an incomplete authorization section. Record the payer's authorization to move them to Saved Records.</span>
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
                          onClick={() => handleOpenAuthModal(v)}
                        >
                          Update Auth #
                        </button>
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

      {/* Auth Entry Modal */}
      {editingAuthId && (
        <div className="modal-overlay" onClick={() => setEditingAuthId(null)}>
          <div className="modal-container auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-eyebrow">Authorization Update</div>
                <h3 className="modal-title">Record {editingAuthId}</h3>
              </div>
              <button type="button" className="drawer-close-btn" onClick={() => setEditingAuthId(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label htmlFor="authNumberInput">Payer Authorization / Pre-Cert Number *</label>
                <input
                  id="authNumberInput"
                  type="text"
                  className="vob-input"
                  placeholder="e.g. PA-UHC-8910293 or CERT-4421"
                  value={authInputs.authNumber}
                  onChange={(e) => setAuthInputs(prev => ({ ...prev, authNumber: e.target.value }))}
                  required
                />
              </div>

              <div className="auth-dates-grid">
                <div className="field">
                  <label htmlFor="authStartDateInput">Auth Start Date</label>
                  <input
                    id="authStartDateInput"
                    type="date"
                    className="vob-input"
                    value={authInputs.authStartDate}
                    onChange={(e) => setAuthInputs(prev => ({ ...prev, authStartDate: e.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="authEndDateInput">Auth Expiration Date</label>
                  <input
                    id="authEndDateInput"
                    type="date"
                    className="vob-input"
                    value={authInputs.authEndDate}
                    onChange={(e) => setAuthInputs(prev => ({ ...prev, authEndDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="authNotesInput">Payer Notes / Reference</label>
                <textarea
                  id="authNotesInput"
                  className="vob-input"
                  rows={3}
                  placeholder="Clinical notes approved, contact name, or authorization limitations…"
                  value={authInputs.notes}
                  onChange={(e) => setAuthInputs(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn ghost" onClick={() => setEditingAuthId(null)}>Cancel</button>
              <button type="button" className="btn" onClick={handleSaveAndApprove}>
                ✓ Save Auth & Move to Saved Records
              </button>
            </div>
          </div>
        </div>
      )}

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
