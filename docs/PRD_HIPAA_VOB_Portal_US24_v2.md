# PRD: HIPAA-Compliant VOB Portal

**Organization:** US24 Solutions  
**Date:** September 20, 2026  
**Status:** Draft v2 — master data added; open questions pending  
**Classification:** Internal

## Overview

US24 Solutions will build an internal, HIPAA-compliant web portal where admins assign Verification of Benefits (VOB) tasks and users complete them with AI-assisted auto-fill, validation, and routing to Saved Records, Auth Queue, or Error. New VOBs are pre-filled from the patient's most recent VOB and from admin-uploaded master data. It runs on AWS under an existing BAA, uses company single sign-on, and must support 250–500 users and about 1,000 VOBs per day across multiple clients whose data stays separated.

**Glossary**

- **VOB (Verification of Benefits):** the check of a patient's insurance coverage, network status, cost share, and authorization rules before a date of service (DOS).
- **VOB record:** one row in a client's tracker (columns from VOB_format.xlsx).
- **VOB form:** the per-patient "Pre-Authorization & Benefits Determination" document (from the sample .docx).
- **Master data:** existing patient and insurance information per client, uploaded by the admin as reference data for pre-filling VOBs.
- **Client:** a healthcare organization US24 performs VOBs for. Each has its own tracker format.

**Sources used for this PRD:** the requirements you described, your answers to the discovery questions, VOB_format.xlsx (9 sheets), and the sample VOB form VOB_PARKER_UHC_ACT_01_01_2025.docx. Anything not covered by these is listed under Open questions rather than assumed.

## Problem

VOB work today is tracked in per-client Excel sheets and Word forms, which do not scale to 1,000 VOBs per day and do not meet HIPAA safeguards for PHI.

- **Inconsistent formats.** The 8 client sheets in VOB_format.xlsx have 28 to 35 columns each, with different column names for the same field ("Are we in with Group" vs "GRP" vs "Group") and different column orders (DOS before or after Appointment Type).
- **Duplicate manual entry.** Users re-type data that already exists from earlier VOBs or the client's existing records for the same patient, and re-type details from payer calls into both the tracker row and the VOB form.
- **No enforced validation.** The sheets contain no data validation rules, so incomplete or wrong VOBs are found late, if at all.
- **Weak visibility.** Admins lack a live view of total, pending, approved, error, and auth-queue volume per user and per client.
- **Compliance risk.** Spreadsheets and documents with PHI lack role-based access, per-client isolation, and a field-level audit trail of who changed what.

## Target users

The portal has two roles in scope: Admin and User. Both are US24 office employees who sign in with company identity.

| Role | Who | What they can see | Main screens |
| --- | --- | --- | --- |
| Admin | Team leads or managers who allocate and review VOB work | All clients, all users, all VOBs, all logs | Admin Dashboard, Upload & Assign, User Access, Records & Logs |
| User | VOB specialists who call payers or check payer websites | Only VOBs assigned to them | My Dashboard, New Verification, Auth Queue, Error |

The Client Request sheet has a "QA By" column, so a QA reviewer may be a separate role. This is listed under Open questions and is not in scope until confirmed.

## Core features

Nine features make up the product. Each VOB moves through the lifecycle below.

| From | Event | To |
| --- | --- | --- |
| Start | Admin uploads task file and assigns; VOB pre-filled from recent VOB, then master data | Assigned |
| Assigned | User opens VOB | In Progress |
| In Progress | User submits | Validation |
| Validation | Any rule fails | Error |
| Error | User edits and resubmits | Validation |
| Validation | Authorization required = Yes | Auth Queue |
| Auth Queue | Auth criteria met, resubmit | Validation |
| Validation | All rules pass, no auth pending | Saved Records (Approved) |

A submitted VOB goes to Error if any validation fails, to Auth Queue if authorization is required, and to Saved Records ("Approved") only when it is complete.

1. **Secure login.** Company single sign-on, role-based access (Admin, User), and automatic session timeout.
2. **Admin Dashboard.** Counts for Total, Pending, Approved (Saved Records), Error, and Auth Queue, filterable by client, user, and date. One tap on any count or row opens the record and its logs.
3. **Upload & Assign.** Admin uploads a file of VOB requests for a client and assigns them one by one or in bulk to selected users.
4. **Master data upload.** Admin uploads a client's master data (existing patient and insurance information), stored separately from VOBs as reference data.
5. **Auto-fill on assignment.** When a VOB is assigned, the system pre-fills it in that client's format. The patient's most recent VOB takes priority; master data fills only the fields the recent VOB leaves empty.
6. **Auto-fill from transcript (AI).** A user pastes a call or website transcript, and AI fills the remaining empty columns of the VOB. The user reviews before submitting.
7. **Validation and routing.** Every column and condition of the client's VOB format is checked on submit, and the VOB is routed to Error, Auth Queue, or Saved Records.
8. **User workspace.** My Dashboard (own counts only), New Verification, Auth Queue, and Error tabs.
9. **Audit logs.** Every field change (who, when, old value, new value), every login, every export, and every master data upload, viewable per record by the admin.

## User stories

Each story has a clear acceptance check so it can be tested.

| ID | As a… | I want to… | So that… | Acceptance check |
| --- | --- | --- | --- | --- |
| A1 | Admin | sign in with my company account | I don't manage a separate password | SSO login works; non-provisioned accounts are denied |
| A2 | Admin | grant or revoke portal access for a user | only approved staff see PHI | Revoked user is blocked at next request; action is logged |
| A3 | Admin | upload a client's VOB request file | I don't create VOBs one at a time | File is parsed; row count, valid rows, and rejected rows are shown before import |
| A4 | Admin | assign VOBs to one user, or in bulk to selected users | work is spread across the team | Each VOB has exactly one assignee; assignee sees it in New Verification |
| A5 | Admin | see Total, Pending, Approved, Error, and Auth Queue counts | I know the day's workload and backlog | Counts match record statuses; filters by client, user, and date work |
| A6 | Admin | tap a count or record to open its full data and logs | I can review and audit quickly | One tap opens the record with its change history |
| A7 | Admin | see every field change, login, and export | I can meet HIPAA audit needs | Log shows who, when, old value, new value; logs cannot be edited |
| A8 | Admin | upload a client's master data file | assigned VOBs start with existing information | File is previewed; malformed rows rejected with reasons; upload logged with who, when, row count |
| A9 | Admin | assign a VOB and have it pre-filled automatically | users don't start from a blank form | Fields come from the most recent VOB first, then master data for any remaining empty fields |
| U1 | User | see only the VOBs assigned to me | I focus on my work and PHI stays need-to-know | No API or screen returns another user's VOBs |
| U2 | User | open a VOB already pre-filled from existing data | I skip re-typing known details | Each pre-filled field shows its source (recent VOB with its date, or master data) until I confirm or edit it |
| U3 | User | paste a call or website transcript | the empty VOB columns fill automatically | AI-filled fields are marked; nothing submits without my review |
| U4 | User | submit a VOB and have it checked against the client's rules | mistakes are caught before they reach the client | Failed VOB goes to Error with each failing field and reason listed |
| U5 | User | fix a VOB in my Error tab and resubmit | it gets completed | Same VOB (not a copy) is edited and re-validated |
| U6 | User | have VOBs needing authorization go to my Auth Queue | auth follow-up is tracked | VOB with auth required = Yes appears in Auth Queue with all filled data |
| U7 | User | see my own dashboard counts | I track my progress | Counts include only my assigned VOBs |

## Requirements

Requirements are grouped into functional, data model, HIPAA and security, and non-functional. "Must" items are MVP; "Should" items follow.

### Functional requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Login only through the existing company identity provider (SSO). No local passwords. | Must |
| FR-2 | Admin creates, edits, deactivates user access and sets the role (Admin or User). | Must |
| FR-3 | Admin uploads a VOB request file per client; system previews rows and rejects malformed rows with reasons before import. | Must |
| FR-4 | Admin assigns VOBs one by one, or in bulk to one or more selected users. | Must |
| FR-5 | On assignment, system pre-fills empty fields for the same patient within the same client, in this priority: (1) the patient's most recent VOB, (2) master data for fields the recent VOB leaves empty. | Must |
| FR-6 | User pastes a text transcript; AI extracts values and fills only empty columns. Existing values are never overwritten without user action. | Must |
| FR-7 | Every auto-filled field shows its source (recent VOB with its date, master data, or AI) until the user confirms or edits it. | Must |
| FR-8 | On submit, system checks all required columns and conditions defined for that client's format. | Must |
| FR-9 | Failed VOB moves to Error with each failing field and reason; the user edits the same VOB and resubmits. | Must |
| FR-10 | VOB with Authorization = Yes moves to Auth Queue with all filled data; once auth criteria are met, it moves to Saved Records. | Must |
| FR-11 | VOB passing all checks with no pending auth moves to Saved Records and counts as Approved. | Must |
| FR-12 | Admin dashboard shows Total, Pending, Approved, Error, Auth Queue counts, filterable by client, user, date; one tap opens record and logs. | Must |
| FR-13 | User dashboard shows the same counts for the user's own VOBs only. | Must |
| FR-14 | Admin can configure each client's VOB columns and validation rules without a code change. | Should |
| FR-15 | Generate the per-patient VOB form (as in the sample .docx) from a completed VOB. | Should |
| FR-16 | Export records per client in that client's column format; every export is logged. | Should |
| FR-17 | Admin uploads master data per client; system previews rows, rejects malformed rows with reasons, and logs the upload. | Must |
| FR-18 | Master data is stored separately from VOBs and never changes a completed VOB. | Must |
| FR-19 | Pre-fill runs once, at assignment. Later master data uploads do not overwrite fields in VOBs already assigned or in progress. | Must |

### VOB data model

All 8 client sheets share 28 core columns: Patient Name, DOB, DOS, Appointment Type, Insurance, Plan Type and Name, Group No, Primary/Secondary, Coverage Status, Network Status, In-network with Group, In-network with Individual, In-network with both, Authorization, Referral, Auth Request TAT, Deductible applicable, Co-pay / Co-ins, Visits Limitation, Initial DOS, VOB Completion Date, VOB Status, DOS more than 15 days for new patient, Payer ID for claim submission, Insurance Phone Number, Call/Website, ID Card, and Dialed Time. The portal stores these once as canonical fields and maps each client's column names and order onto them.

| Client sheet | Columns beyond the 28 core | Format differences |
| --- | --- | --- |
| Arra | Call duration, INS Payment, Patient Payment, QA By, Call Recording QA, VOB File uploaded | — |
| West AZ | Call duration, INS Payment, Patient Payment, QA By, Call Recording QA | — |
| Namste | None | Core columns only |
| Harikrishna - 2 | Project Name, User Name, Call duration, INS Payment, Patient Payment, QA By, Call Recording QA | In-network columns named GRP / IND / GRP&IND |
| Icure | Call duration, INS Payment, Patient Payment, QA By, Call Recording QA | DOS comes after Appointment Type; blank first column |
| Third eye | Project Name, Call duration, INS Payment, Patient Payment, QA By, Call Recording QA | DOS after Appointment Type; blank column after DOB |
| Sugarland & Harvest Green | Project Name, User Name, Call duration, INS Payment, Patient Payment, QA By, Call Recording QA | In-network columns named Group / IND / GRP&IND |
| MeyerLand | Project Name, User Name, Call duration, INS Payment | 18 blank leading columns; In-network columns named Group / IND / GRP&IND |

The **Client Request** sheet (Request Date, Date of Service, Project, EMR ID, Patient Name, Allocated To, Primary/Secondary, Completion Date, Remark, VOB Status, QA By, Audit Remark, Calling/Portal, call start/end/duration, QA Date, Teams request, escalation details) matches the admin's intake and assignment data and is the likely basis for the upload file.

The **master data** file's columns have not been provided yet (see Open questions). It is stored per client as reference data, mapped onto the same canonical fields, and used only for pre-filling.

The **VOB form** in the sample .docx holds more detail than the tracker: policy ID, effective and termination dates, HSA/HRA amount, deductible and out-of-pocket (individual, met, remaining, used), used visits, auth required for initial eval and for treatment, how to obtain auth, auth number and coverage dates, rep name, call reference, claim mailing address, timely filing limits, and secondary insurance details.

### HIPAA and security requirements

| ID | Requirement |
| --- | --- |
| SEC-1 | Host only on AWS services covered by the existing BAA and marked HIPAA-eligible. |
| SEC-2 | Encrypt PHI at rest (e.g., AWS KMS-managed keys) and in transit (TLS 1.2 or higher). |
| SEC-3 | Enforce role-based access and minimum necessary access: users reach only assigned VOBs, at the API level as well as the UI. |
| SEC-4 | Isolate each client's data so no query, report, export, or history match crosses clients. |
| SEC-5 | The AI model used for transcript extraction must run on a HIPAA-eligible service covered by the BAA; PHI must not be sent to any service without a BAA or used for model training. |
| SEC-6 | Audit log records every field change (who, when, old and new value), login, failed login, and export; logs are append-only. |
| SEC-7 | Automatic session timeout after inactivity and immediate effect when an admin revokes access. |
| SEC-8 | No PHI in application logs, error messages, URLs, or browser storage. |
| SEC-9 | Encrypted backups with a tested restore process. |

### Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | Support 500 active users and 1,000 VOBs per day, with headroom for growth. |
| NFR-2 | Dashboards and record views load quickly under peak daytime load (target to be agreed). |
| NFR-3 | Uploads handle a full day's volume (1,000+ rows) in one file. |
| NFR-4 | Adding a new client format requires configuration, not a code release (once FR-14 ships). |
| NFR-5 | Availability and recovery targets to be agreed (see Open questions). |

## Edge cases

The cases below need defined behavior before build. Where the right behavior is not yet decided, the row points to Open questions.

| Area | Edge case | Expected behavior |
| --- | --- | --- |
| Upload | File columns don't match the client's format (renamed, reordered, blank columns as in MeyerLand and Icure) | Map by header name using the client's column mapping; show unmapped columns to the admin before import |
| Upload | Same patient + DOS uploaded twice | Flag as possible duplicate; admin confirms or skips |
| Upload | Row missing Patient Name or DOB | Reject that row with a reason; import the rest |
| History match | Two past patients share name + DOB | Do not auto-fill; flag for the user to pick or enter manually (matching key is an open question) |
| History match | Past VOB is from a prior plan year, or insurance has changed | Rule for when history is too old to reuse is an open question |
| History match | Match exists but under a different client | Never used; client data stays isolated |
| Master data | Recent VOB and master data disagree on a field | Recent VOB value is used; source label shows it came from the recent VOB |
| Master data | Recent VOB leaves a field empty that master data has | Master data value fills that field |
| Master data | No recent VOB, only master data | All matching fields filled from master data |
| Master data | Master data is newer than the recent VOB (e.g., insurance changed) | Recent VOB still wins under current rule; whether to flag this is an open question |
| Master data | Patient appears more than once in the master file | Do not pre-fill from master data; flag for the user |
| Master data | Admin uploads new master data while VOBs are in progress | In-progress VOBs are not changed (FR-19) |
| Transcript | Transcript contradicts a pre-filled value | Keep the existing value, highlight the conflict for the user |
| Transcript | AI can't find a value, or is unsure | Leave the field empty; do not guess |
| Transcript | Transcript has no PHI-relevant content or is in the wrong format | Fill nothing and tell the user |
| Transcript | AI service is slow or down | User can complete the VOB manually |
| Validation | Primary/Secondary = Secondary but secondary insurance details are empty | Treated per client rule (rules to be supplied) |
| Validation | DOS is more than 15 days out for a new patient | Behavior depends on the rule behind this column (open question) |
| Routing | VOB fails validation and also has Authorization = Yes | Error takes priority; after the fix it goes to Auth Queue |
| Routing | Auth is denied, or not obtained before DOS | Not yet defined (open question) |
| Assignment | Assigned user is deactivated or on leave with open VOBs | Admin reassigns; open VOBs show as unassigned on the dashboard |
| Assignment | Two people edit the same VOB at once | Second save is blocked until the latest version is loaded; both edits logged |
| Access | Admin revokes a user mid-session | Next request is denied; unsaved work is not saved |
| Access | User opens a direct link to another user's VOB | Access denied and logged |
| Session | Session times out during editing | Draft is kept server-side; the user signs in again to continue |

## MVP scope

The MVP delivers the full assign → fill → validate → route loop with HIPAA safeguards, starting with a small set of client formats.

**In MVP**

- SSO login, Admin and User roles, admin-managed user access
- Upload & Assign: one by one and in bulk to selected users
- Master data upload per client
- Auto-fill on assignment (most recent VOB first, then master data, within the same client) and from pasted text transcripts using a HIPAA-eligible AI service
- Validation of required columns and conditions per client format, with routing to Error, Auth Queue, and Saved Records
- User tabs: My Dashboard, New Verification, Auth Queue, Error
- Admin dashboard with counts, filters, and one-tap record and log view
- Field-level audit log, login log, per-client data isolation, encryption at rest and in transit
- Client formats: start with 1–2 pilot clients (which ones to be confirmed), then onboard the remaining sheets

**After MVP**

- Admin-configurable client formats and validation rules (FR-14)
- Generating the per-patient VOB form document (FR-15)
- Client-format exports (FR-16)
- Automatic assignment (e.g., round-robin), if wanted
- QA review workflow, if QA is confirmed as a role

**Out of scope**

- EHR, practice management, or clearinghouse integrations (verification stays manual plus AI)
- Audio transcription of call recordings (input is text transcripts)
- Client-facing access (the portal is internal only)

## Open questions

These are the gaps that still block detailed design. The first six matter most.

- [ ] **Validation rules:** For each client, which columns are required, what values are allowed (e.g., Coverage Status, Network Status, VOB Status), and which conditions define an Error? The Excel file has headers only, with no rules.
- [ ] **Auth criteria:** What exactly moves a VOB from Auth Queue to Saved Records: an auth number entered, auth coverage dates, or something else? What happens if auth is denied or not obtained before DOS?
- [ ] **History matching:** Which fields identify the same patient (Patient Name + DOB, EMR ID, Member/Policy ID)? Which fields may carry over, and after how long is history too old (e.g., new plan year)?
- [ ] **Master data file:** Which columns does it contain, and is it separate from the task/assignment upload? A sample with dummy data or headers is enough.
- [ ] **Master data updates:** Does a new upload replace the client's master data, or add to and update it?
- [ ] **Newer master data:** If master data is newer than the patient's last VOB (e.g., new insurance), should the portal still prefer the VOB, or flag the difference?
- [ ] **Error resubmission:** After a user fixes a VOB in Error and it passes, does it go straight to Saved Records (or Auth Queue if needed), or does an admin review it first?
- [ ] **Upload file:** Is the upload in the Client Request sheet's format? Which file types (.xlsx, .csv)?
- [ ] **Assignment:** Is automatic distribution (e.g., round-robin) needed, or only manual and bulk to selected users?
- [ ] **SSO provider:** Which identity provider (e.g., Microsoft Entra ID, Okta)? Is MFA enforced there?
- [ ] **AI service:** Which model service will be used (e.g., Amazon Bedrock under the AWS BAA)? Where do transcripts come from: typed call notes, speech-to-text output, or payer website text?
- [ ] **VOB form:** Should the portal produce the per-patient VOB form (.docx or PDF) as in the sample? What is the file-naming rule (sample: VOB_PARKER_UHC_ACT_01_01_2025)?
- [ ] **QA role:** Several sheets have QA By and Call Recording QA columns. Is QA a separate role or step?
- [ ] **"DOS more than 15 days for new patient":** What rule does this column check, and what should happen when it is Yes?
- [ ] **Retention and targets:** Record and log retention period, uptime target, and recovery time and point objectives.
- [ ] **Timeline and stack:** MVP deadline, pilot clients, and any required tech stack.
