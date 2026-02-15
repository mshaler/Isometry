/**
 * Settings Service - Type-safe settings persistence
 *
 * Provides CRUD operations for user preferences stored in the settings table.
 * All values are JSON-serialized for type safety and support any serializable type.
 *
 * Phase 100-01: Settings Registry
 */

import type { Database } from 'sql.js';

/**
 * Settings service interface for CRUD operations on the settings table.
 */
export interface SettingsService {
  /**
   * Get a setting value by key, with optional type parameter.
   * Returns null if the setting doesn't exist or can't be parsed.
   *
   * @example
   * const theme = service.getSetting<string>('theme'); // 'NeXTSTEP' | null
   * const collapsed = service.getSetting<boolean>('sidebar_collapsed'); // true | false | null
   */
  getSetting<T>(key: string): T | null;

  /**
   * Set a setting value by key (UPSERT).
   * Automatically JSON-serializes the value and updates the timestamp.
   *
   * @example
   * service.setSetting('theme', 'Modern');
   * service.setSetting('sidebar_collapsed', true);
   */
  setSetting<T>(key: string, value: T): void;

  /**
   * Delete a setting by key.
   *
   * @example
   * service.deleteSetting('last_app');
   */
  deleteSetting(key: string): void;

  /**
   * Get all settings as a key-value object.
   * Useful for debugging or settings inspector UI.
   *
   * @example
   * const all = service.getAllSettings();
   * // { theme: 'NeXTSTEP', sidebar_collapsed: false, ... }
   */
  getAllSettings(): Record<string, unknown>;
}

/**
 * Create a settings service instance wrapping the given database.
 *
 * @param db - sql.js Database instance
 * @returns SettingsService with CRUD operations
 *
 * @example
 * const service = createSettingsService(db);
 * const theme = service.getSetting<string>('theme');
 * service.setSetting('theme', 'Modern');
 */
export function createSettingsService(db: Database): SettingsService {
  return {
    getSetting<T>(key: string): T | null {
      try {
        const result = db.exec(
          'SELECT value FROM settings WHERE key = ?',
          [key]
        );

        // No results means setting doesn't exist
        if (!result[0] || result[0].values.length === 0) {
          return null;
        }

        const rawValue = result[0].values[0][0];
        if (rawValue === null || rawValue === undefined) {
          return null;
        }

        // Parse JSON value
        const parsed = JSON.parse(String(rawValue)) as T;
        return parsed;
      } catch (error) {
        console.warn(`[SettingsService] Failed to get setting "${key}":`, error);
        return null;
      }
    },

    setSetting<T>(key: string, value: T): void {
      try {
        const jsonValue = JSON.stringify(value);
        const timestamp = new Date().toISOString();

        // UPSERT: insert or update if key already exists
        db.run(
          `INSERT INTO settings (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`,
          [key, jsonValue, timestamp]
        );
      } catch (error) {
        console.error(`[SettingsService] Failed to set setting "${key}":`, error);
        throw error;
      }
    },

    deleteSetting(key: string): void {
      try {
        db.run('DELETE FROM settings WHERE key = ?', [key]);
      } catch (error) {
        console.error(`[SettingsService] Failed to delete setting "${key}":`, error);
        throw error;
      }
    },

    getAllSettings(): Record<string, unknown> {
      try {
        const result = db.exec('SELECT key, value FROM settings');

        if (!result[0] || result[0].values.length === 0) {
          return {};
        }

        const settings: Record<string, unknown> = {};
        for (const row of result[0].values) {
          const key = String(row[0]);
          const rawValue = row[1];

          if (rawValue !== null && rawValue !== undefined) {
            try {
              settings[key] = JSON.parse(String(rawValue));
            } catch {
              // If JSON parse fails, store raw value
              settings[key] = rawValue;
            }
          }
        }

        return settings;
      } catch (error) {
        console.error('[SettingsService] Failed to get all settings:', error);
        return {};
      }
    },
  };
}

/**
 * Seed default settings if they don't already exist.
 * Called during database initialization to ensure baseline settings are present.
 * Does NOT overwrite existing user values.
 *
 * @param db - sql.js Database instance
 *
 * @example
 * seedDefaultSettings(db);
 */
export function seedDefaultSettings(db: Database): void {
  const defaults: Record<string, unknown> = {
    theme: 'NeXTSTEP',
    sidebar_collapsed: false,
    right_sidebar_collapsed: false,
  };

  try {
    for (const [key, value] of Object.entries(defaults)) {
      // Check if setting already exists
      const result = db.exec('SELECT 1 FROM settings WHERE key = ?', [key]);

      // Only insert if it doesn't exist (preserves user changes)
      if (!result[0] || result[0].values.length === 0) {
        const jsonValue = JSON.stringify(value);
        const timestamp = new Date().toISOString();
        db.run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
          [key, jsonValue, timestamp]
        );
      }
    }
  } catch (error) {
    console.error('[SettingsService] Failed to seed default settings:', error);
    // Non-fatal: continue even if seeding fails
  }
}
