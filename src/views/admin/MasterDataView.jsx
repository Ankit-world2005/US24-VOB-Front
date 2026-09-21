import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { CLIENTS } from '../../data/clients';

export function MasterDataView() {
  const { showToast } = useWorkspace();
  const [selectedClient, setSelectedClient] = useState('sugarland');
  const [isUploading, setIsUploading] = useState(false);

  // Sample master data reference entries
  const masterRecords = [
    { patient: "Eleanor Vance", dob: "1984-04-12", carrier: "UHC Choice Plus", policyId: "UHC-992817263", group: "904128", payerId: "87726", lastUpdated: "2026-08-15" },
    { patient: "Marcus Thorne", dob: "1976-11-28", carrier: "BCBS Arizona HMO", policyId: "XZA90182736", group: "BC44192", payerId: "53205", lastUpdated: "2026-07-20" },
    { patient: "David O'Connor", dob: "1968-09-15", carrier: "Cigna Open Access", policyId: "U819203910", group: "009827", payerId: "62308", lastUpdated: "2026-08-30" },
    { patient: "Sarah Jenkins", dob: "1992-07-04", carrier: "Aetna POS II", policyId: "W182930412", group: "712893-01", payerId: "60054", lastUpdated: "2026-09-01" },
    { patient: "Albert Gomez", dob: "1971-02-14", carrier: "BCBS Texas Choice", policyId: "TXB908172635", group: "TX-19283", payerId: "84980", lastUpdated: "2026-08-10" }
  ];

  const handleUploadMaster = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      showToast(`Master data for ${CLIENTS.find(c => c.id === selectedClient)?.name} updated successfully (420 records indexed).`, "success");
    }, 900);
  };

  return (
    <div className="master-data-view">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Client Master Reference Data (FR-17, FR-18)</h3>
            <span className="panel-sub">Reference patient and insurance database used strictly for automatic assignment pre-filling</span>
          </div>
          <div className="client-badge-pill">
            Reference Data Isolated Per Client (SEC-4)
          </div>
        </div>

        <div className="master-upload-bar">
          <div className="field" style={{ minWidth: '240px' }}>
            <label>Select Client Organization</label>
            <select
              className="select-input"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {CLIENTS.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="upload-action-wrap">
            <button
              type="button"
              className="btn"
              onClick={handleUploadMaster}
              disabled={isUploading}
            >
              {isUploading ? 'Validating & Indexing…' : `+ Ingest Master Data for ${CLIENTS.find(c => c.id === selectedClient)?.name}`}
            </button>
          </div>
        </div>

        <div className="master-notice-card">
          <div className="notice-icon">🛡️</div>
          <div>
            <strong>Pre-Fill Isolation Rule (FR-18 & FR-19):</strong>
            <p>Master data is stored independently from active VOB records. It is queried strictly at the moment a VOB is assigned, filling only fields the patient's most recent VOB leaves empty. Master data never modifies completed or in-progress verifications.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>DOB</th>
                <th>Primary Insurance</th>
                <th>Member Policy ID</th>
                <th>Group #</th>
                <th>Payer ID</th>
                <th>Indexed Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {masterRecords.map((m, i) => (
                <tr key={i}>
                  <td className="bold">{m.patient}</td>
                  <td>{m.dob}</td>
                  <td>{m.carrier}</td>
                  <td className="mono">{m.policyId}</td>
                  <td className="mono">{m.group}</td>
                  <td className="mono">{m.payerId}</td>
                  <td>{m.lastUpdated}</td>
                  <td><span className="badge-valid">Active Reference</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
