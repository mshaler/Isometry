/**
 * ID Generation Utilities
 *
 * Provides consistent ID generation for the application
 */

/**
 * Generate a unique ID using crypto.randomUUID if available,
 * falling back to timestamp + random string
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a prefixed ID with optional prefix
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}