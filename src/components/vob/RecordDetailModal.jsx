import React, { useState, useEffect } from 'react';
import { vobsApi } from '../../api/vobs';
import { StatusBadge } from './StatusBadge';
import { ClientBadge } from './ClientBadge';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CANONICAL_FIELDS } from '../../data/clients';

export function RecordDetailModal({ vobId, isOpen, onClose }) {
  const [vob, setVob] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'audit'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && vobId) {
      setLoading(true);
      Promise.all([
        vobsApi.getVobById(vobId),
        vobsApi.getAudit(vobId)
      ]).then(([vobData, logs]) => {
        setVob(vobData);
        setAuditLogs(logs);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [isOpen, vobId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container record-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-eyebrow">
              {vob && <ClientBadge clientId={vob.client} />}
              <span>Record ID: {vobId}</span>
              {vob && <StatusBadge status={vob.vobStatus} />}
            </div>
            <h2 className="modal-title">{vob?.patientName || 'Loading Record…'}</h2>
          </div>
          <button type="button" className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-subnav">
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            📋 All 28 Canonical Fields
          </button>
          <button
            type="button"
            className={`subnav-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            🔒 HIPAA Audit Log ({auditLogs.length})
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Loading verified record details…</div>
          ) : activeTab === 'data' && vob ? (
            <div className="canonical-fields-grid">
              {CANONICAL_FIELDS.map(f => {
                const val = vob[f.key];
                const prov = vob.provenance?.[f.key];
                return (
                  <div key={f.key} className="canonical-field-cell">
                    <div className="cell-header">
                      <span className="cell-label">{f.label}</span>
                      {prov && <ProvenanceBadge provenance={prov} />}
                    </div>
                    <div className="cell-value">
                      {val ? String(val) : <span className="empty-val">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="audit-timeline">
              {auditLogs.length === 0 ? (
                <div className="empty-audit">No field modifications recorded yet for this record.</div>
              ) : (
                <div className="audit-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Field</th>
                        <th>Old Value</th>
                        <th>New Value</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td className="mono">{new Date(log.timestamp).toLocaleString()}</td>
                          <td>{log.user}</td>
                          <td><span className="action-pill">{log.action}</span></td>
                          <td className="mono bold">{log.field}</td>
                          <td className="cell-old">{log.oldValue || '—'}</td>
                          <td className="cell-new">{log.newValue || '—'}</td>
                          <td>{log.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
