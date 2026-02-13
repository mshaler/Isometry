/**
 * Property Storage for Unknown Frontmatter Keys
 *
 * Stores frontmatter keys that don't map to nodes table columns
 * in the node_properties EAV table (established in Phase 63).
 */
import type { Database } from 'sql.js';

/**
 * Known frontmatter keys that map directly to nodes table columns.
 * Keys not in this set are stored in node_properties.
 */
export const KNOWN_KEYS = new Set([
  // Identifiers
  'title', 'id', 'name',
  // Alto-specific identifiers
  'contact_id', 'chat_id', 'event_id', 'reminder_id',
  // Timestamps
  'created', 'modified', 'created_at', 'modified_at',
  'last_modified', 'created_date', 'modified_date',
  'start_date', 'end_date', 'due_date',
  'first_message', 'last_message',
  // Location
  'location', 'latitude', 'longitude',
  // Category/Organization
  'folder', 'calendar', 'organization', 'list',
  'tags', 'status', 'priority',
  // Metadata
  'source', 'source_url', 'source_id',
  // Special handling (arrays, nested objects)
  'attachments', 'links', 'participants', 'attendees', 'alarms', 'recurrence'
]);

/**
 * Store unknown frontmatter keys in node_properties table.
 *
 * Iterates over frontmatter, filters out KNOWN_KEYS, and inserts
 * remaining keys with JSON-serialized values.
 *
 * @param db - sql.js Database instance
 * @param nodeId - The node's UUID to link properties to
 * @param frontmatter - Parsed YAML frontmatter object
 */
export function storeNodeProperties(
  db: Database,
  nodeId: string,
  frontmatter: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(frontmatter)) {
    if (KNOWN_KEYS.has(key)) {
      continue; // Skip keys that map to nodes table columns
    }

    // Determine value type and typed column values
    const valueType = Array.isArray(value) ? 'array'
      : value === null ? 'null'
      : typeof value;
    const valueString = typeof value === 'string' ? value : null;
    const valueNumber = typeof value === 'number' ? value : null;
    const valueBoolean = typeof value === 'boolean' ? (value ? 1 : 0) : null;
    const valueJson =
      valueType === 'array' || valueType === 'object' ? JSON.stringify(value) : null;
    const legacyValue = JSON.stringify(value);

    // Generate property ID (deterministic for idempotency)
    const propId = `prop-${nodeId}-${key}`;

    // Insert or replace (handles re-imports)
    db.run(`
      INSERT OR REPLACE INTO node_properties (
        id, node_id, key, value, value_type,
        value_string, value_number, value_boolean, value_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      propId,
      nodeId,
      key,
      legacyValue,
      valueType,
      valueString,
      valueNumber,
      valueBoolean,
      valueJson,
    ]);
  }
}

/**
 * Get all custom properties for a node.
 *
 * @param db - sql.js Database instance
 * @param nodeId - The node's UUID
 * @returns Object with property keys and parsed values
 */
export function getNodeProperties(
  db: Database,
  nodeId: string
): Record<string, unknown> {
  const result = db.exec(`
    SELECT key, value, value_type
    FROM node_properties
    WHERE node_id = ?
  `, [nodeId]);

  const properties: Record<string, unknown> = {};

  if (result.length > 0 && result[0]?.values) {
    for (const row of result[0].values) {
      const key = row[0] as string;
      const value = row[1] as string;
      // Parse JSON back to original type
      try {
        properties[key] = JSON.parse(value);
      } catch {
        properties[key] = value; // Fallback to string if not valid JSON
      }
    }
  }

  return properties;
}
