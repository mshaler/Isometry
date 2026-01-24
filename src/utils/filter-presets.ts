/**
 * Filter Preset Storage Utilities
 *
 * Manages saving/loading filter presets to/from localStorage.
 * Handles JSON serialization with Date objects.
 */

import type { FilterPreset } from '../types/filter';

const STORAGE_KEY = 'isometry:filter-presets';

/**
 * Serialize preset for storage (converts Dates to ISO strings)
 */
function serializePreset(preset: FilterPreset): Record<string, unknown> {
  return {
    ...preset,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  };
}

/**
 * Deserialize preset from storage (converts ISO strings to Dates)
 */
function deserializePreset(data: any): FilterPreset {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/**
 * Load all presets from localStorage
 */
export function loadPresets(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('Invalid preset data in localStorage, resetting');
      return [];
    }

    return parsed.map(deserializePreset);
  } catch (error) {
    console.error('Failed to load presets from localStorage:', error);
    return [];
  }
}

/**
 * Save preset to localStorage
 */
export function savePreset(preset: FilterPreset): void {
  try {
    const presets = loadPresets();
    const existingIndex = presets.findIndex((p) => p.id === preset.id);

    if (existingIndex >= 0) {
      // Update existing preset
      presets[existingIndex] = preset;
    } else {
      // Add new preset
      presets.push(preset);
    }

    const serialized = presets.map(serializePreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save preset to localStorage:', error);
    throw new Error('Failed to save preset');
  }
}

/**
 * Delete preset from localStorage
 */
export function deletePreset(id: string): void {
  try {
    const presets = loadPresets();
    const filtered = presets.filter((p) => p.id !== id);

    const serialized = filtered.map(serializePreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to delete preset from localStorage:', error);
    throw new Error('Failed to delete preset');
  }
}

/**
 * Update preset in localStorage
 */
export function updatePreset(
  id: string,
  updates: Partial<FilterPreset>
): void {
  try {
    const presets = loadPresets();
    const existingIndex = presets.findIndex((p) => p.id === id);

    if (existingIndex < 0) {
      throw new Error(`Preset with id ${id} not found`);
    }

    const updated = {
      ...presets[existingIndex],
      ...updates,
      updatedAt: new Date(),
    };

    presets[existingIndex] = updated;

    const serialized = presets.map(serializePreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to update preset in localStorage:', error);
    throw new Error('Failed to update preset');
  }
}

/**
 * Check if preset name already exists
 */
export function presetNameExists(name: string, excludeId?: string): boolean {
  const presets = loadPresets();
  return presets.some((p) => p.name === name && p.id !== excludeId);
}

/**
 * Generate unique preset ID
 */
export function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
