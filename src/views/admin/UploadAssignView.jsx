import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadsApi } from '../../api/uploads';
import { CLIENTS } from '../../data/clients';

export function UploadAssignView() {
  const { showToast, setActiveTab } = useWorkspace();
  const [selectedClient, setSelectedClient] = useState('arra');
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('rohit.k@us24solutions.com');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleSimulatedFileUpload = async () => {
    setIsUploading(true);
    try {
      const res = await uploadsApi.uploadFile({ filename: `${selectedClient.toUpperCase()}_Daily_Requests.xlsx` }, selectedClient);
      const preview = await uploadsApi.getPreview(res.uploadId);
      setPreviewData(preview);
      showToast(`Parsed ${preview.totalRows} rows. ${preview.validRows} valid, ${preview.rejectedRows} rejected.`, "info");
    } catch (err) {
      showToast("Failed to parse task intake file", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommitAndAssign = async () => {
    if (!previewData) return;
    setIsCommitting(true);
    try {
      const commitRes = await uploadsApi.commitUpload(previewData.uploadId, "saurabh@us24solutions.com");
      const createdIds = commitRes.createdVobs.map(v => v.id);

      await uploadsApi.assignVobs({
        vobIds: createdIds,
        assignees: [selectedAssignee],
        adminEmail: "saurabh@us24solutions.com"
      });

      showToast(`Successfully created & assigned ${commitRes.count} VOBs to ${selectedAssignee}! Pre-fill completed.`, "success");
      setPreviewData(null);
      setActiveTab('records');
    } catch (err) {
      showToast("Error committing intake batch", "error");
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="upload-assign-view">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Upload & Assign Client VOB Requests (FR-3 & FR-4)</h3>
            <span className="panel-sub">Ingest intake spreadsheets, preview row validation, and allocate tasks with auto-prefill</span>
          </div>
        </div>

        {/* Upload Configuration Form */}
        <div className="upload-form-grid">
          <div className="field">
            <label>Target Healthcare Client</label>
            <select
              className="select-input"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              {CLIENTS.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.description})</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Default Specialist Assignee</label>
            <select
              className="select-input"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              <option value="rohit.k@us24solutions.com">Rohit K (Specialist · PT & Spine)</option>
              <option value="manish.v@us24solutions.com">Manish V (Specialist · Imaging & Consults)</option>
              <option value="jitender.s@us24solutions.com">Jitender S (Specialist · Wellness & Primary)</option>
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div className="dropzone-box" onClick={handleSimulatedFileUpload}>
          <div className="dropzone-icon">📥</div>
          <h4>Click to browse or drop {CLIENTS.find(c => c.id === selectedClient)?.name} request file</h4>
          <p>Supports .xlsx and .csv client tracker files. Automatically validates against client canonical mapping.</p>
          <button type="button" className="btn btn-sm" disabled={isUploading}>
            {isUploading ? 'Parsing file schema…' : 'Select Task File (Sample)'}
          </button>
        </div>

        {/* Pre-Import Validation Preview (FR-3) */}
        {previewData && (
          <div className="preview-results-wrap">
            <div className="preview-summary-bar">
              <div className="preview-stat">
                <span>Total Ingested:</span> <strong>{previewData.totalRows} rows</strong>
              </div>
              <div className="preview-stat green">
                <span>Valid (Accepted):</span> <strong>{previewData.validRows} rows</strong>
              </div>
              <div className="preview-stat red">
                <span>Malformed (Rejected):</span> <strong>{previewData.rejectedRows} row</strong>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row #</th>
                    <th>Patient Name</th>
                    <th>DOB</th>
                    <th>Date of Service</th>
                    <th>Insurance</th>
                    <th>Member ID</th>
                    <th>Validation Check</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map(r => (
                    <tr key={r.row} className={r.valid ? '' : 'row-rejected'}>
                      <td className="mono">{r.row}</td>
                      <td className="bold">{r.patientName}</td>
                      <td>{r.dob || <span className="red">Missing</span>}</td>
                      <td>{r.dos}</td>
                      <td>{r.insurance}</td>
                      <td>{r.idCard}</td>
                      <td>
                        {r.valid ? (
                          <span className="badge-valid">✓ Ready for Pre-fill</span>
                        ) : (
                          <span className="badge-rejected">✕ Rejected: {r.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="commit-action-bar">
              <div className="prefill-notice">
                <span>ℹ️ Pre-fill rule active:</span> Valid rows will be pre-populated from the patient's most recent VOB first, followed by reference master data.
              </div>
              <button
                type="button"
                className="btn"
                onClick={handleCommitAndAssign}
                disabled={isCommitting}
              >
                {isCommitting ? 'Committing & Pre-filling…' : `Commit & Assign ${previewData.validRows} VOBs to ${selectedAssignee.split('@')[0]}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
