import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadsApi } from '../../api/uploads';
import { CLIENTS } from '../../data/clients';
import { MOCK_USERS } from '../../api/mock/mockUsersData';

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    try {
      const parsedDate = XLSX.SSF.parse_date_code(val);
      if (parsedDate) {
        const y = String(parsedDate.y).padStart(4, '0');
        const m = String(parsedDate.m).padStart(2, '0');
        const d = String(parsedDate.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch { }
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
  const [defaultAssignee, setDefaultAssignee] = useState('rohit.k@us24solutions.com');
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [rowAssignees, setRowAssignees] = useState({});
  const [selectedRowIndices, setSelectedRowIndices] = useState(new Set());
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualText, setManualText] = useState('');

  const fileInputRef = useRef(null);

  // Available specialists
  const specialists = MOCK_USERS.map(u => ({
    email: u.email,
    name: u.name,
    role: u.role
  }));

  const parseAndSetRows = async (rawRows, sourceName) => {
    if (!rawRows || rawRows.length === 0) {
      showToast("No data rows found to import.", "warning");
      return;
    }

    const initialAssignees = {};
    const validIndices = new Set();

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

      // Look for specific assignee in row, otherwise use default
      const rowAssignee = String(getFieldValue(r, ['assignee', 'assignedto', 'specialist', 'user', 'staff'])).trim();
      const matchedUser = specialists.find(s =>
        s.email.toLowerCase() === rowAssignee.toLowerCase() ||
        s.name.toLowerCase().includes(rowAssignee.toLowerCase())
      );
      const assignedTo = matchedUser ? matchedUser.email : defaultAssignee;

      initialAssignees[index] = assignedTo;

      let valid = true;
      let reason = '';
      if (!patientName) {
        valid = false;
        reason = 'Missing Patient Name';
      } else if (!dob) {
        valid = false;
        reason = 'Missing Date of Birth (DOB)';
      }

      if (valid) {
        validIndices.add(index);
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
        assignedTo,
        valid,
        reason
      };
    });

    const res = await uploadsApi.uploadFile({
      filename: sourceName,
      rows: mappedRows
    }, selectedClient);

    const preview = await uploadsApi.getPreview(res.uploadId);
    setPreviewData(preview);
    setRowAssignees(initialAssignees);
    setSelectedRowIndices(validIndices);
    setUploadedFileName(sourceName);
    showToast(`Imported ${preview.totalRows} records. ${preview.validRows} valid and ready for assignment.`, "info");
  };

  const processFile = async (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      showToast("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.", "error");
      return;
    }

    setIsUploading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("No sheets found in the spreadsheet.");
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      await parseAndSetRows(rawRows, file.name);
    } catch (err) {
      console.error("Error parsing file:", err);
      showToast(err.message || "Failed to parse intake spreadsheet.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualImport = async () => {
    if (!manualText.trim()) {
      showToast("Please paste CSV or tab-separated data into the box.", "warning");
      return;
    }

    setIsUploading(true);
    try {
      // Parse CSV or TSV text
      const workbook = XLSX.read(manualText, { type: 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      await parseAndSetRows(rawRows, 'Manual_Data_Import.csv');
      setShowManualPaste(false);
      setManualText('');
    } catch (err) {
      console.error("Manual parse error:", err);
      showToast("Failed to parse input data. Ensure headers are present.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['Patient Name', 'DOB', 'Date of Service', 'Insurance', 'Member ID', 'Group #', 'Appointment Type', 'Assignee Email'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `US24_VOB_Intake_Template_${selectedClient.toUpperCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Downloaded intake template (.csv)", "info");
  };

  const handleRowAssigneeChange = (rowIndex, assigneeEmail) => {
    setRowAssignees(prev => ({
      ...prev,
      [rowIndex]: assigneeEmail
    }));
  };

  const handleBulkAssigneeChange = (assigneeEmail) => {
    setDefaultAssignee(assigneeEmail);
    if (previewData && previewData.rows) {
      const updated = {};
      previewData.rows.forEach((_, idx) => {
        updated[idx] = assigneeEmail;
      });
      setRowAssignees(updated);
    }
  };

  const toggleRowSelect = (index) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!previewData) return;
    if (selectedRowIndices.size === previewData.validRows) {
      setSelectedRowIndices(new Set());
    } else {
      const allValid = new Set();
      previewData.rows.forEach((r, idx) => {
        if (r.valid) allValid.add(idx);
      });
      setSelectedRowIndices(allValid);
    }
  };

  const handleCommitAndAssign = async () => {
    if (!previewData) return;
    setIsCommitting(true);
    try {
      // Attach selected row-level assignees
      const rowsWithAssignees = previewData.rows.map((r, idx) => ({
        ...r,
        assignedTo: rowAssignees[idx] || defaultAssignee
      }));

      // Update upload batch with assigned users
      await uploadsApi.uploadFile({
        filename: uploadedFileName || 'Imported_Data.xlsx',
        rows: rowsWithAssignees
      }, selectedClient);

      const commitRes = await uploadsApi.commitUpload(previewData.uploadId, currentUser.email);
      const createdVobs = commitRes.createdVobs || [];

      // Build assignment mapping for created VOBs
      const assignmentMap = {};
      createdVobs.forEach((v, idx) => {
        assignmentMap[v.id] = rowAssignees[idx] || defaultAssignee;
      });

      if (createdVobs.length > 0) {
        await uploadsApi.assignVobs({
          vobIds: createdVobs.map(v => v.id),
          assignees: [defaultAssignee],
          assignmentMap
        }, currentUser.email);
      }

      showToast(`Successfully created & assigned ${createdVobs.length} VOB tasks! Navigating to Global Tracker...`, "success");
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
        {/* Panel Header */}
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Import Data & Assign VOB Tasks</h3>
            <span className="panel-sub" style={{ display: 'block', marginTop: '4px', color: 'var(--ink-soft)' }}>
              Import intake spreadsheets (.xlsx, .csv) to auto-generate patient VOB requests and allocate tasks directly to specialists.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={downloadTemplate}
              title="Download blank CSV intake template"
            >
              📄 Download Intake Template (.csv)
            </button>
            <button
              type="button"
              className="btn btn-sm ghost"
              onClick={() => setShowManualPaste(!showManualPaste)}
            >
              {showManualPaste ? '✕ Hide Manual Input' : '📋 Quick Paste Input'}
            </button>
          </div>
        </div>

        {/* Global Configuration Controls */}
        <div className="upload-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="field">
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Target Healthcare Client Organization</label>
            <select
              className="select-input"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              {CLIENTS.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.description}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px' }}>Default Specialist Assignee</label>
            <select
              className="select-input"
              value={defaultAssignee}
              onChange={(e) => handleBulkAssigneeChange(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              {specialists.map(s => (
                <option key={s.email} value={s.email}>
                  {s.name} ({s.email}) · {s.role.toUpperCase()}
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

        {/* Manual Paste Drawer */}
        {showManualPaste && (
          <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '8px', border: '1px solid var(--rule)', background: 'var(--surface-2)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Paste Tabular or CSV Intake Data</h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
              Copy rows from Excel or a text file and paste them directly below (Header row included):
            </p>
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Patient Name, DOB, Date of Service, Insurance, Member ID&#10;Alice Smith, 1985-05-12, 2026-09-25, Blue Cross, BC12345&#10;David Jones, 1990-10-21, 2026-09-26, Aetna, AET9981"
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--rule)', fontFamily: 'var(--mono)', fontSize: '12px', background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-sm ghost" onClick={() => setShowManualPaste(false)}>Cancel</button>
              <button type="button" className="btn btn-sm" onClick={handleManualImport} disabled={isUploading}>
                {isUploading ? 'Parsing…' : 'Parse & Preview Pasted Data'}
              </button>
            </div>
          </div>
        )}

        {/* Hidden Native File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx, .xls, .csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
          }}
          style={{ display: 'none' }}
        />

        {/* Drag & Drop Import Box */}
        <div
          className={`dropzone-box ${isDragging ? 'drag-active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) processFile(f);
          }}
          style={{
            border: isDragging ? '2px dashed var(--cobalt)' : '2px dashed var(--rule)',
            borderRadius: '10px',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: isDragging ? 'var(--focus)' : 'var(--surface-2)',
            transition: 'all 0.2s ease',
            marginBottom: '24px'
          }}
        >
          <div style={{ fontSize: '38px', marginBottom: '12px' }}>📂</div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600 }}>
            {uploadedFileName ? `Active File: ${uploadedFileName}` : `Import Intake Spreadsheet for ${clientName}`}
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--ink-soft)' }}>
            Drag and drop your <strong>.xlsx</strong> or <strong>.csv</strong> file here, or click the button below to browse.
          </p>
          <button
            type="button"
            className="btn"
            disabled={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
          >
            {isUploading ? 'Parsing spreadsheet rows…' : (uploadedFileName ? '↻ Choose Another Spreadsheet' : '📥 Import Data File (.xlsx, .csv)')}
          </button>
        </div>

        {/* Validation & Assignment Preview */}
        {previewData && (
          <div className="preview-results-wrap" style={{ marginTop: '24px' }}>
            {/* KPI Summary Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)', display: 'block' }}>Total Records</span>
                <strong style={{ fontSize: '18px', fontWeight: 700 }}>{previewData.totalRows} rows</strong>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: '#059669', display: 'block' }}>Valid (Ready to Assign)</span>
                <strong style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>{previewData.validRows} rows</strong>
              </div>
              <div style={{ padding: '12px 16px', background: previewData.rejectedRows > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: previewData.rejectedRows > 0 ? '#dc2626' : 'var(--ink-soft)', display: 'block' }}>Incomplete (Rejected)</span>
                <strong style={{ fontSize: '18px', fontWeight: 700, color: previewData.rejectedRows > 0 ? '#dc2626' : 'var(--ink-soft)' }}>
                  {previewData.rejectedRows} {previewData.rejectedRows === 1 ? 'row' : 'rows'}
                </strong>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)', display: 'block' }}>Selected for Assignment</span>
                <strong style={{ fontSize: '18px', fontWeight: 700, color: 'var(--cobalt)' }}>{selectedRowIndices.size} rows</strong>
              </div>
            </div>

            {/* Interactive Records Table */}
            <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: '8px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--rule)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={previewData.validRows > 0 && selectedRowIndices.size === previewData.validRows}
                        onChange={toggleSelectAll}
                        title="Select / Unselect all valid rows"
                      />
                    </th>
                    <th style={{ padding: '10px 12px' }}>Row #</th>
                    <th style={{ padding: '10px 12px' }}>Patient Name</th>
                    <th style={{ padding: '10px 12px' }}>DOB</th>
                    <th style={{ padding: '10px 12px' }}>Date of Service</th>
                    <th style={{ padding: '10px 12px' }}>Insurance / Payer</th>
                    <th style={{ padding: '10px 12px' }}>Member ID</th>
                    <th style={{ padding: '10px 12px' }}>Assigned Specialist</th>
                    <th style={{ padding: '10px 12px' }}>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((r, idx) => {
                    const isSelected = selectedRowIndices.has(idx);
                    const currentAssignee = rowAssignees[idx] || defaultAssignee;

                    return (
                      <tr
                        key={r.row}
                        style={{
                          borderBottom: '1px solid var(--rule-soft)',
                          background: !r.valid ? 'rgba(239, 68, 68, 0.04)' : (isSelected ? 'rgba(37, 99, 235, 0.03)' : undefined)
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            disabled={!r.valid}
                            checked={isSelected}
                            onChange={() => toggleRowSelect(idx)}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>#{r.row}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.patientName}</td>
                        <td style={{ padding: '10px 12px' }}>{r.dob || <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Missing</span>}</td>
                        <td style={{ padding: '10px 12px' }}>{r.dos}</td>
                        <td style={{ padding: '10px 12px' }}>{r.insurance}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: '12px' }}>{r.idCard}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
                            disabled={!r.valid}
                            value={currentAssignee}
                            onChange={(e) => handleRowAssigneeChange(idx, e.target.value)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--rule)',
                              background: 'var(--surface)',
                              fontSize: '12px',
                              color: 'var(--ink)'
                            }}
                          >
                            {specialists.map(s => (
                              <option key={s.email} value={s.email}>{s.name} ({s.role})</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.valid ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', fontSize: '11.5px', fontWeight: 600 }}>
                              ✓ Ready
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontSize: '11.5px', fontWeight: 600 }}>
                              ✕ {r.reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Commit & Assign Bottom Action Bar */}
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink-soft)' }}>
                <span>✨ <strong>Auto Pre-Fill:</strong> Valid records will automatically be matched with patient history and client master reference data.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setPreviewData(null);
                    setUploadedFileName('');
                  }}
                  disabled={isCommitting}
                >
                  Clear & Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCommitAndAssign}
                  disabled={isCommitting || selectedRowIndices.size === 0}
                  style={{ minWidth: '220px' }}
                >
                  {isCommitting ? 'Importing & Allocating Tasks…' : `Import & Assign ${selectedRowIndices.size} VOB Tasks`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadAssignView;
