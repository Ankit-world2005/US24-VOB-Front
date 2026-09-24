import clientsData from './clients.json';
import formFieldsData from './form_fields.json';
import usersData from './users.json';
import vobsData from './vobs.json';
import masterData from './master_data.json';
import specialistWorkloadData from './specialist_workload.json';
import auditLogsData from './audit_logs.json';
import transcriptsData from './transcripts.json';
import uiContentData from './ui_content.json';
import verificationSchema from './schema.json';
import dbManifest from './index.json';

// Named exports for individual JSON payloads
export {
  clientsData,
  formFieldsData,
  usersData,
  vobsData,
  masterData,
  specialistWorkloadData,
  auditLogsData,
  transcriptsData,
  uiContentData,
  verificationSchema,
  dbManifest
};

// Convenient unpacked exports matching application naming conventions
export const CLIENTS = clientsData.clients;
export const CANONICAL_FIELDS = formFieldsData.canonicalFields;
export const FORM_SECTIONS = formFieldsData.sections;
export const REP_VERIFICATION_FIELDS = formFieldsData.repVerificationFields;
export const OURS_VERIFICATION_FIELDS = formFieldsData.oursVerificationFields;
export const CORE_VERIFICATION_FIELDS = formFieldsData.coreVerificationFields;
export const USERS = usersData.authUsers;
export const MOCK_USERS = usersData.usersList;
export const INITIAL_MOCK_VOBS = vobsData.allVobs;
export const VOBS_BY_STATUS = vobsData.recordsByStatus;
export const MASTER_RECORDS = masterData.records;
export const SPECIALIST_WORKLOAD = specialistWorkloadData.specialists;
export const MOCK_AUDIT_LOGS = auditLogsData.logs;
export const SAMPLE_TRANSCRIPTS = transcriptsData.samples;
export const UI_CONTENT = uiContentData;
export const VERIFICATION_SCHEMA = verificationSchema;

export default {
  clients: clientsData,
  formFields: formFieldsData,
  users: usersData,
  vobs: vobsData,
  masterData,
  specialistWorkload: specialistWorkloadData,
  auditLogs: auditLogsData,
  transcripts: transcriptsData,
  uiContent: uiContentData,
  verificationSchema,
  manifest: dbManifest
};
