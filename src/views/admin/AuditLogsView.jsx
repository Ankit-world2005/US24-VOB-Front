import React, { useState, useEffect } from 'react';
import { DataError } from '../../components/DataError';
import { vobsApi } from '../../api/vobs';

export function AuditLogsView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    vobsApi.getAllAuditLogs().then(data => {
      setLogs(data);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoadError(err?.message || 'Could not load this data.');
      setLoading(false);
    });
  }, [reloadKey]);

  const filteredLogs = logs.filter(l =>
    filterAction === 'all' ? true : l.action === filterAction
  );

  return (
    <div className="audit-logs-view">
      <DataError message={loadError} onRetry={() => setReloadKey(k => k + 1)} />

      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>HIPAA Security & Audit Trail Logs (A7, SEC-6)</h3>
            <span className="panel-sub">Immutable, append-only log of every PHI alteration, verification submission, and export</span>
          </div>
          <div className="security-pill">
            Immutable Write-Only Storage
          </div>
        </div>

        {/* Filter bar */}
        <div className="filter-toolbar">
          <div className="filter-selects">
            <label htmlFor="auditFilter">Filter by Event:</label>
            <select
              id="auditFilter"
              className="select-input select-sm"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Audit Events</option>
              <option value="FIELD_UPDATE">Field Modifications</option>
              <option value="SUBMISSION">VOB Submissions & Routing</option>
              <option value="TRANSCRIPT_EXTRACTION">AI Transcript Extractions</option>
              <option value="BATCH_IMPORT">Batch Intake Imports</option>
              <option value="ASSIGNMENT">Staff Task Assignments</option>
            </select>
          </div>

          <span className="log-count-text">Showing {filteredLogs.length} audit records</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>User / Operator</th>
                <th>Action Type</th>
                <th>Target Record</th>
                <th>Field Name</th>
                <th>Prior Value</th>
                <th>Updated Value</th>
                <th>Audit Context / Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="table-empty">Loading audit trail…</td></tr>
              ) : loadError ? (
                <tr><td colSpan="8" className="table-empty">Could not load this data.</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="8" className="table-empty">No audit logs matching selection.</td></tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td className="mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td>
                      <span className="user-email-tag">{log.user}</span>
                    </td>
                    <td>
                      <span className="action-pill">{log.action}</span>
                    </td>
                    <td className="mono bold">{log.vobId}</td>
                    <td className="mono">{log.field || '—'}</td>
                    <td className="cell-old">{log.oldValue || '—'}</td>
                    <td className="cell-new">{log.newValue || '—'}</td>
                    <td className="text-sm">{log.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
