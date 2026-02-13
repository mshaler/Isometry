/**
 * ErrorReportingService - Re-export for backward compatibility
 *
 * The actual implementation lives in ./system/ErrorReportingService.ts
 */

export {
  errorReporting,
  useErrorReporting,
  type ErrorReport,
  type ErrorNotification,
} from './system/ErrorReportingService';
