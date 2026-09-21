import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { vobsApi } from '../../api/vobs';
import { clientsApi } from '../../api/clients';
import { StatusBadge } from '../../components/vob/StatusBadge';
import { ClientBadge } from '../../components/vob/ClientBadge';
import { RecordDetailModal } from '../../components/vob/RecordDetailModal';
import { CLIENTS } from '../../data/clients';

export function GlobalRecordsView() {
  const { selectedClient, setSelectedClient, showToast } = useWorkspace();
  const [vobs, setVobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [inspectVobId, setInspectVobId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    vobsApi.getVobs({
      clientId: selectedClient,
      status: statusFilter,
      search: searchQuery
    }).then(res => {
      setVobs(res);
      setLoading(false);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedClient, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await clientsApi.exportClientVobs(selectedClient);
      showToast(`Export generated: ${res.filename} (${res.exportedRows} records). Logged in audit trail.`, "success");
    } catch (err) {
      showToast("Export failed", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="global-records-view">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>All Client VOB Records (FR-12 & FR-16)</h3>
            <span className="panel-sub">Complete cross-client tracker view with HIPAA role isolation</span>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting…' : '📥 Export Client Tracker (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <input
              type="text"
              className="search-input"
              placeholder="Search patient, insurance, or member ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-sm">Search</button>
          </form>

          <div className="filter-selects">
            <select
              className="select-input select-sm"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="all">All Clients (8)</option>
              {CLIENTS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className="select-input select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Auth Queue">Auth Queue</option>
              <option value="Error">Error</option>
              <option value="Approved">Saved Records (Approved)</option>
            </select>
          </div>
        </div>

        {/* Records Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client</th>
                <th>Patient Name</th>
                <th>Date of Service</th>
                <th>Insurance Carrier & Plan</th>
                <th>Member Policy ID</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="table-empty">Loading records…</td></tr>
              ) : vobs.length === 0 ? (
                <tr><td colSpan="9" className="table-empty">No records matching the selected filters.</td></tr>
              ) : (
                vobs.map(v => (
                  <tr key={v.id} className="interactive-row" onClick={() => setInspectVobId(v.id)}>
                    <td className="mono">{v.id}</td>
                    <td><ClientBadge clientId={v.client} /></td>
                    <td>
                      <div className="bold">{v.patientName}</div>
                      <div className="patient-sub-cell">DOB: {v.dob}</div>
                    </td>
                    <td>{v.dos}</td>
                    <td>
                      <div>{v.insurance}</div>
                      <div className="patient-sub-cell">{v.planTypeAndName}</div>
                    </td>
                    <td className="mono">{v.idCard}</td>
                    <td><StatusBadge status={v.vobStatus} /></td>
                    <td><span className="assignee-tag">{v.assignedTo?.split('@')[0]}</span></td>
                    <td>
                      <button
                        type="button"
                        className="table-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectVobId(v.id);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecordDetailModal
        vobId={inspectVobId}
        isOpen={Boolean(inspectVobId)}
        onClose={() => setInspectVobId(null)}
      />
    </div>
  );
}
