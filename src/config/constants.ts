/**
 * Application Constants
 *
 * Centralizes magic numbers and configuration values used across the application.
 * Organized by domain for easy discovery and maintenance.
 */

// =============================================================================
// Query & Database
// =============================================================================

/** Default maximum rows returned from queries */
export const DEFAULT_MAX_ROWS = 1000;

/** Cache time-to-live in milliseconds (5 minutes) */
export const CACHE_TTL_MS = 300_000;

/** Debounce delay for search/filter operations in ms */
export const SEARCH_DEBOUNCE_MS = 300;

// =============================================================================
// UI & Rendering
// =============================================================================

/** Maximum pool size for reusable D3 elements */
export const MAX_RENDER_POOL_SIZE = 100;

/** Default animation duration in ms */
export const DEFAULT_ANIMATION_DURATION_MS = 200;

/** Debounce delay for resize handlers in ms */
export const RESIZE_DEBOUNCE_MS = 150;

// =============================================================================
// Command & Input
// =============================================================================

/** Maximum command length to prevent abuse */
export const MAX_COMMAND_LENGTH = 2000;

/** Maximum history entries to store */
export const MAX_HISTORY_ENTRIES = 1000;

// =============================================================================
// Network & Timeouts
// =============================================================================

/** Default API request timeout in ms */
export const DEFAULT_API_TIMEOUT_MS = 30_000;

/** WebSocket reconnection base delay in ms */
export const WS_RECONNECT_BASE_DELAY_MS = 1000;

/** Maximum WebSocket reconnection attempts */
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

// =============================================================================
// File Size Limits
// =============================================================================

/** Maximum file size for import in bytes (50MB) */
export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum attachment size in bytes (10MB) */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
