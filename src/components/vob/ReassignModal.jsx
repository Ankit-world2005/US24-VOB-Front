import React, { useState, useEffect } from 'react';
import { usersApi } from '../../api/users';
import { vobsApi } from '../../api/vobs';
import { useWorkspace } from '../../context/WorkspaceContext';

export function ReassignModal({ vob, isOpen, onClose, onSuccess }) {
  const { showToast } = useWorkspace();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      setSelectedUserId('');
      setReason('');
      usersApi.getUsers().then(list => {
        const activeUsers = (list || []).filter(u => u.active !== false && u.status !== 'deactivated');
        setUsers(activeUsers.length > 0 ? activeUsers : (list || []));
        setLoadingUsers(false);
      }).catch(err => {
        console.error('Failed to load users:', err);
        setLoadingUsers(false);
      });
    }
  }, [isOpen]);

  if (!isOpen || !vob) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      showToast('Please select a specialist to reassign this task to.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await vobsApi.reassignVob(vob.id, {
        assignee_id: selectedUserId,
        reason: reason.trim() || undefined,
        version: vob.version || 1
      });

      const assignedUser = users.find(u => u.id === selectedUserId);
      const name = assignedUser ? assignedUser.name : 'specialist';
      showToast(`Record ${vob.id} reassigned to ${name} successfully!`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Failed to reassign record.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">Task Reassignment</div>
            <h3 className="modal-title" style={{ margin: '4px 0 0 0' }}>Reassign Record {vob.id}</h3>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--surface-muted, #f8fafc)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--rule-soft, #e2e8f0)', fontSize: '0.875rem' }}>
              <div><strong>Patient:</strong> {vob.patientName || 'Unknown Patient'}</div>
              <div><strong>Client:</strong> {vob.client || vob.clientName || 'General'}</div>
              <div><strong>Current Status:</strong> {vob.vobStatus || vob.status}</div>
              {vob.assignedTo && <div><strong>Currently Assigned:</strong> {vob.assignedTo}</div>}
            </div>

            <div className="field">
              <label htmlFor="reassignAssigneeSelect" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Reassign To Specialist *
              </label>
              <select
                id="reassignAssigneeSelect"
                className="vob-input"
                style={{ width: '100%', padding: '8px 12px' }}
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                disabled={loadingUsers || submitting}
                required
              >
                <option value="">-- Select Specialist / Assignee --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role?.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reassignReasonInput" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Handoff Note / Reason (Optional)
              </label>
              <textarea
                id="reassignReasonInput"
                className="vob-input"
                rows={3}
                style={{ width: '100%', padding: '8px 12px' }}
                placeholder="e.g., Payer follow-up requires specialized coverage, reassigned per supervisor request..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--rule-soft, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting || !selectedUserId}>
              {submitting ? 'Reassigning...' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
