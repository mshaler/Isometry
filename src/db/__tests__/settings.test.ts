/**
 * Settings Service Tests
 *
 * Unit tests for SettingsService CRUD operations and seedDefaultSettings.
 * Uses in-memory sql.js database initialized with schema.
 *
 * Phase 100-01: Settings Registry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'sql.js-fts5';
import { createTestDB, cleanupTestDB } from '@/test/db-utils';
import { createSettingsService, seedDefaultSettings } from '../settings';

describe('SettingsService', () => {
  let db: Database;

  beforeEach(async () => {
    // Create in-memory database with schema (no sample data needed)
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    if (db) {
      await cleanupTestDB(db);
    }
  });

  describe('getSetting', () => {
    it('returns null for missing key', () => {
      const service = createSettingsService(db);
      const result = service.getSetting<string>('nonexistent_key');
      expect(result).toBeNull();
    });

    it('returns parsed value for existing key', () => {
      const service = createSettingsService(db);

      // Insert a setting manually
      db.run(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        ['test_key', JSON.stringify('test_value'), new Date().toISOString()]
      );

      const result = service.getSetting<string>('test_key');
      expect(result).toBe('test_value');
    });

    it('handles different JSON types correctly', () => {
      const service = createSettingsService(db);

      // String
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'string_key',
        JSON.stringify('hello'),
      ]);
      expect(service.getSetting<string>('string_key')).toBe('hello');

      // Number
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'number_key',
        JSON.stringify(42),
      ]);
      expect(service.getSetting<number>('number_key')).toBe(42);

      // Boolean
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'bool_key',
        JSON.stringify(true),
      ]);
      expect(service.getSetting<boolean>('bool_key')).toBe(true);

      // Object
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'object_key',
        JSON.stringify({ nested: 'value' }),
      ]);
      expect(service.getSetting<{ nested: string }>('object_key')).toEqual({
        nested: 'value',
      });

      // Array
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'array_key',
        JSON.stringify([1, 2, 3]),
      ]);
      expect(service.getSetting<number[]>('array_key')).toEqual([1, 2, 3]);
    });

    it('returns null for malformed JSON', () => {
      const service = createSettingsService(db);

      // Insert invalid JSON manually
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'bad_json',
        'not-valid-json{',
      ]);

      const result = service.getSetting<string>('bad_json');
      expect(result).toBeNull();
    });
  });

  describe('setSetting', () => {
    it('creates new entry when key does not exist', () => {
      const service = createSettingsService(db);

      service.setSetting('new_key', 'new_value');

      const result = db.exec('SELECT value FROM settings WHERE key = ?', ['new_key']);
      expect(result[0].values.length).toBe(1);
      expect(JSON.parse(String(result[0].values[0][0]))).toBe('new_value');
    });

    it('updates existing entry when key already exists (UPSERT)', () => {
      const service = createSettingsService(db);

      // Insert initial value
      service.setSetting('update_key', 'initial_value');

      // Update to new value
      service.setSetting('update_key', 'updated_value');

      // Verify only one entry exists with updated value
      const result = db.exec('SELECT value FROM settings WHERE key = ?', [
        'update_key',
      ]);
      expect(result[0].values.length).toBe(1);
      expect(JSON.parse(String(result[0].values[0][0]))).toBe('updated_value');
    });

    it('updates timestamp on UPSERT', () => {
      const service = createSettingsService(db);

      const timestamp1 = new Date().toISOString();
      service.setSetting('timestamp_key', 'value1');

      // Wait a tiny bit to ensure timestamp changes
      const timestamp2 = new Date().toISOString();
      service.setSetting('timestamp_key', 'value2');

      const result = db.exec(
        'SELECT updated_at FROM settings WHERE key = ?',
        ['timestamp_key']
      );
      const updatedAt = String(result[0].values[0][0]);

      // Updated timestamp should be >= the second insert time
      expect(updatedAt >= timestamp2).toBe(true);
    });

    it('handles complex types correctly', () => {
      const service = createSettingsService(db);

      const complexObject = {
        theme: 'NeXTSTEP',
        options: {
          sidebar_collapsed: true,
          density: 'comfortable',
        },
        recent_files: ['/path/one', '/path/two'],
      };

      service.setSetting('complex_key', complexObject);
      const retrieved = service.getSetting<typeof complexObject>('complex_key');

      expect(retrieved).toEqual(complexObject);
    });
  });

  describe('deleteSetting', () => {
    it('removes entry from database', () => {
      const service = createSettingsService(db);

      // Insert then delete
      service.setSetting('delete_key', 'value');
      service.deleteSetting('delete_key');

      const result = db.exec('SELECT * FROM settings WHERE key = ?', [
        'delete_key',
      ]);
      expect(result.length === 0 || result[0].values.length === 0).toBe(true);
    });

    it('does not throw when deleting non-existent key', () => {
      const service = createSettingsService(db);

      expect(() => {
        service.deleteSetting('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getAllSettings', () => {
    it('returns empty object when no settings exist', () => {
      const service = createSettingsService(db);

      // Clear all settings first (schema might have seeded defaults)
      db.run('DELETE FROM settings');

      const all = service.getAllSettings();
      expect(all).toEqual({});
    });

    it('returns all settings as key-value object', () => {
      const service = createSettingsService(db);

      // Clear and insert test settings
      db.run('DELETE FROM settings');
      service.setSetting('key1', 'value1');
      service.setSetting('key2', 42);
      service.setSetting('key3', { nested: true });

      const all = service.getAllSettings();
      expect(all).toEqual({
        key1: 'value1',
        key2: 42,
        key3: { nested: true },
      });
    });

    it('handles malformed JSON gracefully in getAllSettings', () => {
      const service = createSettingsService(db);

      // Clear and insert mix of valid and invalid JSON
      db.run('DELETE FROM settings');
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'valid',
        JSON.stringify('good'),
      ]);
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [
        'invalid',
        'bad-json{',
      ]);

      const all = service.getAllSettings();

      // Valid JSON should be parsed
      expect(all.valid).toBe('good');

      // Invalid JSON should fall back to raw value
      expect(all.invalid).toBe('bad-json{');
    });
  });

  describe('seedDefaultSettings', () => {
    it('inserts default settings if they do not exist', () => {
      // Clear settings table first
      db.run('DELETE FROM settings');

      seedDefaultSettings(db);

      const service = createSettingsService(db);
      expect(service.getSetting<string>('theme')).toBe('NeXTSTEP');
      expect(service.getSetting<boolean>('sidebar_collapsed')).toBe(false);
      expect(service.getSetting<boolean>('right_sidebar_collapsed')).toBe(false);
    });

    it('does not overwrite existing user values', () => {
      // Clear and set user value
      db.run('DELETE FROM settings');
      const service = createSettingsService(db);
      service.setSetting('theme', 'Modern');

      // Seed defaults
      seedDefaultSettings(db);

      // User value should remain unchanged
      expect(service.getSetting<string>('theme')).toBe('Modern');
    });

    it('inserts missing defaults while preserving existing settings', () => {
      // Clear and set one user value
      db.run('DELETE FROM settings');
      const service = createSettingsService(db);
      service.setSetting('theme', 'Custom');

      // Seed defaults
      seedDefaultSettings(db);

      // User value preserved
      expect(service.getSetting<string>('theme')).toBe('Custom');

      // Defaults added for missing keys
      expect(service.getSetting<boolean>('sidebar_collapsed')).toBe(false);
      expect(service.getSetting<boolean>('right_sidebar_collapsed')).toBe(false);
    });
  });
});
