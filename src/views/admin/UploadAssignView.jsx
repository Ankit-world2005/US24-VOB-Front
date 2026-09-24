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
    // Local parts, not toISOString(): east of UTC a local midnight is the previous day in UTC.
    const y = String(val.getFullYear()).padStart(4, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

// Headers are compared with everything but letters and digits stripped, so
// "D.O.B", "DOB (MM/DD/YYYY)" and "Patient's Name" all match.
const normalizeHeader = (header) => String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

// Patterns in priority order. `exclude` keeps a broad pattern such as `name` or
// `service` from claiming a neighbouring column ("Client Name", "Service Date").
const FIELDS = {
  patientName: {
    patterns: ['patientname', 'ptname', 'patient', 'membername', 'name'],
    exclude: ['patientid', 'client', 'provider', 'insurance', 'payer', 'carrier', 'plan', 'clinic', 'facility', 'specialist', 'assign', 'subscriber', 'employer', 'user', 'file']
  },
  dob: { patterns: ['dob', 'dateofbirth', 'birthdate', 'birthday', 'birth'], exclude: [] },
  dos: { patterns: ['dos', 'dateofservice', 'servicedate', 'apptdate', 'appointmentdate'], exclude: [] },
  insurance: {
    patterns: ['insurancename', 'insurancecarrier', 'insurance', 'payername', 'payer', 'carrier', 'inscompany', 'plan'],
    exclude: ['phone', 'fax', 'address', 'payerid', 'insuranceid', 'policyid', 'memberid']
  },
  idCard: {
    patterns: ['memberid', 'memberpolicyid', 'policyid', 'subscriberid', 'idcard', 'idnum', 'policynumber', 'membernumber', 'member'],
    exclude: ['name']
  },
  groupNo: { patterns: ['groupno', 'groupnumber', 'groupid', 'group', 'grp'], exclude: ['name'] },
  appointmentType: {
    patterns: ['appointmenttype', 'appttype', 'visittype', 'servicetype', 'service', 'requesttype'],
    exclude: ['date']
  },
  assignee: { patterns: ['assignee', 'assignedto', 'assignedspecialist', 'allocatedspecialist', 'specialist', 'staff', 'user'], exclude: [] }
};

function findHeader(headers, field) {
  const { patterns, exclude } = FIELDS[field];
  const candidates = headers.filter((h) => {
    const key = normalizeHeader(h);
    return key && !exclude.some((x) => key.includes(x));
  });
  for (const pat of patterns) {
    const hit = candidates.find((h) => normalizeHeader(h) === pat) ||
      candidates.find((h) => normalizeHeader(h).includes(pat));
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function getFieldValue(row, field) {
  const header = findHeader(Object.keys(row), field);
  const val = header === undefined ? '' : row[header];
  return val !== undefined && val !== null ? val : '';
}

/**
 * Rows of the first sheet whose header row names both a patient and a DOB column.
 * Intake sheets often carry a title or blank rows above the header, and some keep
 * the data on a later sheet. Falls back to the first sheet's first row as header,
 * so the preview can still show why its rows are rejected.
 */
function readIntakeRows(workbook) {
  const HEADER_SCAN_ROWS = 15;
  const sheets = workbook.SheetNames.map((name) =>
    XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: false })
  );

  let found = null;
  for (const grid of sheets) {
    const headerIdx = grid.slice(0, HEADER_SCAN_ROWS).findIndex((cells) => {
      const labels = cells.map(String);
      return findHeader(labels, 'patientName') !== undefined && findHeader(labels, 'dob') !== undefined;
    });
    if (headerIdx !== -1) {
      found = { grid, headerIdx };
      break;
    }
  }
  if (!found) found = { grid: sheets[0] || [], headerIdx: 0 };

  const { grid, headerIdx } = found;
  const seen = {};
  const headers = (grid[headerIdx] || []).map((cell, i) => {
    const base = String(cell).trim() || `Column ${i + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} (${seen[base]})` : base;
  });

  const rows = grid
    .slice(headerIdx + 1)
    .filter((cells) => cells.some((c) => String(c).trim() !== ''))
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));

  return { headers, rows };
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

  const parseAndSetRows = async ({ headers, rows: rawRows }, sourceName) => {
    if (!rawRows || rawRows.length === 0) {
      showToast("No data rows found to import.", "warning");
      return;
    }

    const initialAssignees = {};
    const validIndices = new Set();

    const mappedRows = rawRows.map((r, index) => {
      const patientName = String(getFieldValue(r, 'patientName')).trim();
      const dob = formatDateValue(getFieldValue(r, 'dob'));
      const dos = formatDateValue(getFieldValue(r, 'dos')) || formatDateValue(new Date());
      const insurance = String(getFieldValue(r, 'insurance')).trim() || 'General Healthcare';
      const idCard = String(getFieldValue(r, 'idCard')).trim() || `ID-${Math.floor(1000 + Math.random() * 9000)}`;
      const groupNo = String(getFieldValue(r, 'groupNo')).trim() || 'GRP-AUTO';
      const appointmentType = String(getFieldValue(r, 'appointmentType')).trim() || 'Physical Therapy';

      // Look for specific assignee in row, otherwise use default. An empty cell must
      // not reach the name match: every name includes ''.
      const rowAssignee = String(getFieldValue(r, 'assignee')).trim().toLowerCase();
      const matchedUser = rowAssignee && specialists.find(s =>
        s.email.toLowerCase() === rowAssignee ||
        s.name.toLowerCase().includes(rowAssignee)
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

    if (validIndices.size === 0) {
      const reasonCounts = mappedRows.reduce((acc, r) => {
        acc[r.reason] = (acc[r.reason] || 0) + 1;
        return acc;
      }, {});
      const reasons = Object.entries(reasonCounts).map(([reason, n]) => `${n} × ${reason}`).join(', ');
      const columns = headers.filter(Boolean).slice(0, 10).join(', ');
      showToast(
        `0 of ${mappedRows.length} rows can be imported (${reasons}). Columns found: ${columns}. ` +
        `Each row needs a patient name and a DOB column, e.g. "Patient Name" and "DOB".`,
        "warning"
      );
      return;
    }

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

      await parseAndSetRows(readIntakeRows(workbook), file.name);
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

      await parseAndSetRows(readIntakeRows(workbook), 'Manual_Data_Import.csv');
      setShowManualPaste(false);
      setManualText('');
    } catch (err) {
      console.error("Manual parse error:", err);
      showToast("Failed to parse input data. Ensure headers are present.", "error");
    } finally {
      setIsUploading(false);
    }
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

    // Only the ticked rows, each carrying the assignee chosen for it. Filtering
    // before the upload keeps rows and created VOBs in step, and the commit copies
    // each row's assignedTo onto its VOB, so no separate assignment call is needed.
    const rowsToCommit = previewData.rows
      .map((r, idx) => ({ ...r, assignedTo: rowAssignees[idx] || defaultAssignee }))
      .filter((r, idx) => r.valid && selectedRowIndices.has(idx));
    if (rowsToCommit.length === 0) return;

    setIsCommitting(true);
    try {
      const batch = await uploadsApi.uploadFile({
        filename: uploadedFileName || 'Imported_Data.xlsx',
        rows: rowsToCommit
      }, selectedClient);

      const commitRes = await uploadsApi.commitUpload(batch.uploadId, currentUser.email);
      const createdVobs = commitRes.createdVobs || [];

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
            // Reset so choosing the same file again still fires onChange.
            e.target.value = '';
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
                <span><strong>Selected rows</strong> are created as VOB tasks and assigned to the specialist chosen for each row.</span>
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
