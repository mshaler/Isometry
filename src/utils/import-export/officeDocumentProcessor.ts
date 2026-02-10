/**
 * Office Document Processor - Re-export from modular implementation
 *
 * This file now delegates to the modular OfficeDocumentProcessor implementation
 * in the office/ directory for better maintainability.
 */

// Re-export everything from the modular implementation
export * from './office/index';
export { OfficeDocumentProcessor as default, officeProcessor } from './office/index';