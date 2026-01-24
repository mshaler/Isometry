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
    it('returns empty array when no presets exist', () => {
      const presets = loadPresets();
      expect(presets).toEqual([]);
    });

    it('returns empty array when localStorage contains invalid JSON', () => {
      const consoleWarnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorageMock.setItem('isometry:filter-presets', 'invalid json');

      const presets = loadPresets();
      expect(presets).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('returns empty array when localStorage contains non-array data', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorageMock.setItem('isometry:filter-presets', JSON.stringify({ foo: 'bar' }));

      const presets = loadPresets();
      expect(presets).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('deserializes presets with Date objects', () => {
      const mockPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: '2026-01-24T00:00:00.000Z',
        updatedAt: '2026-01-24T00:00:00.000Z',
      };

      localStorageMock.setItem('isometry:filter-presets', JSON.stringify([mockPreset]));

      const presets = loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe('test-1');
      expect(presets[0].name).toBe('Test Preset');
      expect(presets[0].createdAt).toBeInstanceOf(Date);
      expect(presets[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('savePreset', () => {
    it('saves a new preset to localStorage', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);

      const stored = localStorageMock.getItem('isometry:filter-presets');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('test-1');
      expect(parsed[0].name).toBe('Test Preset');
      expect(parsed[0].createdAt).toBe('2026-01-24T00:00:00.000Z');
    });

    it('updates existing preset with same ID', () => {
      const preset1: FilterPreset = {
        id: 'test-1',
        name: 'Original Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset1);

      const preset2: FilterPreset = {
        id: 'test-1',
        name: 'Updated Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-25'),
      };

      savePreset(preset2);

      const presets = loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Updated Name');
    });

    it('saves multiple presets', () => {
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

      savePreset(preset1);
      savePreset(preset2);

      const presets = loadPresets();
      expect(presets).toHaveLength(2);
      expect(presets.map((p) => p.name)).toEqual(['Preset 1', 'Preset 2']);
    });
  });

  describe('deletePreset', () => {
    it('removes preset from localStorage', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);
      expect(loadPresets()).toHaveLength(1);

      deletePreset('test-1');
      expect(loadPresets()).toHaveLength(0);
    });

    it('handles deleting non-existent preset gracefully', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);
      deletePreset('non-existent-id');

      // Original preset should still exist
      const presets = loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe('test-1');
    });
  });

  describe('updatePreset', () => {
    it('updates preset properties', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Original Name',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);

      updatePreset('test-1', { name: 'Updated Name' });

      const presets = loadPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe('Updated Name');
      expect(presets[0].updatedAt.getTime()).toBeGreaterThan(preset.updatedAt.getTime());
    });

    it('throws error when updating non-existent preset', () => {
      expect(() => {
        updatePreset('non-existent-id', { name: 'New Name' });
      }).toThrow('Failed to update preset');
    });
  });

  describe('presetNameExists', () => {
    it('returns false when name does not exist', () => {
      expect(presetNameExists('Test Preset')).toBe(false);
    });

    it('returns true when name exists', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);
      expect(presetNameExists('Test Preset')).toBe(true);
    });

    it('excludes preset ID when checking duplicates', () => {
      const preset: FilterPreset = {
        id: 'test-1',
        name: 'Test Preset',
        filters: EMPTY_FILTERS,
        createdAt: new Date('2026-01-24'),
        updatedAt: new Date('2026-01-24'),
      };

      savePreset(preset);

      // Should return false because we're excluding the preset with this name
      expect(presetNameExists('Test Preset', 'test-1')).toBe(false);

      // Should return true for a different ID
      expect(presetNameExists('Test Preset', 'test-2')).toBe(true);
    });
  });
});
