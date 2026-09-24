import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadsApi } from '../../api/uploads';
import { CLIENTS } from '../../data/clients';
import { MOCK_USERS } from '../../DB';

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

  // Filter available specialists from user list
  const specialists = (MOCK_USERS || []).filter(u => u.role === 'user');

  // Convert Excel serial dates or Date objects to YYYY-MM-DD
  const formatFieldDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
    }
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split('/');
      const mm = parts[0].padStart(2, '0');
      const dd = parts[1].padStart(2, '0');
      return `${parts[2]}-${mm}-${dd}`;
    }
    return s;
  };

  // Parse raw sheet rows into normalized VOB intake rows
  const parseSheetRows = (rawRows, fileName) => {
    return rawRows.map((row, idx) => {
      const rowKeys = Object.keys(row);

      const findVal = (possibleKeys) => {
        // Direct match
        for (const k of possibleKeys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return row[k];
          }
        }
        // Case-insensitive and punctuation-agnostic match
        for (const p of possibleKeys) {
          const pClean = p.toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = rowKeys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === pClean);
          if (match && row[match] !== undefined && String(row[match]).trim() !== '') {
            return row[match];
          }
        }
        return '';
      };

      const patientName = String(findVal(['Patient Name', 'patient_name', 'Patient', 'Name', 'PATIENT NAME', 'PATIENT'])).trim();
      const dobRaw = findVal(['DOB', 'Date of Birth', 'dob', 'Birth Date', 'DOB (YYYY-MM-DD)']);
      const dob = formatFieldDate(dobRaw);
      const dosRaw = findVal(['DOS', 'Date of Service', 'dos', 'Initial DOS', 'Service Date']);
      const dos = formatFieldDate(dosRaw) || new Date().toISOString().split('T')[0];
      const appointmentType = String(findVal(['Appointment Type', 'Appt Type', 'Service Type', 'Visit Type']) || 'General Consult').trim();
      const insurance = String(findVal(['Insurance Carrier', 'Insurance Name', 'Insurance', 'Carrier', 'Payer']) || 'Commercial Payer').trim();
      const idCard = String(findVal(['Member Policy ID', 'Member ID', 'Policy ID', 'idCard', 'ID Card', 'Member ID / Policy #']) || `MEM-${Math.floor(100000 + Math.random() * 900000)}`).trim();
      const groupNo = String(findVal(['Group Number', 'Group No', 'Group ID', 'Group #', 'groupNo']) || 'GRP-AUTO').trim();
      const payerId = String(findVal(['Payer ID', 'payerId', 'Payer']) || '00020').trim();
      const insurancePhone = String(findVal(['Insurance Phone', 'Phone', 'Contact Number']) || '1-800-555-0199').trim();
      const copay = String(findVal(['PAT / Copay', 'PAT Expected', 'Copay', 'PAT', 'Co-pay']) || '$25.00 Copay').trim();
      const clientOrg = String(findVal(['Client Organization', 'Client', 'Target Client']) || selectedClient).trim();

      // Row validation checks (Patient Name & DOB required)
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
        row: idx + 1,
        patientName,
        dob,
        dos,
        appointmentType,
        insurance,
        idCard,
        groupNo,
        payerId,
        insurancePhone,
        copay,
        client: clientOrg,
        valid,
        reason
      };
    });
  };

  // Ingest and validate actual spreadsheet file
  const processRealFile = async (file) => {
    if (!file) return;
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('Unsupported format. Please upload an Excel (.xlsx, .xls) or CSV file.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('No worksheets found in file');

      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        showToast('The uploaded sheet contains no data rows.', 'warning');
        setIsUploading(false);
        return;
      }

      const parsedRows = parseSheetRows(rawRows, fileName);
      const totalRows = parsedRows.length;
      const validRows = parsedRows.filter(r => r.valid).length;
      const rejectedRows = parsedRows.filter(r => !r.valid).length;

      const payload = {
        filename: fileName,
        rows: parsedRows,
        totalRows,
        validRows,
        rejectedRows,
        assignedTo: selectedAssignee
      };

      const res = await uploadsApi.uploadFile(payload, selectedClient);
      const uploadId = res?.uploadId || `upl_${Date.now()}`;

      setUploadedFileName(fileName);
      setPreviewData({
        uploadId,
        ...payload
      });

      showToast(`Ingested ${totalRows} rows from "${fileName}". ${validRows} valid rows ready for assignment.`, 'success');
    } catch (err) {
      console.error('File parsing error:', err);
      showToast(`Failed to parse file: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Fallback demo sample loader if user does not have an Excel file on hand
  const handleLoadDemoFile = async () => {
    setIsUploading(true);
    try {
      const sampleRows = [
        { row: 1, patientName: "Arthur Dent", dob: "1978-05-11", dos: "2026-10-04", appointmentType: "Initial Evaluation - PT", insurance: "Blue Cross Blue Shield", idCard: "BCBS-91823719", groupNo: "GRP-77291", payerId: "00020", copay: "$25.00 Copay", valid: true },
        { row: 2, patientName: "Trillian Astra", dob: "1983-09-22", dos: "2026-10-05", appointmentType: "Physical Therapy", insurance: "Aetna Choice", idCard: "AET-9920194", groupNo: "AET-102", payerId: "60054", copay: "$30.00 Copay", valid: true },
        { row: 3, patientName: "Ford Prefect", dob: "", dos: "2026-10-06", appointmentType: "Initial Eval", insurance: "Cigna Open Access", idCard: "CIG-8821941", groupNo: "009827", payerId: "62308", copay: "$25.00 Copay", valid: false, reason: "Missing Date of Birth (DOB)" },
        { row: 4, patientName: "Zaphod Beeblebrox", dob: "1965-03-15", dos: "2026-10-07", appointmentType: "Specialist Spine", insurance: "UnitedHealthcare (UHC)", idCard: "UHC-992817263", groupNo: "904128", payerId: "87726", copay: "$20.00 Copay", valid: true },
        { row: 5, patientName: "Eleanor Vance", dob: "1984-04-12", dos: "2026-10-08", appointmentType: "Sports Rehabilitation", insurance: "UnitedHealthcare (UHC)", idCard: "UHC-55102938", groupNo: "904128", payerId: "87726", copay: "$25.00 Copay", valid: true }
      ];

      const demoFileName = `${selectedClient.toUpperCase()}_Daily_Requests.xlsx`;
      const payload = {
        filename: demoFileName,
        rows: sampleRows,
        totalRows: 5,
        validRows: 4,
        rejectedRows: 1,
        assignedTo: selectedAssignee
      };

      const res = await uploadsApi.uploadFile(payload, selectedClient);
      const uploadId = res?.uploadId || `upl_${Date.now()}`;

      setUploadedFileName(demoFileName);
      setPreviewData({
        uploadId,
        ...payload
      });

      showToast(`Loaded sample template with ${payload.validRows} valid requests.`, 'info');
    } catch (err) {
      showToast('Failed to load sample intake file', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommitAndAssign = async () => {
    if (!previewData) return;
    setIsCommitting(true);
    try {
      const commitRes = await uploadsApi.commitUpload(
        previewData.uploadId,
        currentUser.email,
        selectedAssignee
      );

      const createdIds = commitRes.createdVobs?.map(v => v.id) || [];

      if (createdIds.length > 0) {
        await uploadsApi.assignVobs({
          vobIds: createdIds,
          assignees: [selectedAssignee],
          adminEmail: currentUser.email
        });
      }

      const specialistName = selectedAssignee.split('@')[0];
      showToast(`Successfully created & assigned ${commitRes.count} VOBs to ${specialistName}! Records are now active in their queue.`, 'success');
      setPreviewData(null);
      setUploadedFileName('');
      setActiveTab('records');
    } catch (err) {
      console.error('Commit and assign error:', err);
      showToast('Error committing and assigning intake batch', 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processRealFile(file);
    }
  };

  return (
    <div className="upload-assign-view">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Upload & Assign Client VOB Requests (FR-3 & FR-4)</h3>
            <span className="panel-sub">Ingest intake spreadsheets, validate canonical columns, and allocate tasks directly to specialists</span>
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
            <label>Assign Directly To Specialist</label>
            <select
              className="select-input"
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              {specialists.map(u => (
                <option key={u.id} value={u.email}>
                  {u.name} ({u.email}) · Assigned: {u.assignedClients?.join(', ')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hidden Native File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx, .xls, .csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processRealFile(file);
            e.target.value = '';
          }}
        />

        {/* Drag and Drop Zone */}
        <div
          className={`dropzone-box ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="dropzone-icon">📥</div>
          <h4>
            {uploadedFileName
              ? `Loaded: ${uploadedFileName}`
              : `Click to browse or drop ${CLIENTS.find(c => c.id === selectedClient)?.name} request file`}
          </h4>
          <p>
            Supports .xlsx and .csv files (e.g. VOB_Requests_Intake_Batch.xlsx, ARRA_Daily_Requests.xlsx).
            Automatically validates Patient Name, DOB, Insurance, and DOS.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? 'Parsing Spreadsheet…' : '📁 Browse Computer (.xlsx / .csv)'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={isUploading}
              onClick={handleLoadDemoFile}
            >
              ⚡ Load Sample Template
            </button>
          </div>
        </div>

        {/* Pre-Import Validation Preview (FR-3) */}
        {previewData && (
          <div className="preview-results-wrap">
            <div className="preview-summary-bar">
              <div className="preview-stat">
                <span>File:</span> <strong>{previewData.filename}</strong>
              </div>
              <div className="preview-stat">
                <span>Total Ingested:</span> <strong>{previewData.totalRows} rows</strong>
              </div>
              <div className="preview-stat green">
                <span>Valid (Accepted):</span> <strong>{previewData.validRows} rows</strong>
              </div>
              <div className="preview-stat red">
                <span>Malformed (Rejected):</span> <strong>{previewData.rejectedRows} row{previewData.rejectedRows === 1 ? '' : 's'}</strong>
              </div>
              <div className="preview-stat" style={{ marginLeft: 'auto' }}>
                <span>Assignee:</span> <strong style={{ color: 'var(--navy)' }}>{selectedAssignee}</strong>
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
                      <td className="bold">{r.patientName || <span className="red">Missing</span>}</td>
                      <td>{r.dob || <span className="red">Missing</span>}</td>
                      <td>{r.dos}</td>
                      <td>{r.insurance}</td>
                      <td>{r.idCard}</td>
                      <td>
                        {r.valid ? (
                          <span className="badge-valid">✓ Ready to Assign</span>
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
                <span>ℹ️ Assignment Target:</span> All {previewData.validRows} valid VOB requests will be created and assigned immediately to <strong>{selectedAssignee}</strong>.
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCommitAndAssign}
                disabled={isCommitting || previewData.validRows === 0}
              >
                {isCommitting
                  ? 'Committing & Assigning…'
                  : `Commit & Assign ${previewData.validRows} VOBs to ${selectedAssignee.split('@')[0]}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
