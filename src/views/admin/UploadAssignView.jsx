import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useWorkspace } from '../../context/WorkspaceContext';
import { uploadsApi } from '../../api/uploads';
import { usersApi } from '../../api/users';
import { CLIENTS } from '../../data/clients';

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
  // Text dates in CSVs and pasted rows arrive as US M/D/YYYY; the API takes YYYY-MM-DD.
  const us = String(val).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return String(val).trim();
}

/** RFC 4122 v4. `crypto.randomUUID` exists only on https and localhost, not on a LAN address. */
function uuidv4() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// How the API names a rejected row's reason, in words for the admin.
const SERVER_REASONS = {
  missing_required: 'missing',
  unparseable_date: 'date not understood',
  assignee_invalid: 'assignee is not an active specialist'
};

// Headers and Project names are compared with everything but letters and digits
// stripped, so "D.O.B", "DOB (MM/DD/YYYY)" and "Patient's Name" all match.
const normalizeKey = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

// Patterns in priority order. `exclude` keeps a broad pattern such as `name` or
// `service` from claiming a neighbouring column ("Client Name", "Service Date").
const FIELDS = {
  patientName: {
    patterns: ['patientname', 'ptname', 'patient', 'membername', 'name'],
    exclude: ['patientid', 'client', 'project', 'provider', 'insurance', 'payer', 'carrier', 'plan', 'clinic', 'facility', 'specialist', 'assign', 'subscriber', 'employer', 'user', 'file']
  },
  dob: { patterns: ['dob', 'dateofbirth', 'birthdate', 'birthday', 'birth'], exclude: [] },
  dos: { patterns: ['dos', 'dateofservice', 'servicedate', 'apptdate', 'appointmentdate'], exclude: [] },
  // The Client Request sheet has no insurance column: its "PRIMARY / SECONDARY"
  // column holds the payer ("UHC", "MED/ AARP"), so it is the last resort here.
  insurance: {
    patterns: ['insurancename', 'insurancecarrier', 'insurance', 'payername', 'payer', 'carrier', 'inscompany', 'plan', 'primarysecondary'],
    exclude: ['phone', 'fax', 'address', 'payerid', 'insuranceid', 'policyid', 'memberid']
  },
  emrId: { patterns: ['emrid', 'emr', 'mrn', 'medicalrecordnumber'], exclude: [] },
  project: { patterns: ['project', 'projectname', 'client', 'clientname'], exclude: [] },
  vobStatus: { patterns: ['vobstatus', 'status'], exclude: ['coverage', 'network'] },
  idCard: {
    patterns: ['memberid', 'memberpolicyid', 'policyid', 'subscriberid', 'idcard', 'idnum', 'policynumber', 'membernumber', 'member'],
    exclude: ['name']
  },
  groupNo: { patterns: ['groupno', 'groupnumber', 'groupid', 'group', 'grp'], exclude: ['name'] },
  appointmentType: {
    patterns: ['appointmenttype', 'appttype', 'visittype', 'servicetype', 'service', 'requesttype'],
    exclude: ['date']
  },
  assignee: { patterns: ['assignee', 'assignedto', 'allocatedto', 'assignedspecialist', 'allocatedspecialist', 'allocated', 'specialist', 'staff', 'user'], exclude: [] }
};

// A header row names the patient plus at least one of these. The Client Request
// sheet has no DOB column; the per-client trackers have no EMR ID.
const HEADER_COMPANIONS = ['dob', 'dos', 'emrId', 'assignee'];

function findHeader(headers, field) {
  const { patterns, exclude } = FIELDS[field];
  const candidates = headers.filter((h) => {
    const key = normalizeKey(h);
    return key && !exclude.some((x) => key.includes(x));
  });
  for (const pat of patterns) {
    const hit = candidates.find((h) => normalizeKey(h) === pat) ||
      candidates.find((h) => normalizeKey(h).includes(pat));
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function getFieldValue(row, field) {
  const header = findHeader(Object.keys(row), field);
  const val = header === undefined ? '' : row[header];
  return val !== undefined && val !== null ? val : '';
}

const hasData = (cells) => cells.some((c) => String(c).trim() !== '');

// Short forms and misspellings the Client Request sheets use for a project,
// confirmed with ops. Anything else must match the client's id or name.
const PROJECT_ALIASES = {
  aara: 'arra',
  hrk: 'harikrishna_2',
  hek: 'harikrishna_2',
  namaste: 'namste'
};

/** "ARRA" is Arra and "Harikrishna" is "Harikrishna - 2"; other short forms come from PROJECT_ALIASES. */
const projectMatchesClient = (project, client) => {
  const p = normalizeKey(project);
  if (PROJECT_ALIASES[p]) return PROJECT_ALIASES[p] === client.id;
  return [client.id, client.name].map(normalizeKey).some((c) => c.startsWith(p) || p.startsWith(c));
};

/**
 * Rows of the first sheet that has a recognisable header row and data under it.
 * Intake sheets often carry a title or blank rows above the header, and a workbook
 * may hold header-only template sheets beside the one with data. Falls back to a
 * header-only sheet, then to the first sheet's first row, so the preview can still
 * show why nothing was imported.
 */
function readIntakeRows(workbook) {
  const HEADER_SCAN_ROWS = 15;
  // Blank rows are kept so an index maps back to the spreadsheet's own row number,
  // which is what the admin looks for when a row is rejected.
  const sheets = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    return {
      grid: XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true }),
      firstRow: ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r + 1 : 1
    };
  });

  const candidates = sheets
    .map(({ grid, firstRow }) => ({
      grid,
      firstRow,
      headerIdx: grid.slice(0, HEADER_SCAN_ROWS).findIndex((cells) => {
        const labels = cells.map(String);
        return findHeader(labels, 'patientName') !== undefined &&
          HEADER_COMPANIONS.some((field) => findHeader(labels, field) !== undefined);
      })
    }))
    .filter(({ headerIdx }) => headerIdx !== -1);

  const found =
    candidates.find(({ grid, headerIdx }) => grid.slice(headerIdx + 1).some(hasData)) ||
    candidates[0] ||
    { grid: sheets[0]?.grid || [], firstRow: sheets[0]?.firstRow || 1, headerIdx: 0 };

  const { grid, firstRow, headerIdx } = found;
  const seen = {};
  const headers = (grid[headerIdx] || []).map((cell, i) => {
    const base = String(cell).trim() || `Column ${i + 1}`;
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} (${seen[base]})` : base;
  });

  const body = grid
    .slice(headerIdx + 1)
    .map((cells, i) => ({ cells, rowNumber: firstRow + headerIdx + 1 + i }))
    .filter(({ cells }) => hasData(cells));

  return {
    headers,
    rows: body.map(({ cells }) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))),
    rowNumbers: body.map(({ rowNumber }) => rowNumber)
  };
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
  // A batch the server checked and found possible duplicates in, waiting for the
  // admin to skip or keep them. Any edit to the selection makes it stale.
  const [pendingBatch, setPendingBatch] = useState(null);

  const fileInputRef = useRef(null);

  const [specialists, setSpecialists] = useState([]);

  React.useEffect(() => {
    usersApi.getUsers().then(users => {
      const activeSpecialists = (users || [])
        .filter(u => u.role === 'user' && u.active !== false)
        .map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role
        }));
      setSpecialists(activeSpecialists);
    }).catch(err => {
      console.error('Failed to load specialists:', err);
    });
  }, []);

  const parseAndSetRows = async ({ headers, rows: rawRows, rowNumbers }, sourceName) => {
    if (!rawRows || rawRows.length === 0) {
      showToast("No data rows found to import.", "warning");
      return;
    }

    setPendingBatch(null);
    const initialAssignees = {};
    const validIndices = new Set();

    // DOB is required only when the file has a DOB column: the Client Request
    // sheet identifies the patient by EMR ID and leaves DOB to the specialist.
    const dobRequired = findHeader(headers, 'dob') !== undefined;
    const client = CLIENTS.find(c => c.id === selectedClient);

    const mappedRows = rawRows.map((r, index) => {
      const patientName = String(getFieldValue(r, 'patientName')).trim();
      const dob = formatDateValue(getFieldValue(r, 'dob'));
      const emrId = String(getFieldValue(r, 'emrId')).trim();
      const project = String(getFieldValue(r, 'project')).trim();
      const vobStatus = String(getFieldValue(r, 'vobStatus')).trim();
      // Blank stays blank. A made-up DOS, payer or member ID reads as real on a payer call.
      const dos = formatDateValue(getFieldValue(r, 'dos'));
      const insurance = String(getFieldValue(r, 'insurance')).trim();
      const idCard = String(getFieldValue(r, 'idCard')).trim();
      const groupNo = String(getFieldValue(r, 'groupNo')).trim();
      const appointmentType = String(getFieldValue(r, 'appointmentType')).trim();

      // Look for specific assignee in row, otherwise use default. An empty cell must
      // not reach the name match: every name includes ''.
      const rowAssignee = String(getFieldValue(r, 'assignee')).trim().toLowerCase();
      const matchedUser = rowAssignee && specialists.find(s =>
        s.email.toLowerCase() === rowAssignee ||
        s.name.toLowerCase().includes(rowAssignee)
      );
      const assignedTo = matchedUser ? matchedUser.email : defaultAssignee;

      initialAssignees[index] = assignedTo;

      // Every uploaded row is accepted and ready to be assigned to the user
      validIndices.add(index);

      return {
        row: rowNumbers[index],
        patientName: patientName || 'Unknown Patient',
        dob,
        dobRequired,
        emrId,
        dos,
        appointmentType,
        insurance,
        idCard,
        groupNo,
        assignedTo,
        valid: true,
        reason: ''
      };
    });

    // Every row is valid and selectable for assignment
    setPreviewData({
      totalRows: mappedRows.length,
      validRows: mappedRows.length,
      rejectedRows: 0,
      rows: mappedRows
    });
    setRowAssignees(initialAssignees);
    setSelectedRowIndices(validIndices);
    setUploadedFileName(sourceName);

    showToast(`Read ${mappedRows.length} rows. All rows ready to import and assign.`, "info");
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
    setPendingBatch(null);
    setRowAssignees(prev => ({
      ...prev,
      [rowIndex]: assigneeEmail
    }));
  };

  const handleBulkAssigneeChange = (assigneeEmail) => {
    setPendingBatch(null);
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
    setPendingBatch(null);
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
    setPendingBatch(null);
    if (selectedRowIndices.size === previewData.rows.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(previewData.rows.map((_, idx) => idx)));
    }
  };

  const handleCommitAndAssign = async () => {
    if (!previewData) return;

    // Every selected row is created and assigned to the chosen user
    const rowsToCommit = previewData.rows
      .map((r, idx) => ({ ...r, assignedTo: rowAssignees[idx] || defaultAssignee }))
      .filter((r, idx) => selectedRowIndices.has(idx));
    if (rowsToCommit.length === 0) return;

    // The API knows clients by UUID; /auth/me lists the ones this admin holds.
    const client = CLIENTS.find(c => c.id === selectedClient);
    const serverClient = (currentUser.accessibleClients || []).find(c =>
      c && typeof c === 'object' && client && normalizeKey(c.name) === normalizeKey(client.name)
    );

    setIsCommitting(true);
    try {
      const preview = await uploadsApi.uploadFile({
        client_id: serverClient?.id ?? selectedClient,
        kind: 'tasks',
        filename: uploadedFileName || 'Imported_Data.xlsx',
        rows: rowsToCommit.map(r => ({
          row: r.row,
          patient_name: r.patientName,
          dob: r.dob || null,
          dos: r.dos || null,
          emr_id: r.emrId || null,
          insurance: r.insurance || null,
          appointment_type: r.appointmentType || null,
          group_no: r.groupNo || null,
          member_id: r.idCard || null,
          assignee_email: r.assignedTo || null
        }))
      }, selectedClient);

      const batch = {
        id: preview.id,
        rejected: preview.rejected || [],
        duplicates: preview.duplicates || [],
        valid: preview.valid_rows ?? rowsToCommit.length
      };

      // Possible duplicates are the admin's call (FR-3): stop and ask.
      if (batch.duplicates.length > 0) {
        setPendingBatch(batch);
        showToast(
          `${batch.duplicates.length} row${batch.duplicates.length === 1 ? ' looks' : 's look'} like tasks already imported. Choose below whether to skip them.`,
          "warning"
        );
        return;
      }

      await finishImport(batch, false);
    } catch (err) {
      console.error(err);
      showToast(`Import failed: ${err.message || 'the intake batch could not be committed.'}`, "error");
    } finally {
      setIsCommitting(false);
    }
  };

  /** Commits a checked batch, leaving out its possible duplicates when `skipDuplicates`. */
  const finishImport = async (batch, skipDuplicates) => {
    const skipRows = skipDuplicates ? batch.duplicates.map(d => d.row) : [];
    const result = await uploadsApi.commitUpload(
      batch.id,
      { skipRows, idempotencyKey: uuidv4() },
      currentUser.email
    );
    setPendingBatch(null);

    const notes = [
      batch.rejected.length > 0 &&
        `Not imported: ${batch.rejected.map(r => `row ${r.row} (${r.field}: ${SERVER_REASONS[r.reason] || r.reason})`).join(', ')}.`,
      skipRows.length > 0 &&
        `Skipped as already imported: row${skipRows.length === 1 ? '' : 's'} ${skipRows.join(', ')}.`
    ].filter(Boolean).join(' ');

    if (result.created === 0) {
      showToast(`No VOB tasks created. ${notes}`, "warning");
      return;
    }

    showToast(`Created & assigned ${result.created} VOB tasks. ${notes}`.trim(), notes ? "warning" : "success");
    setPreviewData(null);
    setUploadedFileName('');
    setActiveTab('records');
  };

  const resolvePending = async (skipDuplicates) => {
    if (!pendingBatch) return;
    setIsCommitting(true);
    try {
      await finishImport(pendingBatch, skipDuplicates);
    } catch (err) {
      console.error(err);
      showToast(`Import failed: ${err.message || 'the intake batch could not be committed.'}`, "error");
    } finally {
      setIsCommitting(false);
    }
  };

  // Server verdicts by spreadsheet row, for the table.
  const duplicateByRow = new Map((pendingBatch?.duplicates || []).map(d => [d.row, d]));

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
              onChange={(e) => {
                setPendingBatch(null);
                setSelectedClient(e.target.value);
              }}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--ink-soft)', display: 'block' }}>Total Records</span>
                <strong style={{ fontSize: '18px', fontWeight: 700 }}>{previewData.totalRows} rows</strong>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', color: '#059669', display: 'block' }}>Ready to Assign</span>
                <strong style={{ fontSize: '18px', fontWeight: 700, color: '#059669' }}>{previewData.totalRows} rows</strong>
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
                        checked={previewData.rows.length > 0 && selectedRowIndices.size === previewData.rows.length}
                        onChange={toggleSelectAll}
                        title="Select / Unselect all rows"
                      />
                    </th>
                    <th style={{ padding: '10px 12px' }}>Row #</th>
                    <th style={{ padding: '10px 12px' }}>Patient Name</th>
                    <th style={{ padding: '10px 12px' }}>DOB</th>
                    <th style={{ padding: '10px 12px' }}>Date of Service</th>
                    <th style={{ padding: '10px 12px' }}>Insurance / Payer</th>
                    <th style={{ padding: '10px 12px' }}>Member ID</th>
                    <th style={{ padding: '10px 12px' }}>Assigned Specialist</th>
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
                          background: isSelected ? 'rgba(37, 99, 235, 0.03)' : undefined
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRowSelect(idx)}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', color: 'var(--ink-soft)' }}>#{r.row}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.patientName}</td>
                        <td style={{ padding: '10px 12px' }}>{r.dob || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                        <td style={{ padding: '10px 12px' }}>{r.dos || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                        <td style={{ padding: '10px 12px' }}>{r.insurance || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: '12px' }}>{r.idCard || <span style={{ color: 'var(--ink-soft)' }}>—</span>}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Commit & Assign Bottom Action Bar */}
            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface-2)', border: '1px solid var(--rule)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ flex: pendingBatch ? '1 1 100%' : '1 1 280px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: pendingBatch ? '#b45309' : 'var(--ink-soft)' }}>
                {pendingBatch ? (
                  <span>
                    <strong>{pendingBatch.duplicates.length} row{pendingBatch.duplicates.length === 1 ? '' : 's'}</strong> (
                    {pendingBatch.duplicates.map(d => `#${d.row}`).join(', ')}) look like tasks that already exist. Skip them, or import them anyway.
                  </span>
                ) : (
                  <span><strong>Selected rows</strong> are created as VOB tasks and assigned to the specialist chosen for each row.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setPendingBatch(null);
                    setPreviewData(null);
                    setUploadedFileName('');
                  }}
                  disabled={isCommitting}
                  style={{ width: 'auto', padding: '10px 18px' }}
                >
                  Clear & Cancel
                </button>
                {pendingBatch ? (
                  <>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => resolvePending(false)}
                      disabled={isCommitting}
                      style={{ width: 'auto', padding: '10px 18px' }}
                    >
                      Import all {pendingBatch.valid}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => resolvePending(true)}
                      disabled={isCommitting}
                      style={{ minWidth: '220px', width: 'auto' }}
                    >
                      {isCommitting ? 'Importing & Allocating Tasks…' : `Skip duplicates & import ${pendingBatch.valid - pendingBatch.duplicates.length}`}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleCommitAndAssign}
                    disabled={isCommitting || selectedRowIndices.size === 0}
                    style={{ minWidth: '220px', width: 'auto' }}
                  >
                    {isCommitting ? 'Importing & Allocating Tasks…' : `Import & Assign ${selectedRowIndices.size} VOB Tasks`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadAssignView;
