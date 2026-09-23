import { INITIAL_MOCK_VOBS } from './mockVobsData';
import { MOCK_USERS } from './mockUsersData';
import { MOCK_AUDIT_LOGS } from './mockAuditData';
import { CLIENTS, CANONICAL_FIELDS } from '../../data/clients';

// In-memory state for mock backend
let vobsState = JSON.parse(JSON.stringify(INITIAL_MOCK_VOBS));
let usersState = JSON.parse(JSON.stringify(MOCK_USERS));
let auditState = JSON.parse(JSON.stringify(MOCK_AUDIT_LOGS));
let uploadsState = {};
let jobsState = {};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export const mockServer = {
  // GET /me
  async getMe(email = "saurabh@us24solutions.com") {
    await sleep(80);
    const user = usersState.find(u => u.email.toLowerCase() === email.toLowerCase()) || usersState[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accessibleClients: user.role === "admin" ? CLIENTS.map(c => c.id) : user.assignedClients
    };
  },

  // POST /auth/logout
  async logout() {
    await sleep(60);
    return { success: true };
  },

  // GET /dashboard/summary?client=&user=&date=
  async getDashboardSummary({ clientId, userEmail } = {}) {
    await sleep(100);
    let filtered = vobsState;
    if (clientId && clientId !== "all") {
      filtered = filtered.filter(v => v.client === clientId);
    }
    if (userEmail) {
      filtered = filtered.filter(v => v.assignedTo?.toLowerCase() === userEmail.toLowerCase());
    }

    return {
      total: filtered.length,
      pending: filtered.filter(v => v.vobStatus === "Assigned" || v.vobStatus === "In Progress").length,
      authQueue: filtered.filter(v => v.vobStatus === "Auth Queue").length,
      error: filtered.filter(v => v.vobStatus === "Error").length,
      approved: filtered.filter(v => v.vobStatus === "Approved").length
    };
  },

  // GET /vobs?client=&status=&user=&search=
  async getVobs({ clientId, status, userEmail, search } = {}) {
    await sleep(120);
    let list = [...vobsState];

    if (clientId && clientId !== "all") {
      list = list.filter(v => v.client === clientId);
    }
    if (status && status !== "all") {
      list = list.filter(v => v.vobStatus.toLowerCase() === status.toLowerCase());
    }
    if (userEmail) {
      list = list.filter(v => v.assignedTo?.toLowerCase() === userEmail.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.patientName.toLowerCase().includes(q) ||
        v.insurance.toLowerCase().includes(q) ||
        v.idCard.toLowerCase().includes(q)
      );
    }

    return list;
  },

  // GET /vobs/:id
  async getVobById(id) {
    await sleep(100);
    const vob = vobsState.find(v => v.id === id);
    if (!vob) throw new Error(`VOB with id ${id} not found`);
    return JSON.parse(JSON.stringify(vob));
  },

  // PATCH /vobs/:id
  async patchVob(id, edits, expectedVersion, editorEmail = "rohit.k@us24solutions.com") {
    await sleep(150);
    const idx = vobsState.findIndex(v => v.id === id);
    if (idx === -1) throw new Error("VOB not found");

    const current = vobsState[idx];
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      const err = new Error("409 Conflict: This record was modified by another user. Reloading latest.");
      err.status = 409;
      throw err;
    }

    // Record audit entries for changed fields
    for (const [key, val] of Object.entries(edits)) {
      if (current[key] !== val && key !== 'provenance' && key !== 'extended') {
        auditState.unshift({
          id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          vobId: id,
          timestamp: new Date().toISOString(),
          user: editorEmail,
          role: "user",
          action: "FIELD_UPDATE",
          client: current.client,
          field: key,
          oldValue: String(current[key] || ""),
          newValue: String(val || ""),
          notes: "Manual update in verification form"
        });
      }
    }

    const updated = {
      ...current,
      ...edits,
      version: current.version + 1
    };

    vobsState[idx] = updated;
    return updated;
  },

  // POST /vobs/:id/submit
  async submitVob(id, submitterEmail = "rohit.k@us24solutions.com") {
    await sleep(300);
    const idx = vobsState.findIndex(v => v.id === id);
    if (idx === -1) throw new Error("VOB not found");

    const vob = vobsState[idx];
    const clientDef = CLIENTS.find(c => c.id === vob.client);

    // Validation engine (FR-8)
    const failingRules = [];
    if (!vob.patientName) failingRules.push({ field: "patientName", message: "Patient Name is mandatory" });
    if (!vob.dob) failingRules.push({ field: "dob", message: "Date of Birth is mandatory" });
    if (!vob.dos) failingRules.push({ field: "dos", message: "Date of Service is mandatory" });
    if (!vob.insurance) failingRules.push({ field: "insurance", message: "Insurance carrier must be verified" });
    if (!vob.idCard) failingRules.push({ field: "idCard", message: "Member ID Card number is required" });
    if (!vob.payerId) failingRules.push({ field: "payerId", message: "Payer ID for claim submission is missing" });
    if (!vob.copayCoinsurance) failingRules.push({ field: "copayCoinsurance", message: "Co-pay / Co-insurance cannot be empty" });
    if (!vob.deductibleApplicable) failingRules.push({ field: "deductibleApplicable", message: "Deductible applicable selection is required" });

    let nextStatus = "Approved";
    if (failingRules.length > 0) {
      nextStatus = "Error";
    } else if (vob.authorization === "Yes" && (!vob.authDetails?.authNumber || !vob.authDetails?.authStartDate)) {
      nextStatus = "Auth Queue";
    }

    const updated = {
      ...vob,
      vobStatus: nextStatus,
      failingRules: failingRules.length > 0 ? failingRules : undefined,
      vobCompletionDate: nextStatus === "Approved" ? new Date().toISOString().split("T")[0] : vob.vobCompletionDate,
      version: vob.version + 1
    };

    vobsState[idx] = updated;

    // Audit log
    auditState.unshift({
      id: `aud_${Date.now()}`,
      vobId: id,
      timestamp: new Date().toISOString(),
      user: submitterEmail,
      role: "user",
      action: "SUBMISSION",
      client: vob.client,
      field: "vobStatus",
      oldValue: vob.vobStatus,
      newValue: nextStatus,
      notes: nextStatus === "Error" ? `Failed ${failingRules.length} rules` : `Routed to ${nextStatus}`
    });

    return {
      id: updated.id,
      status: nextStatus,
      failingRules: updated.failingRules,
      record: updated
    };
  },

  // POST /vobs/:id/transcript
  async postTranscript(id, text) {
    await sleep(200);
    const jobId = `job_${Date.now()}`;
    jobsState[jobId] = {
      id: jobId,
      vobId: id,
      status: "processing",
      createdAt: Date.now()
    };
    return { jobId, status: "enqueued" };
  },

  // GET /vobs/:id/extraction/:jobId
  async getExtractionResult(id, jobId) {
    await sleep(150);
    const job = jobsState[jobId];
    // Simulate ~1.5s extraction completion
    const elapsed = Date.now() - (job?.createdAt || 0);
    if (elapsed < 1200) {
      return { jobId, status: "processing", progress: Math.min(90, Math.floor((elapsed / 1200) * 100)) };
    }

    // Completed AI Extraction result based on realistic transcript content
    return {
      jobId,
      status: "completed",
      progress: 100,
      extractedFields: {
        project: "Parker Clinic",
        requestDate: new Date().toISOString().split("T")[0],
        enteredBy: "rohit.k@us24solutions.com",
        initialDos: "2026-09-24",
        insurance: "UnitedHealthcare (UHC)",
        idCard: "UHC-992817263",
        groupNo: "904128",
        planType: "PPO",
        planName: "UHC Choice Plus",
        networkStatus: "In-Network",
        inNetworkGroup: "Yes",
        coverageStatus: "Active",
        effectiveDate: "2026-01-01",
        terminationDate: "NO",
        visitsLimitation: "30 visits / plan year",
        visitsUsed: "NO",
        insuranceRep: "Sarah Miller",
        callReference: "REF-8891204",
        deductibleApplicable: "Yes",
        deductibleIndividual: "$500.00",
        copayCoinsurance: "$25.00 Copay",
        outOfPocket: "$2,500.00",
        authInitialEval: "NO",
        authTreatment: "NO",
        referral: "NO",
        pcpReferral: "NO",
        payerId: "87726",
        insurancePhone: "1-800-842-8000",
        dialedTime: "08:14",
        callWebsite: "Phone Call"
      }
    };
  },

  // GET /vobs/:id/audit
  async getVobAuditLogs(id) {
    await sleep(100);
    return auditState.filter(a => a.vobId === id);
  },

  // GET /audit
  async getAllAuditLogs() {
    await sleep(120);
    return [...auditState];
  },

  // POST /uploads
  async uploadFile(formData, client = "arra") {
    await sleep(250);
    const uploadId = `upl_${Date.now()}`;
    const previewRows = Array.isArray(formData?.rows) && formData.rows.length > 0
      ? formData.rows
      : [
          { row: 1, patientName: "Arthur Dent", dob: "1978-05-11", dos: "2026-10-04", appointmentType: "General Consult", insurance: "BCBS", idCard: "XYZ-1234", valid: true },
          { row: 2, patientName: "Trillian Astra", dob: "1983-09-22", dos: "2026-10-05", appointmentType: "Physical Therapy", insurance: "Aetna", idCard: "AET-9921", valid: true },
          { row: 3, patientName: "Ford Prefect", dob: "", dos: "2026-10-06", appointmentType: "Initial Eval", insurance: "Cigna", idCard: "CIG-8821", valid: false, reason: "Missing Date of Birth (DOB)" },
          { row: 4, patientName: "Zaphod Beeblebrox", dob: "1965-03-15", dos: "2026-10-07", appointmentType: "Specialist Spine", insurance: "UHC", idCard: "UHC-7731", valid: true }
        ];

    const validCount = previewRows.filter(r => r.valid).length;
    const rejectedCount = previewRows.length - validCount;

    uploadsState[uploadId] = {
      uploadId,
      client,
      filename: formData?.filename || "Client_VOB_Batch_Intake.xlsx",
      totalRows: previewRows.length,
      validRows: validCount,
      rejectedRows: rejectedCount,
      rows: previewRows,
      status: "preview"
    };

    return { uploadId, ...uploadsState[uploadId] };
  },

  // GET /uploads/:id/preview
  async getUploadPreview(uploadId) {
    await sleep(100);
    return uploadsState[uploadId] || null;
  },

  // POST /uploads/:id/commit
  async commitUpload(uploadId, adminEmail = "saurabh@us24solutions.com") {
    await sleep(250);
    const upl = uploadsState[uploadId];
    if (!upl) throw new Error("Upload batch not found");

    const validItems = upl.rows.filter(r => r.valid);
    const createdVobs = validItems.map((r, i) => ({
      id: `vob_${Date.now()}_${i}`,
      client: upl.client,
      patientName: r.patientName,
      dob: r.dob,
      dos: r.dos || new Date().toISOString().split('T')[0],
      appointmentType: r.appointmentType || "Physical Therapy",
      insurance: r.insurance || "General Healthcare",
      planTypeAndName: `${r.insurance || 'General'} Choice`,
      groupNo: r.groupNo || "GRP-AUTO",
      primarySecondary: "Primary",
      coverageStatus: "Active",
      networkStatus: "In-Network",
      inNetworkGroup: "Yes",
      inNetworkIndividual: "Yes",
      inNetworkBoth: "Yes",
      authorization: "No",
      referral: "Not Required",
      authRequestTat: "N/A",
      deductibleApplicable: "Yes",
      copayCoinsurance: "$30 Copay",
      visitsLimitation: "20 visits",
      initialDos: r.dos || new Date().toISOString().split('T')[0],
      vobCompletionDate: "",
      vobStatus: "Assigned",
      dosMoreThan15Days: "No",
      payerId: "99102",
      insurancePhone: "1-800-555-0199",
      callWebsite: "Payer Website",
      idCard: r.idCard || "ID-AUTO",
      dialedTime: "",
      assignedTo: "rohit.k@us24solutions.com",
      version: 1,
      provenance: {
        patientName: { source: "intake_upload" },
        dob: { source: "intake_upload" }
      }
    }));

    vobsState.unshift(...createdVobs);
    upl.status = "committed";

    auditState.unshift({
      id: `aud_${Date.now()}`,
      vobId: "batch",
      timestamp: new Date().toISOString(),
      user: adminEmail,
      role: "admin",
      action: "BATCH_IMPORT",
      client: upl.client,
      field: "vobBatch",
      oldValue: null,
      newValue: `${createdVobs.length} VOB records created`,
      notes: `Batch intake from ${upl.filename}`
    });

    return { success: true, count: createdVobs.length, createdVobs };
  },

  // POST /assignments
  async assignVobs({ vobIds, assignees }, adminEmail = "saurabh@us24solutions.com") {
    await sleep(250);
    const targetAssignee = assignees[0];

    vobsState = vobsState.map(v => {
      if (vobIds.includes(v.id)) {
        return {
          ...v,
          assignedTo: targetAssignee,
          vobStatus: v.vobStatus === "Assigned" ? "Assigned" : v.vobStatus,
          version: v.version + 1
        };
      }
      return v;
    });

    auditState.unshift({
      id: `aud_${Date.now()}`,
      vobId: vobIds.join(", "),
      timestamp: new Date().toISOString(),
      user: adminEmail,
      role: "admin",
      action: "ASSIGNMENT",
      client: "multi",
      field: "assignedTo",
      oldValue: "various",
      newValue: targetAssignee,
      notes: `Bulk assigned ${vobIds.length} records to ${targetAssignee}`
    });

    return { success: true, updatedCount: vobIds.length };
  },

  // GET /users
  async getUsers() {
    await sleep(100);
    return [...usersState];
  },

  // POST /users
  async createUser(userData) {
    await sleep(200);
    const newUser = {
      id: `usr_${Date.now()}`,
      ...userData,
      status: "active",
      createdAt: new Date().toISOString()
    };
    usersState.push(newUser);
    return newUser;
  },

  // PATCH /users/:id
  async patchUser(id, updates) {
    await sleep(150);
    const idx = usersState.findIndex(u => u.id === id);
    if (idx === -1) throw new Error("User not found");
    usersState[idx] = { ...usersState[idx], ...updates };
    return usersState[idx];
  },

  // GET /clients/:id/format
  async getClientFormat(clientId) {
    await sleep(80);
    const client = CLIENTS.find(c => c.id === clientId);
    if (!client) throw new Error("Client not found");
    return {
      client,
      canonicalFields: CANONICAL_FIELDS,
      extendedColumns: client.extendedColumns
    };
  },

  // POST /exports
  async exportVobs(clientId, format = "xlsx") {
    await sleep(300);
    const clientName = CLIENTS.find(c => c.id === clientId)?.name || "All_Clients";
    return {
      filename: `US24_VOB_Export_${clientName}_${new Date().toISOString().split("T")[0]}.${format}`,
      downloadUrl: "#export-ready",
      exportedRows: vobsState.filter(v => clientId === "all" || v.client === clientId).length
    };
  }
};
