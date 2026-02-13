/**
 * Filter Presets Storage Tests
 *
 * Tests for localStorage-based preset save/load/delete operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadPresets,
  savePreset,
  deletePreset,
  updatePreset,
  presetNameExists,
  generatePresetId,
} from '../filter-presets';
import type { FilterPreset } from '../../types/filter';
import { EMPTY_FILTERS } from '../../types/filter';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Replace global localStorage with mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock encrypted storage utilities to force fallback to localStorage
vi.mock('../encrypted-storage', () => ({
  setEncryptedItem: vi.fn(),
  getEncryptedItem: vi.fn(),
  migrateToEncryptedStorage: vi.fn().mockResolvedValue({ success: false }),
  isEncryptedStorageSupported: vi.fn().mockReturnValue(false)
}));

describe('filter-presets', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    // Clear console spies
    vi.clearAllMocks();
  });

  describe('generatePresetId', () => {
    it('generates unique IDs', () => {
      const id1 = generatePresetId();
      const id2 = generatePresetId();

      expect(id1).toMatch(/^preset-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^preset-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('loadPresets', () => {
    it('returns empty array when no presets exist', async () => {
      const presets = await loadPresets();
      expect(presets).toEqual([]);
    });

    it('returns empty array when localStorage contains invalid JSON', async () => {
      // Suppress console output during this test
      vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.setItem('isometry:filter-presets', 'invalid json');

      const presets = await loadPresets();
      expect(presets).toEqual([]);

      vi.restoreAllMocks();
    });

    it('returns empty array when localStorage contains non-array data', async () => {
      // Suppress console output during this test
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem('isometry:filter-presets', JSON.stringify({ foo: 'bar' }));

      const presets = await loadPresets();
      expect(presets).toEqual([]);

      vi.restoreAllMocks();
    });

    it('deserializes presets with Date objects', async () => {
      const mockPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: '2026-01-24T00:00:00.000Z',
        updatedAt: '2026-01-24T00:00:00.000Z',
      };

      localStorageMock.setItem('isometry:filter-presets', JSON.stringify([mockPreset]));

      const presets = await loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe('test-1');
      expect(presets[0].name).toBe('Test Preset');
      expect(presets[0].createdAt).toBeInstanceOf(Date);
      expect(presets[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('savePreset', () => {
    it('saves a new preset to localStorage', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);

      const stored = localStorageMock.getItem('isometry:filter-presets');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-1');
      expect(parsed[0].name).toBe('Test Preset');
      expect(parsed[0].createdAt).toBe('2026-01-24T00:00:00.000Z');
    });

    it('updates existing preset with same ID', async () => {
      const preset1: FilterPreset = {
        id: 'test-1',
        name: 'Original Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset1);

      const preset2: FilterPreset = {
        id: 'test-1',
        name: 'Updated Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-25'),
      };

      await savePreset(preset2);

      const presets = await loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Updated Name');
    });

    it('saves multiple presets', async () => {
      const preset1: FilterPreset = {
        id: 'test-1',
        name: 'Preset 1',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      const preset2: FilterPreset = {
        id: 'test-2',
        name: 'Preset 2',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset1);
      await savePreset(preset2);

      const presets = await loadPresets();
      expect(presets).toHaveLength(2);
      expect(presets.map((p) => p.name)).toEqual(['Preset 1', 'Preset 2']);
    });
  });

  describe('deletePreset', () => {
    it('removes preset from localStorage', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);
      expect(await loadPresets()).toHaveLength(1);

      await deletePreset('test-1');
      expect(await loadPresets()).toHaveLength(0);
    });

    it('handles deleting non-existent preset gracefully', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);
      await deletePreset('non-existent-id');

      // Original preset should still exist
      const presets = await loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe('test-1');
    });
  });

  describe('updatePreset', () => {
    it('updates preset properties', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Original Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);

      await updatePreset('test-1', { name: 'Updated Name' });

      const presets = await loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Updated Name');
      expect(presets[0].updatedAt.getTime()).toBeGreaterThan(preset.updatedAt.getTime());
    });

    it('throws error when updating non-existent preset', async () => {
      await expect(async () => {
        await updatePreset('non-existent-id', { name: 'New Name' });
      }).rejects.toThrow('Failed to update preset');
    });
  });

  describe('presetNameExists', () => {
    it('returns false when name does not exist', async () => {
      expect(await presetNameExists('Test Preset')).toBe(false);
    });

    it('returns true when name exists', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);
      expect(await presetNameExists('Test Preset')).toBe(true);
    });

    it('excludes preset ID when checking duplicates', async () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      await savePreset(preset);

      // Should return false because we're excluding the preset with this name
      expect(await presetNameExists('Test Preset', 'test-1')).toBe(false);

      // Should return true for a different ID
      expect(await presetNameExists('Test Preset', 'test-2')).toBe(true);
    });
  });
});
