// Isometry v5 — Phase 37 Audit Module Barrel Export
// Public API for the audit overlay system.

export { AuditState, auditState } from './AuditState';
export type { ChangeStatus, AuditImportResult } from './AuditState';
export { AuditOverlay } from './AuditOverlay';
export { AuditLegend } from './AuditLegend';
export {
  AUDIT_COLORS,
  SOURCE_COLORS,
  SOURCE_LABELS,
  getSourceColor,
} from './audit-colors';
