import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadsApi } from '../../api/uploads';
import { CLIENTS } from '../../data/clients';

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    // Excel date serial number
    try {
      const parsedDate = XLSX.SSF.parse_date_code(val);
      if (parsedDate) {
        const y = String(parsedDate.y).padStart(4, '0');
        const m = String(parsedDate.m).padStart(2, '0');
        const d = String(parsedDate.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }
  return String(val).trim();
}

function getFieldValue(row, patterns) {
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_\-#]+/g, '');
    for (const pat of patterns) {
      if (cleanKey.includes(pat)) {
        return val !== undefined && val !== null ? val : '';
      }
    }
  }
  return '';
}

export function UploadAssignView() {
  const { showToast, setActiveTab, currentUser } = useWorkspace();
  const [selectedClient, setSelectedClient] = useState('arra');
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('rohit.k@us24solutions.com');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef(null);

  const processFile = async (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      showToast("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.", "error");
      return;
    }

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("No sheets found in the spreadsheet.");
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        showToast("The selected spreadsheet contains no data rows.", "warning");
        setIsUploading(false);
        return;
      }

      // Map and validate rows against healthcare intake canonical requirements
      const mappedRows = rawRows.map((r, index) => {
        const patientName = String(getFieldValue(r, ['patientname', 'patient', 'name', 'ptname', 'clientname'])).trim();
        const rawDob = getFieldValue(r, ['dob', 'dateofbirth', 'birthdate', 'birth']);
        const dob = formatDateValue(rawDob);
        const rawDos = getFieldValue(r, ['dos', 'dateofservice', 'servicedate', 'apptdate', 'appointmentdate']);
        const dos = formatDateValue(rawDos) || new Date().toISOString().split('T')[0];
        const insurance = String(getFieldValue(r, ['insurance', 'payer', 'carrier', 'inscompany', 'plan'])).trim() || 'General Healthcare';
        const idCard = String(getFieldValue(r, ['memberid', 'idcard', 'policyid', 'subscriberid', 'idnum', 'member'])).trim() || `ID-${Math.floor(1000 + Math.random() * 9000)}`;
        const groupNo = String(getFieldValue(r, ['groupno', 'groupnumber', 'groupid', 'group', 'grp'])).trim() || 'GRP-AUTO';
        const appointmentType = String(getFieldValue(r, ['appointmenttype', 'appttype', 'visittype', 'servicetype', 'service', 'requesttype'])).trim() || 'Physical Therapy';

        let valid = true;
        let reason = '';
        if (!patientName) {
          valid = false;
          reason = 'Missing Patient Name';
        } else if (!dob) {
          valid = false;
          reason = 'Missing Date of Birth (DOB)';
        }

        return {
          row: index + 1,
          patientName: patientName || 'Unknown Patient',
          dob,
          dos,
          appointmentType,
          insurance,
          idCard,
          groupNo,
          valid,
          reason
        };
      });

      const res = await uploadsApi.uploadFile({
        filename: file.name,
        rows: mappedRows
      }, selectedClient);

      const preview = await uploadsApi.getPreview(res.uploadId);
      setPreviewData(preview);
      showToast(`Parsed ${preview.totalRows} rows from ${file.name}. ${preview.validRows} valid, ${preview.rejectedRows} rejected.`, "info");
    } catch (err) {
      console.error("Error parsing file:", err);
      showToast(err.message || "Failed to parse intake spreadsheet.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCommitAndAssign = async () => {
    if (!previewData) return;
    setIsCommitting(true);
    try {
      const commitRes = await uploadsApi.commitUpload(previewData.uploadId, currentUser.email);
      const createdIds = (commitRes.createdVobs || []).map(v => v.id);

      if (createdIds.length > 0) {
        await uploadsApi.assignVobs({
          vobIds: createdIds,
          assignees: [selectedAssignee],
          adminEmail: currentUser.email
        });
      }

      showToast(`Successfully created & assigned ${commitRes.count} VOBs to ${selectedAssignee}! Pre-fill completed.`, "success");
      setPreviewData(null);
      setUploadedFileName('');
      setActiveTab('records');
    } catch (err) {
      console.error(err);
      showToast("Error committing intake batch", "error");
    } finally {
      setIsCommitting(false);
    }
  };

  const clientName = CLIENTS.find(c => c.id === selectedClient)?.name || 'Client';

  return (
    <div className="upload-assign-view">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Upload & Assign Client VOB Requests (FR-3 & FR-4)</h3>
            <span className="panel-sub">Ingest intake spreadsheets (.xlsx, .csv), preview row validation, and allocate tasks with auto-prefill</span>
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

        {/* Hidden native file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx, .xls, .csv"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Real Drag and Drop Zone */}
        <div
          className={`dropzone-box ${isDragging ? 'drag-active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed #2563eb' : undefined,
            backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : undefined
          }}
        >
          <div className="dropzone-icon">📥</div>
          <h4>Click to browse or drop {clientName} request file</h4>
          <p>Supports real .xlsx and .csv client tracker files. Automatically validates against client canonical mapping.</p>
          <button
            type="button"
            className="btn btn-sm"
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            {isUploading ? 'Parsing file schema…' : (uploadedFileName ? `Change File (${uploadedFileName})` : 'Choose Spreadsheet File')}
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
                <span>Malformed (Rejected):</span> <strong>{previewData.rejectedRows} {previewData.rejectedRows === 1 ? 'row' : 'rows'}</strong>
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
                disabled={isCommitting || previewData.validRows === 0}
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
