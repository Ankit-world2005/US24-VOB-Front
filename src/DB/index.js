import clientsData from './clients.json';
import formFieldsData from './form_fields.json';
import uiContentData from './ui_content.json';
import verificationSchema from './schema.json';

// Named exports for JSON definitions
export {
  clientsData,
  formFieldsData,
  uiContentData,
  verificationSchema
};

// Application domain exports
export const CLIENTS = clientsData.clients;
export const CANONICAL_FIELDS = formFieldsData.canonicalFields;
export const FORM_SECTIONS = formFieldsData.sections;
export const REP_VERIFICATION_FIELDS = formFieldsData.repVerificationFields;
export const OURS_VERIFICATION_FIELDS = formFieldsData.oursVerificationFields;
export const CORE_VERIFICATION_FIELDS = formFieldsData.coreVerificationFields;
export const UI_CONTENT = uiContentData;
export const VERIFICATION_SCHEMA = verificationSchema;

export default {
  clients: clientsData,
  formFields: formFieldsData,
  uiContent: uiContentData,
  verificationSchema
};
