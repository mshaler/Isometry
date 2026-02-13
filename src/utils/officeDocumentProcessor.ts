/**
 * officeDocumentProcessor - Re-export for backward compatibility
 *
 * The actual implementation lives in ./import-export/officeDocumentProcessor.ts
 * which in turn delegates to ./import-export/office/index.ts
 */

// Re-export everything from the modular implementation
// This includes: importOfficeFile, OfficeDocumentProcessor, officeProcessor, types, etc.
export * from './import-export/officeDocumentProcessor';
export { default as OfficeDocumentProcessor, officeProcessor } from './import-export/officeDocumentProcessor';
